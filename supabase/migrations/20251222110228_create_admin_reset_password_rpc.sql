/*
  # Create Admin Password Reset RPC Function

  ## Description
  This migration creates a secure RPC function that allows admins to reset
  user passwords. This function uses SECURITY DEFINER to perform admin operations
  that regular users cannot do with anon key.

  ## Changes
  1. Create RPC function `admin_reset_user_password` with security definer
  2. Function validates that caller is an admin
  3. Updates user password in auth.users table with hashed password
  4. Creates audit log entry
  5. Returns success status as JSON

  ## Security
  - Only callable by authenticated admins (checks profiles.role = 'admin')
  - Uses SECURITY DEFINER to perform privileged operations
  - Password is hashed using pgcrypto extension (bcrypt)
  - All operations wrapped in transaction for data consistency
  - Prevents admins from resetting their own password (use normal flow)

  ## Usage
  From frontend:
  ```typescript
  const { data, error } = await supabase.rpc('admin_reset_user_password', {
    target_user_id: 'uuid-here',
    new_password: 'newPassword123'
  });
  ```
*/

-- Ensure pgcrypto extension is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the RPC function for secure password reset
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

  -- Hash the new password using bcrypt
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

-- Grant execute permission to authenticated users (function will check admin role internally)
GRANT EXECUTE ON FUNCTION admin_reset_user_password(UUID, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_reset_user_password IS
  'Securely resets a user password. Only callable by admins. Uses SECURITY DEFINER for auth.users access.';
