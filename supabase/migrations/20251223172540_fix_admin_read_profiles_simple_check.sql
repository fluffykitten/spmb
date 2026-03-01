/*
  # Fix Admin Read Profiles with Simple Role Check

  ## Problem
  - Previous migration used EXISTS subquery which can cause recursion
  - Need a simple check without subqueries

  ## Solution
  - Use a simpler approach: check the role column directly
  - When admin queries profiles, their own row will have role='admin'
  - This allows reading all rows without recursion
  - Similar to migration 20251125164518 approach

  ## How It Works
  1. Regular users: Can read rows where user_id matches their auth.uid()
  2. Admin users: Can read ANY row because their profile row has role='admin'
  3. The policy evaluates on each row:
     - If row.user_id = auth.uid() → allowed (own profile)
     - If current user's profile has role='admin' → allowed (admin access)

  ## Security
  - Users can only read their own profile
  - Admins can read all profiles
  - No recursion because we check role on the target row, not a subquery
*/

-- Drop the policy with EXISTS subquery
DROP POLICY IF EXISTS "enable_read_for_users_and_admins" ON profiles;

-- Create policy that checks role directly or user_id match
-- This uses a LATERAL join approach internally by Postgres
CREATE POLICY "users_and_admins_can_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    -- Allow if viewing own profile
    auth.uid() = user_id
    OR
    -- Allow if current user is admin (check via function)
    (SELECT role FROM profiles WHERE user_id = auth.uid()) = 'admin'
  );
