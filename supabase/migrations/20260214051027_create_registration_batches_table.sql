/*
  # Create Registration Batches Table

  1. New Tables
    - `registration_batches`
      - `id` (uuid, primary key)
      - `name` (text, unique) - Name of the registration batch (e.g., "Gelombang 1")
      - `description` (text, nullable) - Description of the batch
      - `start_date` (date) - Start date for this batch
      - `end_date` (date) - End date for this batch
      - `entrance_fee_amount` (numeric) - Entrance fee amount for this batch
      - `administration_fee_amount` (numeric) - Administration fee amount for this batch
      - `is_active` (boolean) - Whether this batch is active
      - `display_order` (integer) - Order for display in UI
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `registration_batches` table
    - Add policy for public read access to active batches
    - Add policy for admin full access

  3. Indexes
    - Add index on start_date and end_date for performance
    - Add unique constraint on name
*/

CREATE TABLE IF NOT EXISTS registration_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  entrance_fee_amount numeric NOT NULL DEFAULT 0 CHECK (entrance_fee_amount >= 0),
  administration_fee_amount numeric NOT NULL DEFAULT 0 CHECK (administration_fee_amount >= 0),
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_registration_batches_dates ON registration_batches(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_registration_batches_active ON registration_batches(is_active);

ALTER TABLE registration_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active registration batches"
  ON registration_batches
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can read all registration batches"
  ON registration_batches
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert registration batches"
  ON registration_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update registration batches"
  ON registration_batches
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete registration batches"
  ON registration_batches
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE registration_batches IS 'Stores registration batch information with specific fee amounts for each batch period';
COMMENT ON COLUMN registration_batches.name IS 'Unique name for the registration batch (e.g., Gelombang 1, Gelombang 2)';
COMMENT ON COLUMN registration_batches.entrance_fee_amount IS 'Entrance fee amount in IDR for this batch';
COMMENT ON COLUMN registration_batches.administration_fee_amount IS 'Administration fee amount in IDR for this batch';