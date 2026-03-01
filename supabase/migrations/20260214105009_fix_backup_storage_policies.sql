/*
  # Fix Database Backup Storage Policies

  1. Changes
    - Update storage policies to use the is_admin_user() helper function
    - Ensures consistent admin checking across all backup-related operations

  2. Security
    - Maintains admin-only access to backup storage bucket
    - Uses the same security pattern as table policies
*/

-- Drop existing storage policies for database-backups bucket
DROP POLICY IF EXISTS "Admins can upload backup files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view backup files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update backup files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete backup files" ON storage.objects;

-- Recreate with proper naming to avoid conflicts with other buckets
CREATE POLICY "Admin upload to database-backups"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'database-backups'
    AND is_admin_user()
  );

CREATE POLICY "Admin view database-backups"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND is_admin_user()
  );

CREATE POLICY "Admin update database-backups"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND is_admin_user()
  )
  WITH CHECK (
    bucket_id = 'database-backups'
    AND is_admin_user()
  );

CREATE POLICY "Admin delete database-backups"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND is_admin_user()
  );
