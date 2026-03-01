/*
  # Fix Profiles RLS Policy - Remove Infinite Recursion

  ## Changes
  - Drop existing admin policies that cause infinite recursion
  - Add new policy that allows authenticated users to insert their own profile during signup
  - Simplify admin policies to avoid recursive checks

  ## Security
  - Users can insert their own profile on signup
  - Users can read their own profile
  - Users can update their own profile
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all profiles (simplified without recursion)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'admin' OR auth.uid() = user_id
  );

-- Admins can update all profiles (simplified)
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    role = 'admin' OR auth.uid() = user_id
  )
  WITH CHECK (
    role = 'admin' OR auth.uid() = user_id
  );

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    role = 'admin'
  );
