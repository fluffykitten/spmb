/*
  # Simplify Exam Tokens Insert Policy

  ## Changes
  - Simplify insert policy to only check admin role
  - Remove assigned_by check from WITH CHECK clause
  - The assigned_by field will be set by the application

  ## Security
  - Only admins can create tokens
  - Application is responsible for setting assigned_by correctly
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admins can create tokens" ON exam_tokens;

-- Create simplified insert policy
CREATE POLICY "Admins can create tokens"
  ON exam_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
