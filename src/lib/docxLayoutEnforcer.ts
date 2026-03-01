import PizZip from 'pizzip';
import {
  DocxLayoutConfig,
  PAGE_SIZES,
  cmToTwips,
  ptToHalfPoints,
  ptToTwips,
  lineSpacingToTwips
} from './layoutConstants';

const getAlignmentValue = (align: string): string => {
  const alignmentMap: Record<string, string> = {
    'left': 'left',
    'center': 'center',
    'right': 'right',
    'justify': 'both'
  };
  return alignmentMap[align] || 'both';
};

export const applyPageSettings = (zip: PizZip, config: DocxLayoutConfig): void => {
  try {
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      console.warn('document.xml not found, skipping page settings');
      return;
    }

    let content = documentXml.asText();
    if (!content) {
      console.warn('document.xml is empty, skipping page settings');
      return;
    }

    if (!validateXmlBasicStructure(content, 'document.xml (before page settings)')) {
      console.error('Template document.xml has invalid XML structure before applying page settings');
      return;
    }

    const pageSize = PAGE_SIZES[config.page_size] || PAGE_SIZES['A4'];

    const widthTwips = config.orientation === 'landscape' ? pageSize.heightTwips : pageSize.widthTwips;
    const heightTwips = config.orientation === 'landscape' ? pageSize.widthTwips : pageSize.heightTwips;

    const marginTop = cmToTwips(config.margin_top);
    const marginBottom = cmToTwips(config.margin_bottom);
    const marginLeft = cmToTwips(config.margin_left);
    const marginRight = cmToTwips(config.margin_right);
    const headerMargin = cmToTwips(config.header_margin);
    const footerMargin = cmToTwips(config.footer_margin);
    const gutter = cmToTwips(config.gutter);

    const sectPrRegex = /(<w:sectPr[^>]*>)([\s\S]*?)(<\/w:sectPr>)/g;
    const matches = Array.from(content.matchAll(sectPrRegex));

    console.log(`Found ${matches.length} sectPr elements in document.xml`);

    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const openingTag = lastMatch[1];
      let sectPrContent = lastMatch[2];
      const closingTag = lastMatch[3];
      const existingSectPr = lastMatch[0];

      console.log('Original sectPr opening tag:', openingTag);
      console.log('Original sectPr content length:', sectPrContent.length);

      const pgSzPattern = /<w:pgSz[^>]*\/>/;
      const newPgSz = `<w:pgSz w:w="${widthTwips}" w:h="${heightTwips}" w:orient="${config.orientation}"/>`;
      if (pgSzPattern.test(sectPrContent)) {
        console.log('Replacing existing pgSz element');
        sectPrContent = sectPrContent.replace(pgSzPattern, newPgSz);
      } else {
        console.log('Adding new pgSz element');
        sectPrContent = `${newPgSz}${sectPrContent}`;
      }

      const pgMarPattern = /<w:pgMar[^>]*\/>/;
      const newPgMar = `<w:pgMar w:top="${marginTop}" w:right="${marginRight}" w:bottom="${marginBottom}" w:left="${marginLeft}" w:header="${headerMargin}" w:footer="${footerMargin}" w:gutter="${gutter}"/>`;
      if (pgMarPattern.test(sectPrContent)) {
        console.log('Replacing existing pgMar element');
        sectPrContent = sectPrContent.replace(pgMarPattern, newPgMar);
      } else {
        console.log('Adding new pgMar element');
        sectPrContent = `${newPgMar}${sectPrContent}`;
      }

      console.log('Modified sectPr content length:', sectPrContent.length);

      const newSectPr = `${openingTag}${sectPrContent}${closingTag}`;
      const lastIndex = content.lastIndexOf(existingSectPr);
      content = content.substring(0, lastIndex) + newSectPr + content.substring(lastIndex + existingSectPr.length);

      console.log('Replaced sectPr at index:', lastIndex);
    } else if (content.includes('</w:body>')) {
      console.log('No sectPr found, adding new one before </w:body>');
      const sectPrContent = `<w:sectPr><w:pgSz w:w="${widthTwips}" w:h="${heightTwips}" w:orient="${config.orientation}"/><w:pgMar w:top="${marginTop}" w:right="${marginRight}" w:bottom="${marginBottom}" w:left="${marginLeft}" w:header="${headerMargin}" w:footer="${footerMargin}" w:gutter="${gutter}"/></w:sectPr>`;
      content = content.replace('</w:body>', `${sectPrContent}</w:body>`);
    }

    if (!validateXmlBasicStructure(content, 'document.xml')) {
      throw new Error('Invalid XML structure in document.xml after applying page settings');
    }
    zip.file('word/document.xml', content);
  } catch (error) {
    console.error('Error applying page settings:', error);
    throw error;
  }
};

