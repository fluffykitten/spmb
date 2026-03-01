/*
  # Fix Exam Tokens RLS Policies

  ## Changes
  - Fix all RLS policies to use profiles.user_id instead of profiles.id
  - This corrects the authentication check for admin access
  
  ## Security
  - Maintains admin-only access to token management
  - Properly authenticates users via auth.uid()
*/

DROP POLICY IF EXISTS "Admins can view all tokens" ON exam_tokens;
DROP POLICY IF EXISTS "Admins can create tokens" ON exam_tokens;
DROP POLICY IF EXISTS "Admins can update tokens" ON exam_tokens;
DROP POLICY IF EXISTS "Admins can delete tokens" ON exam_tokens;

CREATE POLICY "Admins can view all tokens"
  ON exam_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create tokens"
  ON exam_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update tokens"
  ON exam_tokens FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tokens"
  ON exam_tokens FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
