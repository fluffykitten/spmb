/*
  # Add Foreign Key from Applicants to Profiles

  ## Description
  This migration adds a foreign key constraint from applicants.user_id to profiles.user_id
  to enable proper JOIN queries in the admin dashboard.

  ## Changes
  1. Add foreign key constraint from applicants to profiles
  2. Add index for better query performance

  ## Benefits
  - Enables proper relational queries between applicants and profiles
  - Improves query performance with indexed FK
  - Ensures data integrity (applicants must have valid profiles)

  ## Security
  - No security changes, maintains existing RLS policies
  - FK constraint uses CASCADE delete for data consistency
*/

-- Add foreign key constraint from applicants to profiles
-- Use IF NOT EXISTS to avoid error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'applicants_profiles_fkey'
    AND table_name = 'applicants'
  ) THEN
    ALTER TABLE applicants 
    ADD CONSTRAINT applicants_profiles_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Create index on applicants.user_id for better JOIN performance
CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id);

-- Add comment to document the relationship
COMMENT ON CONSTRAINT applicants_profiles_fkey ON applicants IS 
  'Foreign key to profiles table for JOIN queries in admin dashboard';