export const applyTypographySettings = (zip: PizZip, config: DocxLayoutConfig): void => {
  try {
    const stylesXml = zip.file('word/styles.xml');
    if (!stylesXml) {
      console.warn('styles.xml not found, skipping typography settings');
      return;
    }

    let content = stylesXml.asText();
    if (!content) {
      console.warn('styles.xml is empty, skipping typography settings');
      return;
    }

    const bodyFontSize = ptToHalfPoints(config.body_font_size);
    const headingFontSize = ptToHalfPoints(config.heading_font_size);
    const lineSpacing = lineSpacingToTwips(config.line_spacing);
    const spacingBefore = ptToTwips(config.paragraph_spacing_before);
    const spacingAfter = ptToTwips(config.paragraph_spacing_after);
    const firstLineIndent = cmToTwips(config.first_line_indent);
    const alignment = getAlignmentValue(config.text_align);

    const normalStylePattern = /<w:style[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/;
    const normalStyleMatch = content.match(normalStylePattern);

    if (normalStyleMatch) {
      let normalStyle = normalStyleMatch[0];

      const rPrPattern = /<w:rPr>[\s\S]*?<\/w:rPr>/;
      const newRPr = `<w:rPr><w:rFonts w:ascii="${config.font_family}" w:hAnsi="${config.font_family}" w:eastAsia="${config.font_family}" w:cs="${config.font_family}"/><w:sz w:val="${bodyFontSize}"/><w:szCs w:val="${bodyFontSize}"/></w:rPr>`;

      if (rPrPattern.test(normalStyle)) {
        normalStyle = normalStyle.replace(rPrPattern, newRPr);
      } else if (normalStyle.includes('</w:style>')) {
        normalStyle = normalStyle.replace('</w:style>', `${newRPr}</w:style>`);
      }

      const pPrPattern = /<w:pPr>[\s\S]*?<\/w:pPr>/;
      const newPPr = `<w:pPr><w:spacing w:line="${lineSpacing}" w:lineRule="auto" w:before="${spacingBefore}" w:after="${spacingAfter}"/><w:jc w:val="${alignment}"/><w:ind w:firstLine="${firstLineIndent}"/></w:pPr>`;

      if (pPrPattern.test(normalStyle)) {
        normalStyle = normalStyle.replace(pPrPattern, newPPr);
      } else if (normalStyle.includes('</w:style>')) {
        normalStyle = normalStyle.replace('</w:style>', `${newPPr}</w:style>`);
      }

      content = content.replace(normalStyleMatch[0], normalStyle);
    }

    const headingPattern = /<w:style[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?<\/w:style>/;
    const headingMatch = content.match(headingPattern);

    if (headingMatch) {
      let headingStyle = headingMatch[0];

      const rPrPattern = /<w:rPr>[\s\S]*?<\/w:rPr>/;
      if (rPrPattern.test(headingStyle)) {
        headingStyle = headingStyle.replace(/<w:sz w:val="\d+"\/>/g, `<w:sz w:val="${headingFontSize}"/>`);
        headingStyle = headingStyle.replace(/<w:szCs w:val="\d+"\/>/g, `<w:szCs w:val="${headingFontSize}"/>`);
      }

      content = content.replace(headingMatch[0], headingStyle);
    }

    zip.file('word/styles.xml', content);
  } catch (error) {
    console.error('Error applying typography settings:', error);
    throw error;
  }
};

const getImageDimensions = (base64Image: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = base64Image;
  });
};

const getNextAvailableRId = (xml: string): string => {
  const rIdPattern = /rId(\d+)/g;
  let maxId = 0;
  let match;

  while ((match = rIdPattern.exec(xml)) !== null) {
    const id = parseInt(match[1], 10);
    if (id > maxId) {
      maxId = id;
    }
  }

  return `rId${maxId + 1}`;
};

const validateXmlBasicStructure = (xml: string, filename: string): boolean => {
  try {
    if (!xml || xml.trim().length === 0) {
      console.error(`${filename} is empty`);
      return false;
    }

    const hasXmlDeclaration = xml.trim().startsWith('<?xml');
    if (!hasXmlDeclaration && filename.endsWith('.xml')) {
      console.warn(`${filename} missing XML declaration`);
    }

    const tagStack: string[] = [];
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9:._-]*)[^>]*?(\/?)>/g;
    let match;

    while ((match = tagPattern.exec(xml)) !== null) {
      const isClosing = match[0].startsWith('</');
      const isSelfClosing = match[2] === '/';
      const tagName = match[1];

      if (isSelfClosing) {
        continue;
      }

      if (isClosing) {
        const lastOpen = tagStack.pop();
        if (lastOpen !== tagName) {
          console.error(`Tag mismatch in ${filename}: expected </${lastOpen}>, found </${tagName}>`);
          return false;
        }
      } else {
        tagStack.push(tagName);
      }
    }

    if (tagStack.length > 0) {
      console.error(`Unclosed tags in ${filename}:`, tagStack);
      return false;
    }

    console.log(`${filename} structure validated successfully`);
    return true;
  } catch (error) {
    console.error(`XML validation error for ${filename}:`, error);
    return false;
  }
};

