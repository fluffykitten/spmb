/*
  # Fix Infinite Recursion in RLS Policies

  ## Problem
  Previous policies had infinite recursion:
  - Policy on profiles table queried profiles table in subquery
  - This caused: "infinite recursion detected in policy for relation profiles"
  - Example: USING (EXISTS (SELECT 1 FROM profiles WHERE ...))
  
  ## Root Cause
  When querying profiles table, Postgres checks RLS policies.
  If policy contains subquery to profiles table, it checks policies again.
  This creates infinite loop: query → policy → query → policy → ...

  ## Solution
  Create SIMPLE policies with NO subqueries to profiles table:
  1. Users can insert/read/update their OWN profile only
  2. Admin operations will use SECURITY DEFINER RPC functions
  3. RPC functions bypass RLS, so no recursion

  ## Security Impact
  - Regular users: Can only access their own profile ✅
  - Admins: Use RPC functions for admin operations ✅
  - No recursion, no infinite loops ✅

  ## Changes
  1. Drop ALL existing policies (clean slate)
  2. Create simple user policies (no subqueries)
  3. Admin features handled via RPC functions (next migration)
*/

-- Drop ALL existing policies to eliminate recursion
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "enable_insert_for_authenticated_users" ON profiles;
DROP POLICY IF EXISTS "enable_read_for_users_own_profile" ON profiles;
DROP POLICY IF EXISTS "enable_update_for_users_own_profile" ON profiles;

-- Create SIMPLE policies with NO subqueries, NO recursion
-- These policies are rock-solid and cannot cause recursion

CREATE POLICY "enable_insert_for_authenticated_users"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "enable_read_for_users_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "enable_update_for_users_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTE: No DELETE policy for regular users
-- Admin operations will be handled via RPC functions