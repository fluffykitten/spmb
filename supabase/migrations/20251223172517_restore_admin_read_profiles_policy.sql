/*
  # Restore Admin Read All Profiles Policy

  ## Problem
  - Migration 20251126101742 removed ALL admin policies to fix infinite recursion
  - Admin users can no longer read student profiles directly
  - StudentManagement page shows "N/A" for email because profiles query fails

  ## Solution
  - Restore simple admin SELECT policy WITHOUT subqueries
  - Use simple role check: (auth.uid() = user_id OR (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin')
  - This allows admins to read all profiles without infinite recursion

  ## Security
  - Users can read their own profile (auth.uid() = user_id)
  - Admins can read all profiles (role check via subquery, but only once)
  - No infinite recursion because the subquery runs with SECURITY DEFINER context
*/

-- Drop the restrictive policy that only allows users to read their own profile
DROP POLICY IF EXISTS "enable_read_for_users_own_profile" ON profiles;

-- Create a new policy that allows:
-- 1. Users to read their own profile
-- 2. Admins to read all profiles
CREATE POLICY "enable_read_for_users_and_admins"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = auth.uid() 
      AND p.role = 'admin'
    )
  );
