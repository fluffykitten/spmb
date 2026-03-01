/*
  # Add Admin Comments to Applicants

  1. Changes
    - Add `admin_comments` column to `applicants` table for storing admin feedback
    - Add `commented_by` column to track which admin user added/updated the comment
    - Add `commented_at` column to track when the comment was last updated
    - Create index on `commented_by` for better query performance

  2. Security
    - Admins can read and write comments
    - Students can only read comments on their own applications
    - Comments are visible to students only after being added by admins
*/

-- Add admin comments columns to applicants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'admin_comments'
  ) THEN
    ALTER TABLE applicants ADD COLUMN admin_comments text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'commented_by'
  ) THEN
    ALTER TABLE applicants ADD COLUMN commented_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'commented_at'
  ) THEN
    ALTER TABLE applicants ADD COLUMN commented_at timestamptz;
  END IF;
END $$;

-- Create index on commented_by for better query performance
CREATE INDEX IF NOT EXISTS idx_applicants_commented_by ON applicants(commented_by);

-- Add comment to explain the columns
COMMENT ON COLUMN applicants.admin_comments IS 'Comments or feedback from admin to the applicant';
COMMENT ON COLUMN applicants.commented_by IS 'UUID of the admin user who last updated the comment';
COMMENT ON COLUMN applicants.commented_at IS 'Timestamp when the comment was last updated';