export const insertLetterheadHeader = async (
  zip: PizZip,
  letterheadBase64: string,
  config: DocxLayoutConfig
): Promise<void> => {
  try {
    const base64Data = letterheadBase64.split(',')[1];
    if (!base64Data) {
      console.error('Invalid base64 image data');
      return;
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imageExt = letterheadBase64.includes('image/png') ? 'png' : 'jpeg';
    const imagePath = `word/media/letterhead.${imageExt}`;

    console.log('Embedding letterhead image:', { imageExt, imagePath, bytesLength: bytes.length });

    const mediaFolder = zip.folder('word/media');
    if (mediaFolder) {
      const otherExt = imageExt === 'png' ? 'jpeg' : 'png';
      const oldImagePath = `word/media/letterhead.${otherExt}`;

      if (zip.file(oldImagePath)) {
        console.log(`Removing old letterhead image: ${oldImagePath}`);
        zip.remove(oldImagePath);
      }

      zip.file(imagePath, bytes);
      console.log('Image file added to zip');
    } else {
      console.error('Media folder not found in template');
      return;
    }

    let contentTypesXml = zip.file('[Content_Types].xml')?.asText() || '';
    if (contentTypesXml) {
      const imageContentType = imageExt === 'png' ? 'image/png' : 'image/jpeg';
      const imageExtension = `.${imageExt}`;

      const extensionPattern = new RegExp(`<Default Extension="${imageExt}"[^>]*\/>`);
      if (!extensionPattern.test(contentTypesXml)) {
        console.log(`Adding ${imageExt} content type to [Content_Types].xml`);
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          `  <Default Extension="${imageExt}" ContentType="${imageContentType}"/>\n</Types>`
        );
        zip.file('[Content_Types].xml', contentTypesXml);
      } else {
        console.log(`${imageExt} content type already exists in [Content_Types].xml`);
      }
    }

    const dimensions = await getImageDimensions(letterheadBase64);

    const pageSize = PAGE_SIZES[config.page_size] || PAGE_SIZES['A4'];
    const pageWidthCm = config.orientation === 'landscape' ? pageSize.height : pageSize.width;
    const usableWidthCm = pageWidthCm - config.margin_left - config.margin_right;

    const imageWidthEMUs = Math.round(usableWidthCm * 360000);

    const aspectRatio = dimensions.height / dimensions.width;
    const imageHeightEMUs = Math.round(imageWidthEMUs * aspectRatio);

    console.log('Image dimensions:', {
      widthPx: dimensions.width,
      heightPx: dimensions.height,
      aspectRatio,
      widthEMUs: imageWidthEMUs,
      heightEMUs: imageHeightEMUs,
      usableWidthCm
    });

    const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="${imageWidthEMUs}" cy="${imageHeightEMUs}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="1" name="Letterhead"/>
          <wp:cNvGraphicFramePr/>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic>
                <pic:nvPicPr>
                  <pic:cNvPr id="0" name="Letterhead"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="rId1"/>
                  <a:stretch>
                    <a:fillRect/>
                  </a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${imageWidthEMUs}" cy="${imageHeightEMUs}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect">
                    <a:avLst/>
                  </a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>
</w:hdr>`;

    if (!validateXmlBasicStructure(headerXml, 'header1.xml')) {
      throw new Error('Invalid XML structure in generated header1.xml');
    }
    zip.file('word/header1.xml', headerXml);

    const headerRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/letterhead.${imageExt}"/>
</Relationships>`;

    if (!validateXmlBasicStructure(headerRelsXml, 'header1.xml.rels')) {
      throw new Error('Invalid XML structure in generated header1.xml.rels');
    }

    const relsFolder = zip.folder('word/_rels');
    if (relsFolder) {
      zip.file('word/_rels/header1.xml.rels', headerRelsXml);
    }

    let documentXml = zip.file('word/document.xml')?.asText() || '';
    if (!documentXml) {
      console.error('document.xml not found');
      return;
    }

    if (!validateXmlBasicStructure(documentXml, 'document.xml (original)')) {
      console.error('Template document.xml has invalid XML structure');
      return;
    }

    let documentRelsXml = zip.file('word/_rels/document.xml.rels')?.asText() || '';
    if (!documentRelsXml) {
      console.error('document.xml.rels not found');
      return;
    }

    if (!validateXmlBasicStructure(documentRelsXml, 'document.xml.rels (original)')) {
      console.error('Template document.xml.rels has invalid XML structure');
      return;
    }

    const headerRId = getNextAvailableRId(documentRelsXml);
    console.log('Assigned header rId:', headerRId);

    const sectPrPattern = /(<w:sectPr[^>]*>)([\s\S]*?)(<\/w:sectPr>)/g;
    const sectPrMatches = Array.from(documentXml.matchAll(sectPrPattern));

    console.log(`Found ${sectPrMatches.length} sectPr elements for header insertion`);

    if (sectPrMatches.length > 0) {
      const lastMatch = sectPrMatches[sectPrMatches.length - 1];
      const openingTag = lastMatch[1];
      let sectPrContent = lastMatch[2];
      const closingTag = lastMatch[3];
      const fullMatch = lastMatch[0];

      console.log('sectPr opening tag for header:', openingTag);

      const hasExistingHeader = sectPrContent.includes('<w:headerReference');
      console.log('Has existing headerReference:', hasExistingHeader);

      if (hasExistingHeader) {
        console.log('Replacing existing headerReference');
        const headerRefPattern = /<w:headerReference[^>]*\/>/;
        sectPrContent = sectPrContent.replace(headerRefPattern, `<w:headerReference w:type="default" r:id="${headerRId}"/>`);
      } else {
        console.log('Adding new headerReference to sectPr');
        sectPrContent = `<w:headerReference w:type="default" r:id="${headerRId}"/>${sectPrContent}`;
      }

      const newSectPr = `${openingTag}${sectPrContent}${closingTag}`;
      const lastIndex = documentXml.lastIndexOf(fullMatch);
      console.log('Replacing sectPr at index:', lastIndex);
      documentXml = documentXml.substring(0, lastIndex) + newSectPr + documentXml.substring(lastIndex + fullMatch.length);

      if (!validateXmlBasicStructure(documentXml, 'document.xml')) {
        throw new Error('Invalid XML structure in document.xml after adding/updating header reference');
      }
      zip.file('word/document.xml', documentXml);
      console.log('Header reference updated successfully');
    }

    const hasHeaderRel = documentRelsXml.includes('header1.xml');
    console.log('document.xml.rels already has header1.xml relationship:', hasHeaderRel);

    if (hasHeaderRel) {
      console.log('Updating existing header1.xml relationship');
      const headerRelPattern = /<Relationship[^>]*Target="header1\.xml"[^>]*\/>/;
      documentRelsXml = documentRelsXml.replace(
        headerRelPattern,
        `<Relationship Id="${headerRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`
      );
    } else {
      console.log('Adding new header1.xml relationship');
      documentRelsXml = documentRelsXml.replace(
        '</Relationships>',
        `  <Relationship Id="${headerRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>\n</Relationships>`
      );
    }

    if (!validateXmlBasicStructure(documentRelsXml, 'document.xml.rels')) {
      throw new Error('Invalid XML structure in document.xml.rels after updating header relationship');
    }
    zip.file('word/_rels/document.xml.rels', documentRelsXml);
    console.log('Header relationship updated in document.xml.rels');

    contentTypesXml = zip.file('[Content_Types].xml')?.asText() || '';

    if (contentTypesXml && !contentTypesXml.includes('/word/header1.xml')) {
      console.log('Adding header1.xml content type to [Content_Types].xml');
      contentTypesXml = contentTypesXml.replace(
        '</Types>',
        `  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n</Types>`
      );

      if (!validateXmlBasicStructure(contentTypesXml, '[Content_Types].xml')) {
        throw new Error('Invalid XML structure in [Content_Types].xml after adding header content type');
      }
      zip.file('[Content_Types].xml', contentTypesXml);
      console.log('Content type added to [Content_Types].xml');
    } else {
      console.log('[Content_Types].xml already has header1.xml content type');
    }

  } catch (error) {
    console.error('Error inserting letterhead header:', error);
    throw error;
  }
};

export const enforceDocxLayout = async (
  zip: PizZip,
  config: DocxLayoutConfig,
  letterheadBase64?: string
): Promise<PizZip> => {
  try {
    console.log('Enforcing DOCX layout...');
    applyPageSettings(zip, config);
    console.log('Page settings applied');
    applyTypographySettings(zip, config);
    console.log('Typography settings applied');

    if (letterheadBase64) {
      console.log('Inserting letterhead header...');
      await insertLetterheadHeader(zip, letterheadBase64, config);
      console.log('Letterhead header inserted');
    } else {
      console.log('No letterhead base64 provided, skipping header insertion');
    }

    const allFiles = Object.keys(zip.files);
    console.log('All files in DOCX zip:', allFiles);
    console.log('Total files:', allFiles.length);

    return zip;
  } catch (error) {
    console.error('Error enforcing DOCX layout:', error);
    return zip;
  }
};
