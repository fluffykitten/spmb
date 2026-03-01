/*
  # Payment Management System

  ## Overview
  Creates a comprehensive payment tracking system with support for two payment types:
  - Entrance Fee (Biaya Masuk)
  - Administration Fee (Biaya Administrasi)

  ## New Tables
  
  ### `payment_records`
  Main payment tracking table with the following columns:
  - `id` (uuid, primary key) - Unique identifier for each payment record
  - `applicant_id` (uuid, foreign key) - Links to applicants table
  - `payment_type` (text) - Type of payment: 'entrance_fee' or 'administration_fee'
  - `payment_status` (text) - Status: 'unpaid', 'partial', 'paid', 'waived'
  - `total_amount` (numeric) - Total amount that needs to be paid
  - `paid_amount` (numeric) - Total amount that has been paid so far
  - `payment_method` (text, nullable) - Method: 'cash', 'transfer', 'other'
  - `payment_notes` (text, nullable) - Admin notes about this payment
  - `payment_date` (timestamptz, nullable) - Date of payment
  - `updated_by` (uuid, foreign key) - Admin who last updated this record
  - `updated_at` (timestamptz) - Last update timestamp
  - `created_at` (timestamptz) - Creation timestamp
  - **Unique Constraint**: (applicant_id, payment_type) - Each applicant has one record per payment type

  ### `payment_history`
  Payment history/changelog table:
  - `id` (uuid, primary key) - Unique identifier for each history entry
  - `payment_record_id` (uuid, foreign key) - Links to payment_records table
  - `amount` (numeric) - Amount paid in this transaction
  - `payment_method` (text) - Payment method used
  - `payment_date` (timestamptz) - Date of this payment
  - `notes` (text, nullable) - Notes about this payment
  - `recorded_by` (uuid, foreign key) - Admin who recorded this payment
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on both tables
  - Admin: Full access to all payment records
  - Students: Can read their own payment records only
  - All payment updates are logged to audit system

  ## Important Notes
  1. Payment records are created automatically when applicant submits form
  2. Each payment can be tracked incrementally (partial payments)
  3. Payment history maintains complete audit trail of all transactions
  4. Remaining balance is calculated as: total_amount - paid_amount
*/

-- Create payment_records table
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  payment_type text NOT NULL CHECK (payment_type IN ('entrance_fee', 'administration_fee')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'waived')),
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount numeric NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
  payment_method text CHECK (payment_method IN ('cash', 'transfer', 'other')),
  payment_notes text,
  payment_date timestamptz,
  updated_by uuid REFERENCES profiles(user_id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (applicant_id, payment_type)
);

-- Create payment_history table
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id uuid NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  payment_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  recorded_by uuid NOT NULL REFERENCES profiles(user_id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on payment_records
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- Enable RLS on payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can read all payment records
CREATE POLICY "Admins can read all payment records"
  ON payment_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policy: Students can read their own payment records
CREATE POLICY "Students can read own payment records"
  ON payment_records
  FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicants
      WHERE applicants.user_id = auth.uid()
    )
  );

-- RLS Policy: Admins can insert payment records
CREATE POLICY "Admins can insert payment records"
  ON payment_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policy: Admins can update payment records
CREATE POLICY "Admins can update payment records"
  ON payment_records
  FOR UPDATE
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

-- RLS Policy: Admins can delete payment records
CREATE POLICY "Admins can delete payment records"
  ON payment_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policy: Admins can read all payment history
CREATE POLICY "Admins can read all payment history"
  ON payment_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policy: Students can read their own payment history
CREATE POLICY "Students can read own payment history"
  ON payment_history
  FOR SELECT
  TO authenticated
  USING (
    payment_record_id IN (
      SELECT pr.id FROM payment_records pr
      JOIN applicants a ON a.id = pr.applicant_id
      WHERE a.user_id = auth.uid()
    )
  );

-- RLS Policy: Admins can insert payment history
CREATE POLICY "Admins can insert payment history"
  ON payment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payment_records_applicant_id ON payment_records(applicant_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_type ON payment_records(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_status ON payment_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_record_id ON payment_history(payment_record_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_date ON payment_history(payment_date DESC);

-- Create updated_at trigger for payment_records
CREATE OR REPLACE FUNCTION update_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_records_updated_at
  BEFORE UPDATE ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_records_updated_at();

-- Create view for user monitoring status
CREATE OR REPLACE VIEW user_monitoring_status AS
SELECT 
  p.id as profile_id,
  p.user_id,
  p.full_name,
  p.email,
  p.phone_number,
  p.role,
  p.is_active,
  a.id as applicant_id,
  a.registration_number,
  a.status as form_status,
  a.created_at as application_date,
  a.interview_status,
  a.interview_score,
  a.exam_status,
  a.exam_score,
  a.final_score,
  
  -- Document download statistics
  (SELECT COUNT(DISTINCT dd.document_id) 
   FROM document_downloads dd 
   WHERE dd.applicant_id = a.id) as documents_downloaded_count,
  (SELECT COUNT(*) 
   FROM applicant_documents 
   WHERE is_active = true) as total_documents_count,
  
  -- Interview request data
  (SELECT ir.status 
   FROM interview_requests ir 
   WHERE ir.applicant_id = a.id 
   ORDER BY ir.created_at DESC 
   LIMIT 1) as latest_interview_request_status,
  
  -- Exam attempt data
  (SELECT COUNT(*) 
   FROM exam_attempts ea 
   WHERE ea.applicant_id = a.id) as exam_attempts_count,
  
  -- Payment status for entrance fee
  (SELECT pr.payment_status 
   FROM payment_records pr 
   WHERE pr.applicant_id = a.id 
   AND pr.payment_type = 'entrance_fee') as entrance_fee_status,
  (SELECT pr.paid_amount 
   FROM payment_records pr 
   WHERE pr.applicant_id = a.id 
   AND pr.payment_type = 'entrance_fee') as entrance_fee_paid,
  (SELECT pr.total_amount 
   FROM payment_records pr 
   WHERE pr.applicant_id = a.id 
   AND pr.payment_type = 'entrance_fee') as entrance_fee_total,
  
  -- Payment status for administration fee
  (SELECT pr.payment_status 
   FROM payment_records pr 
   WHERE pr.applicant_id = a.id 
   AND pr.payment_type = 'administration_fee') as administration_fee_status,
  (SELECT pr.paid_amount 
   FROM payment_records pr 
   WHERE pr.applicant_id = a.id 
   AND pr.payment_type = 'administration_fee') as administration_fee_paid,
  (SELECT pr.total_amount 
   FROM payment_records pr 
   WHERE pr.applicant_id = a.id 
   AND pr.payment_type = 'administration_fee') as administration_fee_total

FROM profiles p
LEFT JOIN applicants a ON a.user_id = p.user_id
WHERE p.role = 'student'
ORDER BY p.created_at DESC;

-- Grant access to the view
GRANT SELECT ON user_monitoring_status TO authenticated;

COMMENT ON TABLE payment_records IS 'Tracks payment status for entrance and administration fees with support for partial payments';
COMMENT ON TABLE payment_history IS 'Maintains complete audit trail of all payment transactions';
COMMENT ON VIEW user_monitoring_status IS 'Comprehensive view of student progress including form, documents, interviews, exams, and payments';