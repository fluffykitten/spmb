/*
  # Enhance DOCX Layout Configuration

  ## Overview
  This migration enhances the docx_layout_config JSONB field in letter_templates
  to support comprehensive layout enforcement including typography, spacing, and formatting.

  ## Enhanced Layout Configuration

  The docx_layout_config now includes:

  ### Page Settings
  - page_size: A4, F4, Letter, Legal, A5
  - orientation: portrait, landscape
  - margin_top, margin_bottom, margin_left, margin_right (in cm)
  - header_margin, footer_margin (in cm)
  - gutter (in cm)

  ### Typography Settings
  - font_family: Times New Roman, Arial, Calibri, etc.
  - body_font_size: Font size for body text (in pt)
  - heading_font_size: Font size for headings (in pt)

  ### Paragraph Settings
  - line_spacing: 1.0, 1.5, 2.0, etc.
  - paragraph_spacing_before: Space before paragraph (in pt)
  - paragraph_spacing_after: Space after paragraph (in pt)
  - text_align: left, center, right, justify
  - first_line_indent: First line indentation (in cm)

  ## Benefits
  - Layout is enforced when documents are generated
  - Consistent document formatting across all generated documents
  - Admins have full control over document appearance
  - Students get professional-looking documents

  ## Security
  - No changes to RLS policies
  - Only affects document generation logic
*/

-- Update existing docx_layout_config with enhanced fields
UPDATE letter_templates
SET docx_layout_config = COALESCE(docx_layout_config, '{}'::JSONB) || jsonb_build_object(
  'page_size', COALESCE(docx_layout_config->>'page_size', 'A4'),
  'orientation', COALESCE(docx_layout_config->>'orientation', 'portrait'),
  'margin_top', COALESCE((docx_layout_config->>'margin_top')::numeric, 2.54),
  'margin_bottom', COALESCE((docx_layout_config->>'margin_bottom')::numeric, 2.54),
  'margin_left', COALESCE((docx_layout_config->>'margin_left')::numeric, 3.17),
  'margin_right', COALESCE((docx_layout_config->>'margin_right')::numeric, 3.17),
  'header_margin', COALESCE((docx_layout_config->>'header_margin')::numeric, 1.27),
  'footer_margin', COALESCE((docx_layout_config->>'footer_margin')::numeric, 1.27),
  'font_family', COALESCE(docx_layout_config->>'font_family', 'Times New Roman'),
  'body_font_size', COALESCE((docx_layout_config->>'body_font_size')::integer, 12),
  'heading_font_size', COALESCE((docx_layout_config->>'heading_font_size')::integer, 14),
  'line_spacing', COALESCE((docx_layout_config->>'line_spacing')::numeric, 1.5),
  'paragraph_spacing_before', COALESCE((docx_layout_config->>'paragraph_spacing_before')::integer, 0),
  'paragraph_spacing_after', COALESCE((docx_layout_config->>'paragraph_spacing_after')::integer, 8),
  'text_align', COALESCE(docx_layout_config->>'text_align', 'justify'),
  'first_line_indent', COALESCE((docx_layout_config->>'first_line_indent')::numeric, 0),
  'gutter', COALESCE((docx_layout_config->>'gutter')::numeric, 0)
)
WHERE template_format = 'docx' OR docx_template_url IS NOT NULL;

-- Add helpful comment on the column
COMMENT ON COLUMN letter_templates.docx_layout_config IS
  'Comprehensive layout configuration for DOCX templates including page settings, typography, and formatting. This configuration is enforced when documents are generated.';
