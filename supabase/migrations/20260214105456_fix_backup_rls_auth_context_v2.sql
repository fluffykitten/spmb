/*
  # Fix Backup RLS Authentication Context

  1. Issue
    - `auth.uid()` returns null even with valid frontend session
    - `is_admin_user()` function returns false
    - RLS policies block legitimate admin operations

  2. Solution
    - Replace `is_admin_user()` function calls with direct profile checks
    - Update RLS policies to check profiles table directly
    - This avoids function dependency issues

  3. Changes
    - Update all database_backups RLS policies
    - Update backup_schedules RLS policies
    - Update storage policies
    - Add debugging function
*/

-- Update RLS policies for database_backups with direct profile checks
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Update backup_schedules policies
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Update storage policies for database-backups bucket
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
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
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Create a debugging helper function
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
    'profile_exists', EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid()),
    'profile_role', (SELECT role FROM profiles WHERE id = auth.uid()),
    'profile_email', (SELECT email FROM profiles WHERE id = auth.uid())
  ) INTO result;
  
  RETURN result;
END;
$$;
