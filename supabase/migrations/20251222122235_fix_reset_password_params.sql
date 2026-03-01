/*
  # Fix Password Reset Function Parameter Names

  ## Changes
  This migration fixes the parameter names for admin_reset_user_password
  to match what the frontend is calling.
  
  ## Parameters Fixed
  - Changed `p_user_id` to `target_user_id` to match frontend call
  - Changed `p_new_password` to `new_password` to match frontend call
  
  ## Impact
  - Password reset functionality now works correctly
  - Frontend can successfully reset user passwords
*/

-- Drop existing function
DROP FUNCTION IF EXISTS admin_reset_user_password(uuid, text);

-- Recreate with correct parameter names
CREATE OR REPLACE FUNCTION admin_reset_user_password(
  target_user_id uuid,
  new_password text
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
  WHERE id = target_user_id;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Generate encrypted password
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