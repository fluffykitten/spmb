/*
  # Fix Password Functions with pgcrypto Schema

  ## Changes
  
  1. **Remove Diagnostics Functions**
     - Drop admin_get_auth_diagnostics
     - Drop admin_cleanup_orphaned_auth_users
     - Drop check_email_exists
  
  2. **Fix admin_create_user**
     - Add 'extensions' to search_path to access gen_salt() and crypt()
     - This fixes the "function gen_salt(unknown) does not exist" error
  
  3. **Fix admin_reset_user_password**
     - Add 'extensions' to search_path
     - Ensure proper return format
  
  ## Impact
  - Diagnostics feature completely removed
  - User creation now works correctly
  - Password reset now works correctly
*/

-- Drop diagnostics and email check functions
DROP FUNCTION IF EXISTS admin_get_auth_diagnostics();
DROP FUNCTION IF EXISTS admin_cleanup_orphaned_auth_users();
DROP FUNCTION IF EXISTS check_email_exists(text);

-- Recreate admin_create_user with proper search_path
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text, text);

CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_phone text DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
SET search_path = public, extensions, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
  v_calling_user_role text;
BEGIN
  -- Check if caller is admin
  SELECT role INTO v_calling_user_role
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF v_calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'student') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or student';
  END IF;

  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'User with email % already exists', p_email;
  END IF;

  -- Generate encrypted password using pgcrypto
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', p_full_name),
    false,
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Create profile
  INSERT INTO profiles (user_id, email, full_name, role, phone, is_active)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_phone, true);

  -- Log action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'create_user',
    'profiles',
    v_user_id,
    jsonb_build_object('email', p_email, 'role', p_role)
  );

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'role', p_role
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, text, text) TO authenticated;

-- Recreate admin_reset_user_password with proper search_path
DROP FUNCTION IF EXISTS admin_reset_user_password(uuid, text);

CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_user_id uuid,
  new_password text
)
RETURNS json
SECURITY DEFINER
SET search_path = public, extensions, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_encrypted_password text;
  v_calling_user_role text;
  v_target_email text;
BEGIN
  -- Check if caller is admin
  SELECT role INTO v_calling_user_role
  FROM profiles
  WHERE user_id = auth.uid();
  
  IF v_calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;

  -- Prevent admin from resetting their own password
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot reset your own password';
  END IF;

  -- Get target user email
  SELECT email INTO v_target_email
  FROM auth.users
  WHERE id = target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Generate encrypted password using pgcrypto
  v_encrypted_password := crypt(new_password, gen_salt('bf'));

  -- Update password in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_password,
    updated_at = NOW()
  WHERE id = target_user_id;

  -- Log action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'reset_password',
    'auth.users',
    target_user_id,
    jsonb_build_object('target_email', v_target_email)
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Password reset successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_reset_user_password(uuid, text) TO authenticated;