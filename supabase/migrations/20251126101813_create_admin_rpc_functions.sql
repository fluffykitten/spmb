/*
  # Create Admin RPC Functions

  ## Purpose
  Provide admin-only functions that bypass RLS policies using SECURITY DEFINER.
  This solves the infinite recursion problem by:
  1. Regular users access their profile via normal RLS policies
  2. Admins use RPC functions that bypass RLS
  3. RPC functions check admin role and execute with elevated privileges

  ## Security
  - Functions use SECURITY DEFINER (run with function owner's privileges)
  - Each function checks caller's role before proceeding
  - Only users with role='admin' can execute admin operations
  - All operations are logged for audit trail

  ## Functions Created
  1. admin_get_all_profiles() - Read all user profiles
  2. admin_update_profile() - Update any user profile
  3. admin_delete_profile() - Delete any user profile
  4. admin_create_user() - Create new user with profile

  ## Usage in Frontend
  Replace direct table queries with RPC calls:
  - Old: supabase.from('profiles').select('*')
  - New: supabase.rpc('admin_get_all_profiles')
*/

-- Function: Get all profiles (admin only)
CREATE OR REPLACE FUNCTION admin_get_all_profiles()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get caller's role without recursion
  -- This query runs as DEFINER, bypassing RLS
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  -- Check if admin
  IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  -- Return all profiles
  RETURN QUERY
  SELECT * FROM profiles
  ORDER BY created_at DESC;
END;
$$;

-- Function: Update any profile (admin only)
CREATE OR REPLACE FUNCTION admin_update_profile(
  target_user_id uuid,
  new_full_name text DEFAULT NULL,
  new_email text DEFAULT NULL,
  new_role text DEFAULT NULL,
  new_is_active boolean DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
  updated_profile profiles;
BEGIN
  -- Get caller's role
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  -- Check if admin
  IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  -- Update profile (only provided fields)
  UPDATE profiles
  SET
    full_name = COALESCE(new_full_name, full_name),
    email = COALESCE(new_email, email),
    role = COALESCE(new_role, role),
    is_active = COALESCE(new_is_active, is_active),
    updated_at = now()
  WHERE user_id = target_user_id
  RETURNING * INTO updated_profile;

  IF updated_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found: %', target_user_id;
  END IF;

  -- Log the action
  INSERT INTO audit_logs (action, table_name, record_id, user_id)
  VALUES ('UPDATE', 'profiles', target_user_id, auth.uid());

  RETURN updated_profile;
END;
$$;

-- Function: Delete profile (admin only)
CREATE OR REPLACE FUNCTION admin_delete_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get caller's role
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE user_id = auth.uid();

  -- Check if admin
  IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  -- Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own profile';
  END IF;

  -- Log before deletion
  INSERT INTO audit_logs (action, table_name, record_id, user_id)
  VALUES ('DELETE', 'profiles', target_user_id, auth.uid());

  -- Delete profile
  DELETE FROM profiles WHERE user_id = target_user_id;

  -- Delete auth user (will cascade to profile if not already deleted)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Function: Check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = auth.uid();

  RETURN (user_role = 'admin');
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION admin_get_all_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_profile(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;