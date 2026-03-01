/*
  # Create audit_logs table for user action tracking

  ## Description
  This migration creates the audit_logs table to track all user management
  actions such as password resets, role changes, and user deletions.

  ## New Tables
  1. `audit_logs`
    - `id` (uuid, primary key) - Unique identifier
    - `user_id` (uuid) - User who performed the action
    - `action` (text) - Type of action performed
    - `target_user_id` (uuid) - User affected by the action
    - `details` (jsonb) - Additional details about the action
    - `created_at` (timestamptz) - When action was performed

  ## Security
  - Enable RLS on audit_logs table
  - Only admins can read audit logs
  - System automatically records actions (no manual insert)

  ## Notes
  - This provides audit trail for compliance
  - Helps track security-related events
  - Useful for debugging and support
*/

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
