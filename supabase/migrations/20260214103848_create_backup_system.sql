/*
  # Create Database Backup System

  1. New Tables
    - `database_backups`
      - `id` (uuid, primary key)
      - `name` (text) - User-friendly backup name
      - `description` (text) - Optional description
      - `backup_type` (text) - 'full' or 'selective'
      - `tables_included` (jsonb) - Array of table names included
      - `file_path` (text) - Storage path to backup file
      - `file_size` (bigint) - File size in bytes
      - `status` (text) - 'pending', 'completed', 'failed'
      - `created_by` (uuid) - Reference to profiles
      - `created_at` (timestamptz)
      - `error_message` (text) - Error details if failed
    
    - `backup_schedules`
      - `id` (uuid, primary key)
      - `schedule_name` (text) - Name for the schedule
      - `frequency` (text) - 'daily', 'weekly', 'monthly'
      - `tables_to_backup` (jsonb) - Array of table names
      - `is_active` (boolean) - Whether schedule is enabled
      - `last_run_at` (timestamptz) - Last execution time
      - `next_run_at` (timestamptz) - Next scheduled execution
      - `created_by` (uuid) - Reference to profiles
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only admin users can manage backups
    - All operations are logged in audit_logs

  3. Storage
    - Create storage bucket for backup files
    - Admin-only access policies
*/

-- Create database_backups table
CREATE TABLE IF NOT EXISTS database_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  backup_type text NOT NULL CHECK (backup_type IN ('full', 'selective')),
  tables_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_path text,
  file_size bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  error_message text
);

-- Create backup_schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_name text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  tables_to_backup jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE database_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for database_backups (admin only)
CREATE POLICY "Admins can view all backups"
  ON database_backups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create backups"
  ON database_backups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update backups"
  ON database_backups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete backups"
  ON database_backups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for backup_schedules (admin only)
CREATE POLICY "Admins can view all schedules"
  ON backup_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create schedules"
  ON backup_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update schedules"
  ON backup_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete schedules"
  ON backup_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'database-backups',
  'database-backups',
  false,
  104857600, -- 100MB limit
  ARRAY['application/json', 'application/gzip', 'application/x-gzip']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (admin only)
CREATE POLICY "Admins can upload backup files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'database-backups'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view backup files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update backup files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete backup files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'database-backups'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_database_backups_created_by ON database_backups(created_by);
CREATE INDEX IF NOT EXISTS idx_database_backups_created_at ON database_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_database_backups_status ON database_backups(status);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_is_active ON backup_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run_at ON backup_schedules(next_run_at);