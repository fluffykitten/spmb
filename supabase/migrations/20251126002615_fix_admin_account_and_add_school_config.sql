/*
  # Fix Admin Account and Add School Configuration

  ## Description
  This migration fixes the admin account issue and adds configuration
  fields for school identity and academic year.

  ## Changes
  1. Update existing admin account to have proper role
  2. Add new configuration fields for school identity:
     - academic_year - Current academic year (e.g., 2024/2025)
     - school_motto - School motto/tagline
     - school_description - Brief description about school
     - school_address - Complete school address
     - school_phone - School contact phone
     - school_email - School contact email
     - school_website - School official website
     - social_facebook, social_instagram, social_twitter - Social media URLs
     - Statistics display values for landing page

  ## Security
  - No RLS changes needed
  - All app_config modifications are admin-only

  ## Notes
  - This ensures the initial admin account works properly
  - Provides all fields needed for landing page
  - Academic year format: YYYY/YYYY
*/

-- Fix admin account role
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@ppdb.sch.id';

-- Add new configuration fields for school identity
INSERT INTO app_config (key, value) VALUES
  ('academic_year', '"2024/2025"'::jsonb),
  ('school_motto', '"Unggul dalam Prestasi, Santun dalam Budi Pekerti"'::jsonb),
  ('school_description', '"Sekolah unggulan dengan fasilitas terbaik dan tenaga pendidik profesional"'::jsonb),
  ('school_address', '"Jl. Pendidikan No. 123, Jakarta Pusat, DKI Jakarta 10110"'::jsonb),
  ('school_phone', '"021-12345678"'::jsonb),
  ('school_email', '"info@sekolah.sch.id"'::jsonb),
  ('school_website', '"https://sekolah.sch.id"'::jsonb),
  ('social_facebook', '""'::jsonb),
  ('social_instagram', '""'::jsonb),
  ('social_twitter', '""'::jsonb),
  ('show_statistics', 'true'::jsonb),
  ('stat_students', '"1000+"'::jsonb),
  ('stat_teachers', '"50+"'::jsonb),
  ('stat_graduation', '"95%"'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value;

-- Update existing school_name if it's empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'school_name') THEN
    INSERT INTO app_config (key, value) VALUES ('school_name', '"SMA Negeri 1 Jakarta"'::jsonb);
  END IF;
END $$;
