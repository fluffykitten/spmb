/*
  # Recreate Password Functions with pgcrypto Available
  
  ## Description
  The admin_create_user and admin_reset_user_password functions were originally
  created BEFORE the pgcrypto extension was enabled. This causes "function gen_salt
  does not exist" errors when trying to use them.
  
  This migration:
  1. Ensures pgcrypto extension is available
  2. Drops and recreates admin_create_user function
  3. Drops and recreates admin_reset_user_password function
  
  ## Why This Is Needed
  - Migration 20251126092355 created admin_create_user (timestamp: 092355)
  - Migration 20251126094946 enabled pgcrypto (timestamp: 094946)
  - admin_create_user was defined BEFORE pgcrypto was available
  - Same issue with admin_reset_user_password
  - Functions need to be recreated after pgcrypto is enabled
  
  ## Changes Made
  1. Ensure pgcrypto extension is enabled
  2. Drop admin_create_user function
  3. Recreate admin_create_user with identical logic
  4. Drop admin_reset_user_password function
  5. Recreate admin_reset_user_password with identical logic
  6. Grant execute permissions to authenticated users
*/

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop and recreate admin_create_user function
DROP FUNCTION IF EXISTS admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
  v_caller_id UUID;
  v_result JSON;
BEGIN
  -- Get caller's user ID
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = v_caller_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'student') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or student';
  END IF;

  -- Generate new user ID
  v_user_id := gen_random_uuid();

  -- Hash the password using pgcrypto
  v_encrypted_password := crypt(p_password, gen_salt('bf'));

  -- Insert into auth.users table
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    now(),
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- Create profile
  INSERT INTO profiles (user_id, email, full_name, role, phone, is_active)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_phone, true);

  -- Create audit log
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    v_caller_id,
    'user_created',
    v_user_id,
    jsonb_build_object('email', p_email, 'role', p_role)
  );

  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'role', p_role
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'User with email % already exists', p_email;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END;
$$;

-- Drop and recreate admin_reset_user_password function
DROP FUNCTION IF EXISTS admin_reset_user_password(UUID, TEXT);

CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_email TEXT;
  v_encrypted_password TEXT;
  v_result JSON;
BEGIN
  -- Get caller's user ID
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if caller is admin
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE user_id = v_caller_id;

  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Prevent self-password reset (should use normal password change flow)
  IF target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot reset your own password. Use the normal password change flow.';
  END IF;

  -- Verify target user exists and get their email
  SELECT email INTO v_target_email
  FROM profiles
  WHERE user_id = target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found: %', target_user_id;
  END IF;

  -- Hash the new password using pgcrypto bcrypt
  v_encrypted_password := crypt(new_password, gen_salt('bf'));

  -- Update password in auth.users table
  UPDATE auth.users
  SET
    encrypted_password = v_encrypted_password,
    updated_at = now()
  WHERE id = target_user_id;

  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update password for user: %', target_user_id;
  END IF;

  -- Create audit log entry
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    v_caller_id,
    'password_reset',
    target_user_id,
    jsonb_build_object('email', v_target_email, 'reset_by_admin', true)
  );

  -- Build success response
  v_result := jsonb_build_object(
    'success', true,
    'user_id', target_user_id,
    'email', v_target_email,
    'message', 'Password reset successfully'
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error resetting password: %', SQLERRM;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION admin_create_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reset_user_password(UUID, TEXT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION admin_create_user IS 
  'Securely creates a new user with profile. Only callable by admins. Uses SECURITY DEFINER for auth.users access.';

COMMENT ON FUNCTION admin_reset_user_password IS
  'Securely resets a user password. Only callable by admins. Uses SECURITY DEFINER for auth.users access.';
