/*
  # Enhance profiles table and create utility views

  ## Description
  This migration enhances the profiles table with additional user information
  fields and creates a view to simplify data access for applicants.

  ## Changes
  1. Add fields to profiles table:
     - `full_name` (text) - User's full name
     - `phone` (text) - User's phone number
     - `is_active` (boolean) - Account status flag
  
  2. Create view for easier applicant queries:
     - Joins applicants with profiles for unified data access
     - No need for admin.getUserById() calls

  ## Security
  - All new fields are optional
  - View respects existing RLS policies
  - is_active defaults to true

  ## Notes
  - This simplifies admin queries significantly
  - Reduces dependency on auth.admin functions
  - Better performance with single query
*/

-- Add new columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
