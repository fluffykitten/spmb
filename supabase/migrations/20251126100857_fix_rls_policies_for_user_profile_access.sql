/*
  # Fix RLS Policies for User Profile Access

  ## Problem
  Previous RLS policies were checking the role column of the ROW being queried,
  not the role of the logged-in user. This prevented users from reading their
  own profiles, causing "Error fetching profile" errors.

  Example of incorrect policy:
  `USING (role = 'admin' OR auth.uid() = user_id)`
  - This checks if the PROFILE being viewed has role='admin'
  - A student user cannot read their own profile because their role='student'

  ## Solution
  1. Drop all conflicting policies
  2. Create simple, correct policies:
     - Users can ALWAYS read their own profile (auth.uid() = user_id)
     - Users can ALWAYS update their own profile
     - Users can insert their own profile on signup
  3. Add separate admin policies using subqueries to check admin role

  ## Security Impact
  - All authenticated users can read/update their own profile ✅
  - Only admins can read/update/delete other users' profiles ✅
  - Profile creation during signup is allowed ✅

  ## Changes
  1. Drop all existing conflicting policies
  2. Create user policies (read/update own profile)
  3. Create admin policies (read/update/delete all profiles)
  4. Add insert policy for signup
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- CRITICAL: Allow users to insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- CRITICAL: Allow users to read their own profile (no role check!)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin policy: Admins can read ALL profiles (using subquery)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
  );

-- Admin policy: Admins can update ALL profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.role = 'admin'
    )
  );

-- Admin policy: Only admins can delete profiles
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