/*
  # Add Registration Number System

  ## Description
  This migration adds a registration number system to the applicants table.
  The registration number format is: AcademicYear_RegistrationDate_SequentialNumber
  Example: 2627231225001 (Academic Year 2026-2027, Date 25 Dec 2023, Applicant #001)

  ## Changes Made

  1. **Add registration_number column to applicants table**
     - `registration_number` (text, unique) - The formatted registration number

  2. **Create registration_counters table**
     - Tracks daily counters for sequential numbering
     - One counter per date to ensure unique sequential numbers

  3. **Create function to generate registration numbers**
     - Automatically generates registration numbers based on:
       * Current academic year (calculated from date)
       * Registration date (YYMMDD format)
       * Sequential counter for that day

  4. **Create trigger to auto-generate registration numbers**
     - Triggers when applicant status changes from 'draft' to 'submitted'
     - Ensures registration number is assigned only when application is submitted

  ## Security
  - RLS is automatically inherited from the applicants table
  - Counter table uses service role for generation

  ## Notes
  - Registration numbers are generated only when status changes from 'draft' to 'submitted'
  - Academic year is calculated: if month >= July (7), year is current_year to current_year+1
    otherwise year is current_year-1 to current_year
  - Counter is reset daily automatically
*/

-- Add registration_number column to applicants table
ALTER TABLE applicants
ADD COLUMN IF NOT EXISTS registration_number text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applicants_registration_number
ON applicants(registration_number);

-- Create registration_counters table for tracking daily counters
CREATE TABLE IF NOT EXISTS registration_counters (
  date date PRIMARY KEY,
  counter integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on registration_counters
ALTER TABLE registration_counters ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage counters (used by trigger function)
CREATE POLICY "Service role can manage counters"
  ON registration_counters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to generate registration number
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reg_date date;
  reg_year text;
  academic_year text;
  date_part text;
  counter_val integer;
  new_reg_number text;
  start_year text;
  end_year text;
  current_month integer;
BEGIN
  -- Get current date and month
  reg_date := CURRENT_DATE;
  current_month := EXTRACT(MONTH FROM reg_date);

  -- Calculate academic year (July to June)
  -- If month >= July (7), academic year is current_year to current_year+1
  -- Otherwise, academic year is current_year-1 to current_year
  IF current_month >= 7 THEN
    start_year := SUBSTRING(EXTRACT(YEAR FROM reg_date)::text, 3, 2);
    end_year := SUBSTRING((EXTRACT(YEAR FROM reg_date) + 1)::text, 3, 2);
  ELSE
    start_year := SUBSTRING((EXTRACT(YEAR FROM reg_date) - 1)::text, 3, 2);
    end_year := SUBSTRING(EXTRACT(YEAR FROM reg_date)::text, 3, 2);
  END IF;

  academic_year := start_year || end_year;

  -- Format date as YYMMDD
  date_part := TO_CHAR(reg_date, 'YYMMDD');

  -- Get and increment counter for this date
  INSERT INTO registration_counters (date, counter)
  VALUES (reg_date, 1)
  ON CONFLICT (date)
  DO UPDATE SET
    counter = registration_counters.counter + 1,
    updated_at = now()
  RETURNING counter INTO counter_val;

  -- Format counter with leading zeros (3 digits)
  new_reg_number := academic_year || date_part || LPAD(counter_val::text, 3, '0');

  RETURN new_reg_number;
END;
$$;

-- Create trigger function to auto-generate registration number
CREATE OR REPLACE FUNCTION auto_generate_registration_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only generate registration number when status changes from draft to submitted
  -- and registration_number is not already set
  IF NEW.status = 'submitted'
     AND (OLD.status IS NULL OR OLD.status = 'draft')
     AND NEW.registration_number IS NULL THEN
    NEW.registration_number := generate_registration_number();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on applicants table
DROP TRIGGER IF EXISTS trigger_auto_generate_registration_number ON applicants;

CREATE TRIGGER trigger_auto_generate_registration_number
  BEFORE INSERT OR UPDATE ON applicants
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_registration_number();

-- Add comment to the column
COMMENT ON COLUMN applicants.registration_number IS
'Registration number format: AcademicYear_Date_Counter (e.g., 2627231225001)';
