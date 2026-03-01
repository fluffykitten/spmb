/*
  # Fix Backup RLS to Use Correct user_id Column

  1. Issue
    - RLS policies were checking `profiles.id = auth.uid()`
    - Should be checking `profiles.user_id = auth.uid()`
    - The `user_id` column is the foreign key to auth.users

  2. Solution
    - Update all backup-related RLS policies to use `user_id` instead of `id`

  3. Changes
    - Fix database_backups policies
    - Fix backup_schedules policies
    - Fix storage bucket policies
*/

-- Fix database_backups RLS policies
DROP POLICY IF EXISTS "Admins can create backups" ON database_backups;
DROP POLICY IF EXISTS "Admins can view all backups" ON database_backups;
DROP POLICY IF EXISTS "Admins can update backups" ON database_backups;
DROP POLICY IF EXISTS "Admins can delete backups" ON database_backups;

CREATE POLICY "Admins can create backups"
  ON database_backups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can view all backups"
  ON database_backups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update backups"
  ON database_backups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can delete backups"
  ON database_backups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Fix backup_schedules RLS policies
DROP POLICY IF EXISTS "Admins can view all schedules" ON backup_schedules;
DROP POLICY IF EXISTS "Admins can create schedules" ON backup_schedules;
DROP POLICY IF EXISTS "Admins can update schedules" ON backup_schedules;
DROP POLICY IF EXISTS "Admins can delete schedules" ON backup_schedules;

CREATE POLICY "Admins can view all schedules"
  ON backup_schedules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can create schedules"
  ON backup_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update schedules"
  ON backup_schedules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can delete schedules"
  ON backup_schedules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Fix storage bucket policies for database-backups
DROP POLICY IF EXISTS "Admin upload to database-backups" ON storage.objects;
DROP POLICY IF EXISTS "Admin view database-backups" ON storage.objects;
DROP POLICY IF EXISTS "Admin update database-backups" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete database-backups" ON storage.objects;

CREATE POLICY "Admin upload to database-backups"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'database-backups' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admin view database-backups"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'database-backups' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admin update database-backups"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'database-backups' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admin delete database-backups"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'database-backups' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Update the is_admin_user function to use user_id as well
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = auth.uid();

  RETURN COALESCE(user_role = 'admin', false) OR COALESCE(user_role = 'superadmin', false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Update debug function
CREATE OR REPLACE FUNCTION debug_auth_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'auth_uid', auth.uid(),
    'auth_role', auth.role(),
    'profile_exists', EXISTS(SELECT 1 FROM profiles WHERE user_id = auth.uid()),
    'profile_role', (SELECT role FROM profiles WHERE user_id = auth.uid()),
    'profile_email', (SELECT email FROM profiles WHERE user_id = auth.uid())
  ) INTO result;
  
  RETURN result;
END;
$$;
