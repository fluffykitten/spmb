/*
  # Fix Admin RPC Functions and Audit Logs Schema Mismatch
  
  ## Description
  This migration fixes critical bugs in the admin RPC functions:
  1. audit_logs table schema mismatch - functions were using wrong column names
  2. admin_get_all_profiles returns wrong ID field for frontend
  3. Ensures pgcrypto extension is available for all password operations
  
  ## Changes Made
  
  ### 1. Fix admin_update_profile Function
  - Changed audit_logs insert to use correct columns: user_id, action, target_user_id, details
  - Removed references to non-existent table_name and record_id columns
  
  ### 2. Fix admin_delete_profile Function
  - Changed audit_logs insert to use correct columns: user_id, action, target_user_id, details
  - Removed references to non-existent table_name and record_id columns
  - Fixed to accept profile.id parameter but query by user_id
  
  ### 3. Fix admin_get_all_profiles Function
  - Modified to return user_id as id for frontend compatibility
  - Frontend expects 'id' field but needs the auth.users.id value (user_id)
  - This fixes "Target user not found" errors in password reset and delete
  
  ### 4. Ensure pgcrypto Extension
  - Ensures pgcrypto is available before any function that needs it
  - Fixes "function gen_salt(unknown) does not exist" error
  
  ## Security Notes
  - All functions maintain SECURITY DEFINER for admin operations
  - Admin role check remains in place for all operations
  - Audit logs now correctly track user_id and target_user_id
  
  ## Testing Required
  - Test user creation with new account
  - Test password reset for existing user
  - Test user deletion for non-admin user
  - Verify audit logs are created with correct schema
*/

-- Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop and recreate admin_get_all_profiles with new return type
DROP FUNCTION IF EXISTS admin_get_all_profiles();

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
  -- Get caller's role without recursion
  SELECT p.role INTO calling_user_role
  FROM profiles p
  WHERE p.user_id = auth.uid();

  -- Check if admin
  IF calling_user_role IS NULL OR calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  -- Return all profiles with user_id as id for frontend compatibility
  RETURN QUERY
  SELECT 
    p.user_id as id,
    p.user_id,
    p.role,
    p.full_name,
    p.email,
    p.phone,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$;

-- Fix admin_update_profile function
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

  -- Log the action with correct columns
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    'profile_update',
    target_user_id,
    jsonb_build_object(
      'full_name', new_full_name,
      'email', new_email,
      'role', new_role,
      'is_active', new_is_active
    )
  );

  RETURN updated_profile;
END;
$$;

-- Fix admin_delete_profile function
CREATE OR REPLACE FUNCTION admin_delete_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
  target_email text;
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

  -- Get target user email for audit log
  SELECT email INTO target_email
  FROM profiles
  WHERE user_id = target_user_id;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Profile not found: %', target_user_id;
  END IF;

  -- Log before deletion with correct columns
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    auth.uid(),
    'user_delete',
    target_user_id,
    jsonb_build_object('email', target_email, 'deleted_at', now())
  );

  -- Delete profile first (if CASCADE doesn't handle it)
  DELETE FROM profiles WHERE user_id = target_user_id;

  -- Delete auth user (will cascade to profile if still exists)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION admin_get_all_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_profile(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_profile(uuid) TO authenticated;
