/*
  # Add Letter Access and Download Tracking Features

  ## Changes Made
  
  1. **letter_templates table enhancements**
     - Add `access_rule` column - Defines when students can access the letter
       - 'always': Available immediately after generation
       - 'after_submission': Available after student submits application
       - 'after_approval': Available only after admin approves
       - 'after_rejection': Available after admin rejects
     - Add `is_available_for_students` column - Toggle to show/hide letter from students
  
  2. **generated_letters table enhancements**
     - Add `downloaded_at` column - Timestamp of first download
     - Add `download_count` column - Number of times letter was downloaded
     - Add index on applicant_id for faster queries
  
  3. **Security**
     - Update RLS policies to allow students to read their own generated letters
     - Update RLS policies to allow students to read available letter templates
*/

-- Add access control fields to letter_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letter_templates' AND column_name = 'access_rule'
  ) THEN
    ALTER TABLE letter_templates 
    ADD COLUMN access_rule text DEFAULT 'after_submission' CHECK (access_rule IN ('always', 'after_submission', 'after_approval', 'after_rejection'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'letter_templates' AND column_name = 'is_available_for_students'
  ) THEN
    ALTER TABLE letter_templates 
    ADD COLUMN is_available_for_students boolean DEFAULT true;
  END IF;
END $$;

-- Add download tracking fields to generated_letters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generated_letters' AND column_name = 'downloaded_at'
  ) THEN
    ALTER TABLE generated_letters 
    ADD COLUMN downloaded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generated_letters' AND column_name = 'download_count'
  ) THEN
    ALTER TABLE generated_letters 
    ADD COLUMN download_count integer DEFAULT 0;
  END IF;
END $$;

-- Add index for faster student letter queries
CREATE INDEX IF NOT EXISTS idx_generated_letters_applicant_id 
ON generated_letters(applicant_id);

-- RLS Policy: Students can read their own generated letters
DROP POLICY IF EXISTS "Students can view their own generated letters" ON generated_letters;
CREATE POLICY "Students can view their own generated letters"
  ON generated_letters
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = generated_letters.applicant_id
      AND applicants.user_id = auth.uid()
    )
  );

-- RLS Policy: Students can read available letter templates
DROP POLICY IF EXISTS "Students can view available letter templates" ON letter_templates;
CREATE POLICY "Students can view available letter templates"
  ON letter_templates
  FOR SELECT
  TO authenticated
  USING (
    is_available_for_students = true
    AND is_active = true
  );

-- RLS Policy: Students can update download tracking on their own letters
DROP POLICY IF EXISTS "Students can update download tracking" ON generated_letters;
CREATE POLICY "Students can update download tracking"
  ON generated_letters
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = generated_letters.applicant_id
      AND applicants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = generated_letters.applicant_id
      AND applicants.user_id = auth.uid()
    )
  );