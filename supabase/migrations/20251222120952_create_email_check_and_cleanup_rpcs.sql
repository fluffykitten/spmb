/*
  # Email Check and Cleanup RPC Functions

  1. New Functions
    - `check_email_exists(email)` - Checks if email exists in auth.users table
      - Returns boolean indicating if email is already taken
      - Uses SECURITY DEFINER to access auth schema safely
      - Prevents "email exists" errors from orphaned records
    
    - `admin_cleanup_orphaned_auth_users()` - Removes orphaned auth.users records
      - Finds users in auth.users without corresponding profiles
      - Deletes orphaned records to maintain data consistency
      - Only callable by admins for safety
      - Returns count of deleted records

  2. Security
    - Both functions use SECURITY DEFINER for auth schema access
    - Cleanup function restricted to admin users only
    - Proper error handling and validation
*/

-- Function to check if email exists in auth.users
CREATE OR REPLACE FUNCTION public.check_email_exists(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = check_email
  );
END;
$$;

-- Function to cleanup orphaned auth.users records (admin only)
CREATE OR REPLACE FUNCTION public.admin_cleanup_orphaned_auth_users()
RETURNS TABLE(deleted_count integer, deleted_emails text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_deleted_emails text[] := ARRAY[]::text[];
  v_is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can cleanup orphaned records';
  END IF;

  -- Find and delete orphaned auth.users (users without profiles)
  WITH orphaned_users AS (
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
  ),
  deleted AS (
    DELETE FROM auth.users
    WHERE id IN (SELECT id FROM orphaned_users)
    RETURNING id, email
  )
  SELECT COUNT(*)::integer, ARRAY_AGG(email)
  INTO v_deleted_count, v_deleted_emails
  FROM deleted;

  -- Log the cleanup action
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    auth.uid(),
    'cleanup_orphaned_auth_users',
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'deleted_emails', v_deleted_emails
    )
  );

  RETURN QUERY SELECT v_deleted_count, COALESCE(v_deleted_emails, ARRAY[]::text[]);
END;
$$;

-- Function to get diagnostic info about auth users vs profiles (admin only)
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
  -- Check if the current user is an admin
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can view diagnostics';
  END IF;

  RETURN QUERY
  WITH auth_count AS (
    SELECT COUNT(*)::integer AS cnt FROM auth.users
  ),
  profile_count AS (
    SELECT COUNT(*)::integer AS cnt FROM public.profiles
  ),
  orphaned AS (
    SELECT 
      COUNT(*)::integer AS cnt,
      ARRAY_AGG(au.email) AS emails
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
  )
  SELECT 
    ac.cnt,
    pc.cnt,
    COALESCE(o.cnt, 0),
    COALESCE(o.emails, ARRAY[]::text[])
  FROM auth_count ac
  CROSS JOIN profile_count pc
  CROSS JOIN orphaned o;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_orphaned_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_auth_diagnostics() TO authenticated;
