/*
  # Create Letter Number Counters and Generated Letters Tables

  ## Overview
  Creates two new tables to support letter generation system:
  1. letter_number_counters - Track auto-incrementing letter numbers
  2. generated_letters - Store history of all generated letters

  ## Tables Created

  ### 1. letter_number_counters
  Tracks letter number counters per template with year/month granularity
  
  Columns:
  - id (uuid, primary key)
  - template_id (uuid, foreign key to letter_templates)
  - year (integer) - Year for counter reset
  - month (integer) - Month for counter reset (optional)
  - current_counter (integer) - Current counter value
  - last_used_at (timestamptz) - Last time counter was used
  - created_at (timestamptz)
  - updated_at (timestamptz)

  Unique constraint: (template_id, year, month)
  Purpose: Prevent duplicate letter numbers

  ### 2. generated_letters
  Stores complete history of all generated letters
  
  Columns:
  - id (uuid, primary key)
  - applicant_id (uuid, foreign key to applicants)
  - template_id (uuid, foreign key to letter_templates)
  - letter_number (text) - Generated letter number
  - generated_by (uuid, foreign key to profiles)
  - generated_at (timestamptz)
  - pdf_url (text) - URL to PDF in storage
  - html_content (text) - Generated HTML content
  - variables_data (jsonb) - Data used for variable replacement
  - status (text) - 'draft', 'finalized', 'sent', 'cancelled'
  - notes (text) - Optional admin notes
  - created_at (timestamptz)
  - updated_at (timestamptz)

  Indexes:
  - (applicant_id, template_id, generated_at) - Fast lookup
  - (letter_number) - Unique letter number search
  - (status) - Filter by status
  - (generated_at) - Date range queries

  ## Security
  - RLS enabled on both tables
  - Admin can read/write all records
  - Students can only read their own letters
  - Audit logging for letter generation

  ## Usage
  - Auto-increment letter numbers per template
  - Track all generated letters with full audit trail
  - Support letter regeneration and updates
  - Enable letter status tracking
*/

-- Create letter_number_counters table
CREATE TABLE IF NOT EXISTS letter_number_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL DEFAULT 0,
  current_counter INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure unique counter per template, year, and month
  UNIQUE(template_id, year, month)
);

-- Create index for fast counter lookup
CREATE INDEX IF NOT EXISTS idx_letter_counters_template_year_month 
  ON letter_number_counters(template_id, year, month);

-- Create generated_letters table
CREATE TABLE IF NOT EXISTS generated_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE SET NULL,
  letter_number TEXT NOT NULL,
  generated_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  pdf_url TEXT,
  html_content TEXT NOT NULL,
  variables_data JSONB DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure letter numbers are unique
  UNIQUE(letter_number),
  
  -- Ensure status is valid
  CHECK (status IN ('draft', 'finalized', 'sent', 'cancelled'))
);

-- Create indexes for generated_letters
CREATE INDEX IF NOT EXISTS idx_generated_letters_applicant 
  ON generated_letters(applicant_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_letters_template 
  ON generated_letters(template_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_letters_status 
  ON generated_letters(status);

CREATE INDEX IF NOT EXISTS idx_generated_letters_number 
  ON generated_letters(letter_number);

CREATE INDEX IF NOT EXISTS idx_generated_letters_generated_at 
  ON generated_letters(generated_at DESC);

-- Enable RLS on letter_number_counters
ALTER TABLE letter_number_counters ENABLE ROW LEVEL SECURITY;

-- Policies for letter_number_counters (admin only)
CREATE POLICY "Admins can read all counters"
  ON letter_number_counters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert counters"
  ON letter_number_counters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update counters"
  ON letter_number_counters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Enable RLS on generated_letters
ALTER TABLE generated_letters ENABLE ROW LEVEL SECURITY;

-- Policies for generated_letters
CREATE POLICY "Admins can read all letters"
  ON generated_letters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Students can read their own letters"
  ON generated_letters FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert letters"
  ON generated_letters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update letters"
  ON generated_letters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete letters"
  ON generated_letters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_letter_counters_updated_at ON letter_number_counters;
CREATE TRIGGER update_letter_counters_updated_at
  BEFORE UPDATE ON letter_number_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generated_letters_updated_at ON generated_letters;
CREATE TRIGGER update_generated_letters_updated_at
  BEFORE UPDATE ON generated_letters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();