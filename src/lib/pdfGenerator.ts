import jsPDF from 'jspdf';
import mammoth from 'mammoth';
import { supabase } from './supabase';
import { MappedVariables } from './variableMapping';
import { DocxLayoutConfig, PAGE_SIZES } from './layoutConstants';

interface LetterheadConfig {
  letterhead_image_url?: string;
  school_name?: string;
  school_address?: string;
  school_phone?: string;
  school_email?: string;
}

interface PdfGenerationOptions {
  templateUrl: string;
  variables: MappedVariables;
  letterheadConfig?: LetterheadConfig;
  layoutConfig?: DocxLayoutConfig;
  fileName: string;
}

const loadImageAsBase64 = async (
  bucket: string,
  path: string
): Promise<string | null> => {
  if (!path) return null;

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error || !data) {
      console.error(`Failed to load image from ${bucket}/${path}:`, error);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );

    const mimeType = data.type || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error(`Error loading image:`, error);
    return null;
  }
};

const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
};

const replaceVariables = (content: string, variables: MappedVariables): string => {
  let result = content;

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\s*${key}\\s*\\}`, 'g');
    result = result.replace(regex, String(value || ''));
  });

  result = result.replace(/\{.*?\}/g, '');

  return result;
};

export const generatePdfFromTemplate = async (
  options: PdfGenerationOptions
): Promise<Blob> => {
  const { templateUrl, variables, letterheadConfig, layoutConfig } = options;

  const templateContent = await loadTemplateContent(templateUrl);

  const config = layoutConfig || {
    page_size: 'A4',
    orientation: 'portrait',
    margin_top: 2.54,
    margin_bottom: 2.54,
    margin_left: 3.17,
    margin_right: 3.17,
    header_margin: 1.27,
    footer_margin: 1.27,
    font_family: 'Times New Roman',
    body_font_size: 12,
    heading_font_size: 14,
    line_spacing: 1.5,
    paragraph_spacing_before: 0,
    paragraph_spacing_after: 8,
    text_align: 'justify',
    first_line_indent: 0,
    gutter: 0
  };

  const pageSize = PAGE_SIZES[config.page_size] || PAGE_SIZES['A4'];
  const orientation = config.orientation === 'landscape' ? 'l' : 'p';

  const pdf = new jsPDF({
    orientation,
    unit: 'cm',
    format: [pageSize.width, pageSize.height]
  });

  let letterheadBase64: string | null = null;
  if (letterheadConfig?.letterhead_image_url) {
    letterheadBase64 = await loadImageAsBase64(
      'letterhead-images',
      letterheadConfig.letterhead_image_url
    );
  }

  if (letterheadBase64) {
    try {
      const dimensions = await getImageDimensions(letterheadBase64);
      const pageWidthCm = config.orientation === 'landscape' ? pageSize.height : pageSize.width;
      const usableWidthCm = pageWidthCm - config.margin_left - config.margin_right;

      const aspectRatio = dimensions.height / dimensions.width;
      const imageHeightCm = usableWidthCm * aspectRatio;

      pdf.addImage(
        letterheadBase64,
        'PNG',
        config.margin_left,
        config.header_margin,
        usableWidthCm,
        imageHeightCm
      );
    } catch (error) {
      console.error('Error adding letterhead:', error);
    }
  }

  const processedContent = replaceVariables(templateContent, variables);

  const fontMap: Record<string, string> = {
    'Times New Roman': 'times',
    'Arial': 'helvetica',
    'Courier New': 'courier'
  };
  const fontFamily = fontMap[config.font_family] || 'times';
  pdf.setFont(fontFamily);
  pdf.setFontSize(config.body_font_size);

  const pageWidthCm = config.orientation === 'landscape' ? pageSize.height : pageSize.width;
  const pageHeightCm = config.orientation === 'landscape' ? pageSize.width : pageSize.height;
  const usableWidthCm = pageWidthCm - config.margin_left - config.margin_right;

  let yPosition = config.margin_top;

  if (letterheadBase64) {
    const dimensions = await getImageDimensions(letterheadBase64);
    const aspectRatio = dimensions.height / dimensions.width;
    const imageHeightCm = usableWidthCm * aspectRatio;
    yPosition = config.header_margin + imageHeightCm + 0.5;
  }

  const lineHeightCm = (config.body_font_size * 0.0353) * config.line_spacing;

  const lines = processedContent.split('\n');

  for (const line of lines) {
    if (!line.trim()) {
      yPosition += lineHeightCm;
      continue;
    }

    if (yPosition + lineHeightCm > pageHeightCm - config.margin_bottom) {
      pdf.addPage();
      yPosition = config.margin_top;

      if (letterheadBase64) {
        try {
          const dimensions = await getImageDimensions(letterheadBase64);
          const aspectRatio = dimensions.height / dimensions.width;
          const imageHeightCm = usableWidthCm * aspectRatio;

          pdf.addImage(
            letterheadBase64,
            'PNG',
            config.margin_left,
            config.header_margin,
            usableWidthCm,
            imageHeightCm
          );

          yPosition = config.header_margin + imageHeightCm + 0.5;
        } catch (error) {
          console.error('Error adding letterhead to new page:', error);
        }
      }
    }

    const wrappedLines = pdf.splitTextToSize(line, usableWidthCm);

    for (const wrappedLine of wrappedLines) {
      if (yPosition + lineHeightCm > pageHeightCm - config.margin_bottom) {
        pdf.addPage();
        yPosition = config.margin_top;

        if (letterheadBase64) {
          try {
            const dimensions = await getImageDimensions(letterheadBase64);
            const aspectRatio = dimensions.height / dimensions.width;
            const imageHeightCm = usableWidthCm * aspectRatio;

            pdf.addImage(
              letterheadBase64,
              'PNG',
              config.margin_left,
              config.header_margin,
              usableWidthCm,
              imageHeightCm
            );

            yPosition = config.header_margin + imageHeightCm + 0.5;
          } catch (error) {
            console.error('Error adding letterhead to new page:', error);
          }
        }
      }

      let xPosition = config.margin_left;
      if (config.text_align === 'center') {
        const textWidth = pdf.getTextWidth(wrappedLine);
        xPosition = config.margin_left + (usableWidthCm - textWidth) / 2;
      } else if (config.text_align === 'right') {
        const textWidth = pdf.getTextWidth(wrappedLine);
        xPosition = config.margin_left + usableWidthCm - textWidth;
      }

      pdf.text(wrappedLine, xPosition, yPosition);
      yPosition += lineHeightCm;
    }
  }

  const pdfBlob = pdf.output('blob');
  return pdfBlob;
};

export const downloadPdf = (blob: Blob, fileName: string): void => {
  const sanitizedFileName = fileName
    .replace(/[^a-z0-9_\-\.]/gi, '_')
    .replace(/_{2,}/g, '_');

  const finalFileName = sanitizedFileName.endsWith('.pdf')
    ? sanitizedFileName
    : `${sanitizedFileName}.pdf`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const generateAndDownloadPdf = async (
  options: PdfGenerationOptions
): Promise<{ success: boolean; error?: string; fileSize?: number }> => {
  try {
    const blob = await generatePdfFromTemplate(options);

    downloadPdf(blob, options.fileName);

    return {
      success: true,
      fileSize: blob.size
    };
  } catch (error) {
    console.error('Error generating PDF:', error);

    let errorMessage = 'Gagal generate dokumen. Silakan coba lagi.';

    if (error instanceof Error) {
      if (error.message.includes('image')) {
        errorMessage = 'Gagal memuat gambar kop surat.';
      }
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

export const getLetterheadConfig = async (): Promise<LetterheadConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('letterhead_config')
      .select('*')
      .eq('is_active', true)
      .eq('config_key', 'global')
      .maybeSingle();

    if (error) {
      console.error('Error fetching letterhead config:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching letterhead config:', error);
    return null;
  }
};

const loadTemplateContent = async (templateUrl: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from('docx-templates')
    .download(templateUrl);

  if (error) {
    throw new Error(`Failed to load template: ${error.message}`);
  }

  if (!data) {
    throw new Error('Template file not found');
  }

  const arrayBuffer = await data.arrayBuffer();

  const result = await mammoth.extractRawText({ arrayBuffer });

  return result.value;
};
