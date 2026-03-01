/*
  # Fix Database Backup RLS Policies

  1. Changes
    - Create a security definer function to check admin status reliably
    - Update all RLS policies to use the helper function
    - This avoids infinite recursion and policy evaluation issues

  2. Security
    - Uses SECURITY DEFINER to bypass RLS when checking admin status
    - Only checks the current authenticated user
    - Maintains admin-only access to backup system
*/

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all backups" ON database_backups;
DROP POLICY IF EXISTS "Admins can create backups" ON database_backups;
DROP POLICY IF EXISTS "Admins can update backups" ON database_backups;
DROP POLICY IF EXISTS "Admins can delete backups" ON database_backups;

DROP POLICY IF EXISTS "Admins can view all schedules" ON backup_schedules;
DROP POLICY IF EXISTS "Admins can create schedules" ON backup_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON backup_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON backup_schedules;

-- Recreate policies using the helper function
CREATE POLICY "Admins can view all backups"
  ON database_backups FOR SELECT
  TO authenticated
  USING (is_admin_user());

CREATE POLICY "Admins can create backups"
  ON database_backups FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update backups"
  ON database_backups FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete backups"
  ON database_backups FOR DELETE
  TO authenticated
  USING (is_admin_user());

CREATE POLICY "Admins can view all schedules"
  ON backup_schedules FOR SELECT
  TO authenticated
  USING (is_admin_user());

CREATE POLICY "Admins can create schedules"
  ON backup_schedules FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update schedules"
  ON backup_schedules FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete schedules"
  ON backup_schedules FOR DELETE
  TO authenticated
  USING (is_admin_user());
