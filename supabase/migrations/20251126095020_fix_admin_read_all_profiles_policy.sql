/*
  # Fix Admin Read All Profiles RLS Policy

  ## Description
  This migration fixes the RLS policy that was preventing admins from viewing
  all user profiles in the User Management page. The previous policy was checking
  the role column of the ROW being queried, not the role of the logged-in user.

  ## Problem
  Previous policy: `USING (role = 'admin' OR auth.uid() = user_id)`
  - This checks if the PROFILE being viewed has role='admin'
  - This means admins could only see admin profiles, not students
  - Students with 6 records were not visible to admin users

  ## Solution
  New policy uses a subquery to check the logged-in user's role:
  - EXISTS subquery checks if auth.uid() has role='admin' in profiles table
  - If yes, user can see ALL profiles (admin + students)
  - If no, user can only see their own profile

  ## Changes
  1. Drop the incorrect "Admins can read all profiles" policy
  2. Drop the incorrect "Admins can update all profiles" policy
  3. Drop the incorrect "Admins can delete profiles" policy
  4. Create new correct policies with proper subquery logic

  ## Security
  - Admins (users with role='admin') can read, update, and delete all profiles
  - Regular users can only read and update their own profile
  - Regular users cannot delete any profiles
  - All operations require authentication

  ## Impact
  - User Management page will now show all 6+ users (admins + students)
  - Admins will have proper access to manage all user accounts
*/

-- Drop incorrect policies that check row's role instead of user's role
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create correct policy for SELECT: Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
    OR auth.uid() = user_id
  );

-- Create correct policy for UPDATE: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
    OR auth.uid() = user_id
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
    OR auth.uid() = user_id
  );

-- Create correct policy for DELETE: Only admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
  );
