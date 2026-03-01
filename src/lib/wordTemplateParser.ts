import mammoth from 'mammoth';

export interface ParsedTemplate {
  htmlContent: string;
  variables: DetectedVariable[];
  hasComplexFormatting: boolean;
  complexElements: ComplexElement[];
}

export interface DetectedVariable {
  original: string;
  normalized: string;
  format: 'double_curly' | 'single_curly' | 'square';
  occurrences: number;
}

export interface ComplexElement {
  type: 'table' | 'image' | 'shape' | 'textbox' | 'equation';
  description: string;
}

export const parseDocxToHTML = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => h2.subtitle:fresh",
      ],
      ignoreEmptyParagraphs: false,
      convertImage: mammoth.images.inline((element) => {
        return { src: element.read('base64').then((imageBuffer) => {
          return `data:${element.contentType};base64,${imageBuffer}`;
        })};
      })
    }
  );

  return result.value;
};

export const detectComplexFormatting = (html: string): ComplexElement[] => {
  const complexElements: ComplexElement[] = [];

  if (html.includes('<table')) {
    const tableCount = (html.match(/<table/g) || []).length;
    complexElements.push({
      type: 'table',
      description: `${tableCount} tabel terdeteksi (akan dikonversi ke HTML table)`
    });
  }

  if (html.includes('<img')) {
    const imageCount = (html.match(/<img/g) || []).length;
    complexElements.push({
      type: 'image',
      description: `${imageCount} gambar terdeteksi (akan di-embed sebagai base64)`
    });
  }

  if (html.includes('shape') || html.includes('v:')) {
    complexElements.push({
      type: 'shape',
      description: 'Shape/drawing objects terdeteksi (mungkin tidak terkonversi sempurna)'
    });
  }

  if (html.includes('text-box') || html.includes('mso-element:frame')) {
    complexElements.push({
      type: 'textbox',
      description: 'Text box terdeteksi (akan dikonversi ke paragraf biasa)'
    });
  }

  return complexElements;
};

export const detectVariables = (html: string): DetectedVariable[] => {
  const variableMap = new Map<string, DetectedVariable>();

  const patterns = [
    { regex: /\{\{([^}]+)\}\}/g, format: 'double_curly' as const },
    { regex: /\{([^}]+)\}/g, format: 'single_curly' as const },
    { regex: /\[([^\]]+)\]/g, format: 'square' as const }
  ];

  patterns.forEach(({ regex, format }) => {
    const matches = html.matchAll(regex);
    for (const match of matches) {
      const original = match[1].trim();

      if (original.length === 0 || original.length > 100) continue;
      if (/^[0-9]+$/.test(original)) continue;
      if (original.includes('<') || original.includes('>')) continue;

      const normalized = normalizeVariableName(original);
      const key = normalized;

      if (variableMap.has(key)) {
        const existing = variableMap.get(key)!;
        existing.occurrences++;
      } else {
        variableMap.set(key, {
          original,
          normalized,
          format,
          occurrences: 1
        });
      }
    }
  });

  return Array.from(variableMap.values()).sort((a, b) =>
    a.normalized.localeCompare(b.normalized)
  );
};

export const normalizeVariableName = (name: string): string => {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
};

export const replaceVariablesInHTML = (
  html: string,
  variables: DetectedVariable[]
): string => {
  let processedHtml = html;

  variables.forEach(variable => {
    const patterns = [
      new RegExp(`\\{\\{${escapeRegex(variable.original)}\\}\\}`, 'g'),
      new RegExp(`\\{${escapeRegex(variable.original)}\\}`, 'g'),
      new RegExp(`\\[${escapeRegex(variable.original)}\\]`, 'g')
    ];

    patterns.forEach(pattern => {
      processedHtml = processedHtml.replace(
        pattern,
        `{{${variable.normalized}}}`
      );
    });
  });

  return processedHtml;
};

export const sanitizeWordHTML = (html: string): string => {
  let cleaned = html;

  cleaned = cleaned.replace(/\s*mso-[^;:]+:[^;"]+;?/gi, '');
  cleaned = cleaned.replace(/\s*style="[^"]*"/gi, (match) => {
    if (match.includes('font-weight') ||
        match.includes('text-align') ||
        match.includes('font-size') ||
        match.includes('text-decoration')) {
      return match;
    }
    return '';
  });

  cleaned = cleaned.replace(/<o:p><\/o:p>/gi, '');
  cleaned = cleaned.replace(/<\/?span[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?font[^>]*>/gi, '');

  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/>\s+</g, '><');

  return cleaned.trim();
};

export const parseWordTemplate = async (file: File): Promise<ParsedTemplate> => {
  let rawHtml = await parseDocxToHTML(file);

  rawHtml = sanitizeWordHTML(rawHtml);

  const complexElements = detectComplexFormatting(rawHtml);
  const hasComplexFormatting = complexElements.length > 0;

  const variables = detectVariables(rawHtml);

  const htmlContent = replaceVariablesInHTML(rawHtml, variables);

  return {
    htmlContent,
    variables,
    hasComplexFormatting,
    complexElements
  };
};

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const validateVariableName = (name: string): boolean => {
  return /^[A-Z][A-Z0-9_]*$/.test(name) && name.length > 0 && name.length <= 50;
};

export const generateVariableMapping = (
  variables: DetectedVariable[]
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  variables.forEach(v => {
    mapping[v.original] = v.normalized;
  });
  return mapping;
};
