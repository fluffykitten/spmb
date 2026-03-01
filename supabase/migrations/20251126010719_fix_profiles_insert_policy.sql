/*
  # Fix Profiles Insert Policy for New Users

  ## Description
  This migration fixes the profiles insert policy to allow new users to create
  their own profile during registration, in addition to allowing admins to create profiles.

  ## Changes
  1. Add policy for new users to insert their own profile during registration
  2. Keep existing admin insert policy

  ## Security
  - Users can only insert their own profile (user_id = auth.uid())
  - Users can only set role to 'student' for themselves
  - Admins retain ability to create any profile

  ## Notes
  - This works as backup to the database trigger
  - Ensures registration succeeds even if trigger fails
*/

-- Drop existing insert policies
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow admins to insert any profile
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Allow new users to insert their own profile during registration
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND role = 'student'
  );

-- Add comment
COMMENT ON POLICY "Users can insert own profile" ON profiles IS 
  'Allows new users to create their own student profile during registration';
