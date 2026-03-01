/*
  # Enhance Letter Templates with Full Customization

  ## Overview
  This migration adds comprehensive customization options for letter templates including:
  - Letterhead configuration (logos, school info)
  - Typography and styling options
  - Letter numbering system
  - Signature configuration
  - Page layout settings

  ## New Columns Added to letter_templates

  1. **letterhead_config** (JSONB)
     - school_logo_url, foundation_logo_url
     - school_name, foundation_name, address, phone, email, website
     - letterhead_type, logo_position, logo_size

  2. **typography_config** (JSONB)
     - font_family, title_font_size, body_font_size
     - line_height, paragraph_spacing, text_align
     - title_bold, title_underline

  3. **letter_number_config** (JSONB)
     - prefix, separator, middle_code, suffix
     - format_pattern, counter_reset, auto_increment
     - Example: "001/PPDB/SMK/2025"

  4. **signature_config** (JSONB)
     - signer_name, signer_title, signer_nip
     - signature_image_url, show_signature_image
     - show_stamp, stamp_image_url
     - signature_position, signature_city, show_date

  5. **layout_config** (JSONB)
     - page_size, margin_top, margin_bottom, margin_left, margin_right
     - orientation, show_page_number
     - watermark_text, watermark_opacity

  6. **pdf_source_url** (TEXT)
     - URL to original uploaded PDF template

  7. **usage_count** (INTEGER)
     - Track how many times template has been used

  ## Security
  - All new columns have default values
  - Existing templates will work without modification
  - RLS policies remain unchanged
*/

-- Add letterhead configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'letterhead_config'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN letterhead_config JSONB DEFAULT '{
      "school_name": "",
      "foundation_name": "",
      "address": "",
      "phone": "",
      "email": "",
      "website": "",
      "school_logo_url": "",
      "foundation_logo_url": "",
      "letterhead_type": "school",
      "logo_position": "center",
      "logo_size": 80
    }'::JSONB;
  END IF;
END $$;

-- Add typography configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'typography_config'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN typography_config JSONB DEFAULT '{
      "font_family": "Times New Roman",
      "title_font_size": 14,
      "body_font_size": 12,
      "line_height": 1.5,
      "paragraph_spacing": 12,
      "text_align": "justify",
      "title_bold": true,
      "title_underline": false
    }'::JSONB;
  END IF;
END $$;

-- Add letter number configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'letter_number_config'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN letter_number_config JSONB DEFAULT '{
      "prefix": "001",
      "separator": "/",
      "middle_code": "PPDB",
      "suffix": "2025",
      "format_pattern": "{counter}/{middle}/{suffix}",
      "counter_reset": "yearly",
      "auto_increment": true
    }'::JSONB;
  END IF;
END $$;

-- Add signature configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'signature_config'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN signature_config JSONB DEFAULT '{
      "signer_name": "",
      "signer_title": "Kepala Sekolah",
      "signer_nip": "",
      "signature_image_url": "",
      "show_signature_image": false,
      "show_stamp": false,
      "stamp_image_url": "",
      "signature_position": "right",
      "signature_city": "",
      "show_date": true
    }'::JSONB;
  END IF;
END $$;

-- Add layout configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'layout_config'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN layout_config JSONB DEFAULT '{
      "page_size": "A4",
      "margin_top": 2.5,
      "margin_bottom": 2.5,
      "margin_left": 3,
      "margin_right": 3,
      "orientation": "portrait",
      "show_page_number": false,
      "watermark_text": "",
      "watermark_opacity": 0.1
    }'::JSONB;
  END IF;
END $$;

-- Add PDF source URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'pdf_source_url'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN pdf_source_url TEXT;
  END IF;
END $$;

-- Add usage count
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN usage_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add is_active flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;