/*
  # Fix Exam Tokens RLS Insert Policy

  ## Changes
  - Fix RLS policies for exam_tokens to allow admin insert operations
  - Split ALL policy into separate SELECT, INSERT, UPDATE, DELETE policies
  - Ensure assigned_by field matches authenticated user

  ## Security
  - Only admins can create, update, and delete tokens
  - System can log token usage
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Admins can manage all tokens" ON exam_tokens;

-- Create separate policies for each operation
CREATE POLICY "Admins can view all tokens"
  ON exam_tokens FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create tokens"
  ON exam_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    AND assigned_by = auth.uid()
  );

CREATE POLICY "Admins can update tokens"
  ON exam_tokens FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tokens"
  ON exam_tokens FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Fix token usage insert policy to allow any authenticated user
DROP POLICY IF EXISTS "System can insert token usage" ON exam_token_usage;

CREATE POLICY "Authenticated users can log token usage"
  ON exam_token_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);
