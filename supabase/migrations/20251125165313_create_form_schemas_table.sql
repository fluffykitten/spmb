/*
  # Create form_schemas table for dynamic form configuration

  ## Description
  This migration creates the form_schemas table to store customizable form field
  configurations. This allows admins to modify the application form structure
  through the UI without code changes.

  ## New Tables
  1. `form_schemas`
    - `id` (uuid, primary key) - Unique identifier
    - `name` (text) - Schema name/identifier (e.g., 'application_form')
    - `fields` (jsonb) - Array of field configurations
    - `is_active` (boolean) - Whether this schema is currently active
    - `version` (integer) - Schema version number for tracking changes
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
  - Enable RLS on form_schemas table
  - All authenticated users can read active schemas
  - Only admins can create, update, and delete schemas

  ## Notes
  - Only one schema per name can be active at a time
  - fields JSONB stores array of field configurations
  - Version tracking for schema history
*/

CREATE TABLE IF NOT EXISTS form_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT false,
  version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE form_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read active schemas"
  ON form_schemas FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can read all schemas"
  ON form_schemas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert schemas"
  ON form_schemas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update schemas"
  ON form_schemas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete schemas"
  ON form_schemas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE TRIGGER update_form_schemas_updated_at
  BEFORE UPDATE ON form_schemas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_form_schemas_name_active ON form_schemas(name, is_active);
