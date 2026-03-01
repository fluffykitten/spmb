/*
  # Fix Applicants-Profiles Foreign Key Relationship

  ## Description
  Updates the foreign key constraint to reference profiles.id (primary key) instead of
  profiles.user_id. This enables Supabase's automatic JOIN syntax to work correctly.

  ## Changes
  1. Drop existing foreign key constraint
  2. Add new foreign key referencing profiles.id
  3. Create index for performance

  ## Impact
  - Fixes the email display issue in Student Management
  - Enables proper Supabase relationship queries
  - No data loss - only schema change

  ## Notes
  - profiles.user_id has a UNIQUE constraint, so there's still 1-1 relationship
  - New FK provides better integration with Supabase client
*/

-- Drop the old foreign key constraint
ALTER TABLE applicants 
DROP CONSTRAINT IF EXISTS applicants_profiles_fkey;

-- Add new foreign key referencing profiles.id (primary key)
ALTER TABLE applicants 
ADD CONSTRAINT applicants_profile_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;

-- Ensure index exists for performance
CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id);

-- Update comment
COMMENT ON CONSTRAINT applicants_profile_id_fkey ON applicants IS 
  'Foreign key to profiles table via user_id for proper JOIN queries';
