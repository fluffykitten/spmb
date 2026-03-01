/*
  # Fix Admin RPC Functions Column Reference

  ## Changes
  This migration fixes a critical bug in two admin RPC functions where they
  incorrectly reference `id` instead of `user_id` when checking admin permissions.
  
  ## Functions Fixed
  1. **admin_create_user**
     - Fixed: Changed `WHERE id = auth.uid()` to `WHERE user_id = auth.uid()`
     - This function creates new users and was failing when admins tried to add users
  
  2. **admin_reset_user_password**
     - Fixed: Changed `WHERE id = auth.uid()` to `WHERE user_id = auth.uid()`
     - This function allows admins to reset user passwords
  
  ## Impact
  - Fixes the "column profiles.id does not exist" error
  - Enables proper admin user creation functionality
  - Enables proper password reset functionality
  
  ## Security
  - No changes to security model
  - Still requires authenticated admin user
  - Maintains existing RLS policies
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS admin_create_user;
DROP FUNCTION IF EXISTS admin_reset_user_password;

-- Recreate admin_create_user with correct column reference
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_department text DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
SET search_path = public
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

  -- Generate encrypted password
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
  INSERT INTO profiles (user_id, email, full_name, role, department, status)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_department, 'active');

  -- Log action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'create_user',
    'profiles',
    v_user_id,
    jsonb_build_object('email', p_email, 'role', p_role, 'created_by', 'admin')
  );

  RETURN json_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'message', 'User created successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Recreate admin_reset_user_password with correct column reference
CREATE OR REPLACE FUNCTION admin_reset_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS json
SECURITY DEFINER
SET search_path = public
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

  -- Get target user email
  SELECT email INTO v_target_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Generate encrypted password
  v_encrypted_password := crypt(p_new_password, gen_salt('bf'));

  -- Update password in auth.users
  UPDATE auth.users
  SET 
    encrypted_password = v_encrypted_password,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Log action
  INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
  VALUES (
    auth.uid(),
    'reset_password',
    'auth.users',
    p_user_id,
    jsonb_build_object('target_email', v_target_email, 'reset_by', 'admin')
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Password reset successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;