/*
  # Fix Profiles RLS with Security Definer Function

  ## Problem
  - Subqueries in RLS policies cause infinite recursion
  - Previous attempts still used subquery: (SELECT role FROM profiles WHERE ...)
  - Need a way to check if user is admin WITHOUT querying profiles table in the policy

  ## Solution
  - Create a security definer function that bypasses RLS
  - Function checks user role without triggering policy evaluation
  - Use this function in the policy instead of subquery

  ## How It Works
  1. is_admin() function runs as DEFINER (bypasses RLS)
  2. It queries profiles table to check current user's role
  3. Returns true/false without triggering RLS policies again
  4. Policy uses this function result to allow/deny access

  ## Security
  - Users can read their own profile
  - Admins can read all profiles
  - No infinite recursion
*/

-- Drop problematic policy
DROP POLICY IF EXISTS "users_and_admins_can_read_profiles" ON profiles;

-- Create security definer function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- This query bypasses RLS because function is SECURITY DEFINER
  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Create simple policy using the security definer function
CREATE POLICY "users_read_own_admins_read_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR is_admin()
  );
