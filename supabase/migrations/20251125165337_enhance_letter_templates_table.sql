/*
  # Enhance letter_templates table

  ## Description
  Add description and variables fields to letter_templates table
  for better template management and documentation.

  ## Changes
  - Add `description` field for template documentation
  - Add `variables` JSONB field to store available template variables
  - Add `template_type` field to categorize templates

  ## Notes
  - Uses IF NOT EXISTS checks to prevent errors if columns already exist
  - Variables field stores array of variable names used in template
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'description'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'variables'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN variables jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'template_type'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN template_type text DEFAULT 'general';
  END IF;
END $$;
