/*
  # Create applicants table

  ## Description
  This migration creates the applicants table for storing PPDB application data.
  Uses JSONB dynamic_data field for flexible, customizable form data storage.

  ## New Tables
  1. `applicants`
    - `id` (uuid, primary key) - Unique identifier for the application
    - `user_id` (uuid, foreign key to auth.users) - Links to the authenticated user
    - `status` (text) - Application status (e.g., 'draft', 'submitted', 'approved', 'rejected')
    - `dynamic_data` (jsonb) - Flexible field for storing all custom form data
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
  - Enable Row Level Security (RLS) on applicants table
  - Policy 1: Students can read only their own application
  - Policy 2: Students can insert their own application
  - Policy 3: Students can update only their own application
  - Policy 4: Students can delete only their own application
  - Policy 5: Admins can read all applications
  - Policy 6: Admins can update all applications
  - Policy 7: Admins can delete applications

  ## Notes
  - Default status is 'draft'
  - user_id must be unique (one application per user)
  - dynamic_data is JSONB for flexible schema
  - Automatic timestamp updates on modification
*/

-- Create applicants table
CREATE TABLE IF NOT EXISTS applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  dynamic_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE applicants ENABLE ROW LEVEL SECURITY;

-- Create policies for students
CREATE POLICY "Students can read own application"
  ON applicants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students can insert own application"
  ON applicants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can update own application"
  ON applicants FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can delete own application"
  ON applicants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for admins
CREATE POLICY "Admins can read all applications"
  ON applicants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all applications"
  ON applicants FOR UPDATE
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

CREATE POLICY "Admins can delete applications"
  ON applicants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create trigger for applicants table
CREATE TRIGGER update_applicants_updated_at
  BEFORE UPDATE ON applicants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);

-- Create index on dynamic_data for JSONB queries
CREATE INDEX IF NOT EXISTS idx_applicants_dynamic_data ON applicants USING GIN(dynamic_data);
