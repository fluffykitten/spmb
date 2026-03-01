/*
  # Fix admin_get_all_profiles RPC to include applicant form data

  1. Changes
    - Updated `admin_get_all_profiles` RPC to LEFT JOIN with `applicants` table
    - `full_name` now prioritizes `applicants.dynamic_data->>'nama_lengkap'` (form name) over `profiles.full_name` (account name)
    - `phone` now prioritizes `applicants.dynamic_data->>'no_telepon'` (form phone) over `profiles.phone` (profile phone)

  2. Reason
    - Parents sometimes register accounts with their own name, but the student's actual name is in the application form
    - Phone numbers are stored in the application form (dynamic_data) but profiles.phone is typically null
    - This ensures User Management displays accurate student data from the registration form
*/

CREATE OR REPLACE FUNCTION admin_get_all_profiles()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  role text,
  full_name text,
  email text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  SELECT p.role INTO calling_user_role
  FROM profiles p
  WHERE p.user_id = auth.uid();

  IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id as id,
    p.user_id,
    p.role,
    COALESCE(
      NULLIF(TRIM(a.dynamic_data->>'nama_lengkap'), ''),
      NULLIF(TRIM(p.full_name), ''),
      'Unknown'
    ) as full_name,
    p.email,
    COALESCE(
      NULLIF(TRIM(a.dynamic_data->>'no_telepon'), ''),
      NULLIF(TRIM(p.phone), '')
    ) as phone,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM profiles p
  LEFT JOIN applicants a ON a.user_id = p.user_id
  ORDER BY p.created_at DESC;
END;
$$;
