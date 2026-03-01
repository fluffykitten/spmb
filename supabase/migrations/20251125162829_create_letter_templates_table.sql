/*
  # Create letter_templates table

  ## Description
  This migration creates the letter_templates table for storing customizable
  document templates (e.g., acceptance letters, rejection letters) with HTML content.

  ## New Tables
  1. `letter_templates`
    - `id` (uuid, primary key) - Unique identifier for the template
    - `name` (text) - Template name/identifier
    - `html_content` (text) - HTML content of the template
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
  - Enable Row Level Security (RLS) on letter_templates table
  - Policy 1: All authenticated users can read templates
  - Policy 2: Only admins can insert templates
  - Policy 3: Only admins can update templates
  - Policy 4: Only admins can delete templates

  ## Notes
  - Template names should be unique
  - HTML content stored as text for flexibility
  - Automatic timestamp updates on modification
  - Students need read access to view their letters
*/

-- Create letter_templates table
CREATE TABLE IF NOT EXISTS letter_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  html_content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can read templates"
  ON letter_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert templates"
  ON letter_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update templates"
  ON letter_templates FOR UPDATE
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

CREATE POLICY "Admins can delete templates"
  ON letter_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create trigger for letter_templates table
CREATE TRIGGER update_letter_templates_updated_at
  BEFORE UPDATE ON letter_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_letter_templates_name ON letter_templates(name);
