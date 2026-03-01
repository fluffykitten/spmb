/*
  # Fix Diagnostics and Create User Function

  ## Issues Fixed
  
  1. **admin_get_auth_diagnostics**
     - Fixed: Changed `WHERE id = auth.uid()` to `WHERE user_id = auth.uid()`
     - This was preventing admins from viewing diagnostics
  
  2. **admin_create_user**
     - Fixed: Changed parameter from `p_department` to `p_phone` to match frontend
     - Fixed: Changed `WHERE id = auth.uid()` to `WHERE user_id = auth.uid()`
     - Updated to insert `phone` field instead of `department` field
  
  ## Impact
  - Diagnostics feature now works correctly for admins
  - User creation now accepts phone number as expected by the frontend
  - Both functions now properly validate admin permissions
  
  ## Security
  - No changes to security model
  - Both functions still require authenticated admin user
*/

-- Drop and recreate admin_get_auth_diagnostics with correct column reference
DROP FUNCTION IF EXISTS admin_get_auth_diagnostics();

CREATE OR REPLACE FUNCTION public.admin_get_auth_diagnostics()
RETURNS TABLE(
  total_auth_users integer,
  total_profiles integer,
  orphaned_auth_count integer,
  orphaned_emails text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if the current user is an admin (FIXED: user_id instead of id)
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can view diagnostics';
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::integer FROM auth.users) as total_auth_users,
    (SELECT COUNT(*)::integer FROM public.profiles) as total_profiles,
    (SELECT COUNT(*)::integer 
     FROM auth.users au 
     WHERE NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
     )
    ) as orphaned_auth_count,
    (SELECT ARRAY_AGG(au.email ORDER BY au.email)
     FROM auth.users au 
     WHERE NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
     )
    ) as orphaned_emails;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_auth_diagnostics() TO authenticated;

-- Drop and recreate admin_create_user with correct parameters
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
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_password text;
  v_calling_user_role text;
BEGIN
  -- Check if caller is admin (FIXED: user_id instead of id)
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

  -- Create profile with phone field (FIXED: phone instead of department)
  INSERT INTO profiles (user_id, email, full_name, role, phone, is_active)
  VALUES (v_user_id, p_email, p_full_name, p_role, p_phone, true);

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
    'full_name', p_full_name,
    'role', p_role,
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