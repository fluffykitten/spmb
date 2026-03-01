export interface PageSizeInfo {
  width: number;
  height: number;
  widthTwips: number;
  heightTwips: number;
}

export const PAGE_SIZES: Record<string, PageSizeInfo> = {
  'A4': {
    width: 21.0,
    height: 29.7,
    widthTwips: 11906,
    heightTwips: 16838
  },
  'F4': {
    width: 21.6,
    height: 33.0,
    widthTwips: 12240,
    heightTwips: 18708
  },
  'Letter': {
    width: 21.59,
    height: 27.94,
    widthTwips: 12240,
    heightTwips: 15840
  },
  'Legal': {
    width: 21.59,
    height: 35.56,
    widthTwips: 12240,
    heightTwips: 20160
  },
  'A5': {
    width: 14.8,
    height: 21.0,
    widthTwips: 8391,
    heightTwips: 11906
  }
};

export const FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Courier New',
  'Tahoma',
  'Verdana'
];

export interface LineSpacingOption {
  label: string;
  value: number;
}

export const LINE_SPACINGS: LineSpacingOption[] = [
  { label: 'Single (1.0)', value: 1.0 },
  { label: '1.15', value: 1.15 },
  { label: '1.5', value: 1.5 },
  { label: 'Double (2.0)', value: 2.0 },
  { label: '2.5', value: 2.5 },
  { label: 'Triple (3.0)', value: 3.0 }
];

export interface TextAlignmentOption {
  label: string;
  value: 'left' | 'center' | 'right' | 'justify';
}

export const TEXT_ALIGNMENTS: TextAlignmentOption[] = [
  { label: 'Rata Kiri', value: 'left' },
  { label: 'Tengah', value: 'center' },
  { label: 'Rata Kanan', value: 'right' },
  { label: 'Rata Kiri-Kanan', value: 'justify' }
];

export interface DocxLayoutConfig {
  page_size: string;
  orientation: 'portrait' | 'landscape';
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  header_margin: number;
  footer_margin: number;
  font_family: string;
  body_font_size: number;
  heading_font_size: number;
  line_spacing: number;
  paragraph_spacing_before: number;
  paragraph_spacing_after: number;
  text_align: 'left' | 'center' | 'right' | 'justify';
  first_line_indent: number;
  gutter: number;
}

export const DEFAULT_LAYOUT_CONFIG: DocxLayoutConfig = {
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

export const cmToTwips = (cm: number): number => Math.round(cm * 567);

export const ptToHalfPoints = (pt: number): number => pt * 2;

export const ptToTwips = (pt: number): number => Math.round(pt * 20);

export const lineSpacingToTwips = (lineSpacing: number): number => Math.round(lineSpacing * 240);
