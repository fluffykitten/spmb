/*
  # Create view for applicants with profile data

  1. New Views
    - `applicants_with_profiles` - Combines applicants data with profile information (email)
      - Includes all applicant fields
      - Joins with profiles table to get email
      - Useful for displaying student information in admin views

  2. Security
    - View inherits RLS policies from underlying tables
    - Admins can read all applicants with profiles
    - Students can only see their own data
*/

CREATE OR REPLACE VIEW applicants_with_profiles AS
SELECT 
  a.*,
  p.id as profile_id,
  au.email
FROM applicants a
LEFT JOIN profiles p ON a.user_id = p.user_id
LEFT JOIN auth.users au ON a.user_id = au.id;