/*
  # Create app_config table

  ## Description
  This migration creates the app_config table for storing system-wide configuration
  settings in a key-value format with JSONB values for maximum flexibility.

  ## New Tables
  1. `app_config`
    - `key` (text, primary key) - Unique configuration key
    - `value` (jsonb) - Configuration value in flexible JSONB format
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
  - Enable Row Level Security (RLS) on app_config table
  - Policy 1: All authenticated users can read config
  - Policy 2: Only admins can insert config
  - Policy 3: Only admins can update config
  - Policy 4: Only admins can delete config

  ## Notes
  - Key is the primary key (unique identifier)
  - JSONB value allows storing complex configuration objects
  - Automatic timestamp updates on modification
  - Students can read config for UI customization
*/

-- Create app_config table
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All authenticated users can read config"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert config"
  ON app_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update config"
  ON app_config FOR UPDATE
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

CREATE POLICY "Admins can delete config"
  ON app_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create trigger for app_config table
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index on value for JSONB queries
CREATE INDEX IF NOT EXISTS idx_app_config_value ON app_config USING GIN(value);
