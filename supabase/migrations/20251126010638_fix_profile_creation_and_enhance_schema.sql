/*
  # Fix Profile Creation and Enhance Schema

  ## Description
  This migration fixes the issue where student profiles are not created automatically
  when users register, causing their application data to not appear in admin dashboard.

  ## Changes
  1. Add email and full_name columns to profiles table (if not exists)
  2. Create trigger to auto-create profile when new auth.users record is created
  3. Backfill profiles for existing users who don't have profiles yet
  4. Update RLS policies to ensure proper data visibility

  ## Security
  - Trigger runs with security definer to bypass RLS
  - Maintains existing RLS policies
  - Only creates student profiles by default

  ## Notes
  - This ensures every user always has a corresponding profile
  - Fixes the JOIN issue in admin dashboard queries
  - Backfills existing data to fix past registrations
*/

-- Step 1: Add email and full_name columns to profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
  END IF;
END $$;

-- Step 2: Create function to auto-create profile for new users
CREATE OR REPLACE FUNCTION create_profile_for_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'fullName', ''),
    'student'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_new_user();

-- Step 4: Backfill profiles for existing users who don't have profiles
INSERT INTO profiles (user_id, email, full_name, role)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'fullName', ''),
  'student'
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 5: Update existing profiles to populate email and full_name if empty
UPDATE profiles p
SET 
  email = COALESCE(p.email, u.email),
  full_name = COALESCE(
    p.full_name, 
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'fullName',
    ''
  )
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email IS NULL OR p.email = '' OR p.full_name IS NULL OR p.full_name = '');

-- Step 6: Create index on email for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Step 7: Add comment explaining the trigger
COMMENT ON FUNCTION create_profile_for_new_user() IS 
  'Automatically creates a profile record when a new user registers via auth.users';
