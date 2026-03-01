/*
  # Fix Admin Create User - Trigger Conflict
  
  ## Problem
  The admin_create_user function fails with "duplicate key value violates unique constraint profiles_user_id_key"
  because:
  1. admin_create_user inserts into auth.users
  2. The on_auth_user_created trigger fires automatically and creates a profile
  3. Then admin_create_user tries to insert the profile again → duplicate error
  
  ## Solution
  Remove the manual profile insertion from admin_create_user and let the trigger handle it.
  Update the trigger to use admin-provided metadata when available.
  
  ## Changes
  1. Update handle_new_user trigger to read admin metadata
  2. Recreate admin_create_user to use raw_user_meta_data for profile info
  3. Remove manual profile INSERT from admin_create_user
*/

-- Step 1: Update the trigger function to handle admin-created users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile using metadata from raw_user_meta_data
  -- This works for both normal signups and admin-created users
  INSERT INTO public.profiles (user_id, email, role, full_name, phone, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE((NEW.raw_user_meta_data->>'is_active')::boolean, true)
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, skip creation
    RAISE WARNING 'Profile already exists for user %', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 2: Recreate admin_create_user without manual profile insertion
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
  -- The trigger will automatically create the profile using raw_user_meta_data
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
    jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role,
      'phone', p_phone,
      'is_active', true
    ),
    false,
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Profile is automatically created by trigger, no manual insertion needed

  -- Log action
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    'user_created',
    v_user_id,
    jsonb_build_object('email', p_email, 'role', p_role, 'created_at', NOW())
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
