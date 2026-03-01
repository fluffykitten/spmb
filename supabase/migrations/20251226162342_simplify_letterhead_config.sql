/*
  # Simplify Letterhead Configuration

  ## Overview
  This migration simplifies the letterhead configuration system to use a single pre-designed
  letterhead image instead of separate components (logo, foundation logo, stamp, text fields).

  ## Changes

  ### New Column
  - `letterhead_image_url`: Single field to store the complete letterhead image
    (replaces: school_logo_url, foundation_logo_url, stamp_image_url, and text fields)

  ### Data Migration
  - Existing `school_logo_url` values are migrated to `letterhead_image_url`
  - Old fields are kept for backwards compatibility but considered deprecated

  ## Benefits
  - Simpler admin UI (single image upload)
  - More flexibility (admins design letterhead externally)
  - Easier to enforce as document header
  - Better visual consistency

  ## Security
  - RLS policies remain unchanged
  - Existing policies still work
*/

-- Add new letterhead_image_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letterhead_config' AND column_name = 'letterhead_image_url'
  ) THEN
    ALTER TABLE letterhead_config ADD COLUMN letterhead_image_url TEXT;
  END IF;
END $$;

-- Migrate existing school_logo_url to letterhead_image_url if not already set
UPDATE letterhead_config
SET letterhead_image_url = school_logo_url
WHERE letterhead_image_url IS NULL
  AND school_logo_url IS NOT NULL
  AND school_logo_url != '';

-- Add comment to indicate the new preferred field
COMMENT ON COLUMN letterhead_config.letterhead_image_url IS
  'Primary field for letterhead image. Contains a complete pre-designed letterhead with logo, school name, address, etc.';

-- Add comments to deprecated fields
COMMENT ON COLUMN letterhead_config.school_logo_url IS
  'DEPRECATED: Use letterhead_image_url instead. Kept for backwards compatibility.';

COMMENT ON COLUMN letterhead_config.foundation_logo_url IS
  'DEPRECATED: Use letterhead_image_url instead. Kept for backwards compatibility.';

COMMENT ON COLUMN letterhead_config.stamp_image_url IS
  'DEPRECATED: Use letterhead_image_url instead. Kept for backwards compatibility.';

COMMENT ON COLUMN letterhead_config.school_name IS
  'DEPRECATED: Include in letterhead_image_url design instead.';

COMMENT ON COLUMN letterhead_config.school_address IS
  'DEPRECATED: Include in letterhead_image_url design instead.';

COMMENT ON COLUMN letterhead_config.school_phone IS
  'DEPRECATED: Include in letterhead_image_url design instead.';

COMMENT ON COLUMN letterhead_config.school_email IS
  'DEPRECATED: Include in letterhead_image_url design instead.';

COMMENT ON COLUMN letterhead_config.school_website IS
  'DEPRECATED: Include in letterhead_image_url design instead.';
