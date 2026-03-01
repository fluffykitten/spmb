/*
  # Create Secure RPC Function for User Creation

  ## Description
  This migration creates a secure RPC function that allows admins to create new users
  with profiles. This function uses SECURITY DEFINER to perform admin operations
  that regular users cannot do with anon key.

  ## Changes
  1. Create RPC function `admin_create_user` with security definer
  2. Function validates that caller is an admin
  3. Creates user in auth.users table with hashed password
  4. Creates corresponding profile record
  5. Creates audit log entry
  6. Returns result as JSON

  ## Security
  - Only callable by authenticated admins (checks profiles.role = 'admin')
  - Uses SECURITY DEFINER to perform privileged operations
  - Password is hashed using pgcrypto extension
  - All operations wrapped in transaction for data consistency

  ## Usage
  From frontend:
  ```typescript
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_email: 'user@example.com',
    p_password: 'password123',
    p_full_name: 'User Name',
    p_role: 'student',
    p_phone: '08123456789'
  });
  ```
*/

-- Ensure pgcrypto extension is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the RPC function for secure user creation
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

  -- Hash the password
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

-- Grant execute permission to authenticated users (function will check admin role internally)
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_create_user IS 
  'Securely creates a new user with profile. Only callable by admins. Uses SECURITY DEFINER for auth.users access.';
