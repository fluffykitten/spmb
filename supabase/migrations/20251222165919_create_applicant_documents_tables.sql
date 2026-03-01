/*
  # Create applicant documents system

  1. New Tables
    - `applicant_documents`
      - `id` (uuid, primary key)
      - `name` (text) - Display name for the document
      - `description` (text, nullable) - Brief description
      - `file_path` (text) - Storage path in Supabase Storage
      - `file_url` (text) - Public URL for download
      - `access_rule` (text) - Access control: 'always', 'after_submission', 'after_approval', 'after_rejection'
      - `display_order` (integer) - Sort priority (lower = higher priority)
      - `is_active` (boolean) - Show/hide document
      - `uploaded_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `document_downloads`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to applicant_documents)
      - `applicant_id` (uuid, foreign key to applicants)
      - `downloaded_at` (timestamptz)
      - `download_count` (integer)

  2. Security
    - Enable RLS on both tables
    - Admins: Full access to applicant_documents
    - Students: Read-only access to active documents based on their status and access_rule
    - Download tracking: Students can insert, admins can view all
    
  3. Indexes
    - Index on access_rule for filtering
    - Index on is_active for filtering
    - Index on display_order for sorting
    - Composite index on document_id and applicant_id for download tracking
*/

-- Create applicant_documents table
CREATE TABLE IF NOT EXISTS applicant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_url text NOT NULL,
  access_rule text NOT NULL CHECK (access_rule IN ('always', 'after_submission', 'after_approval', 'after_rejection')),
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create document_downloads tracking table
CREATE TABLE IF NOT EXISTS document_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES applicant_documents(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  downloaded_at timestamptz DEFAULT now(),
  download_count integer DEFAULT 1,
  UNIQUE(document_id, applicant_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_applicant_documents_access_rule ON applicant_documents(access_rule);
CREATE INDEX IF NOT EXISTS idx_applicant_documents_is_active ON applicant_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_applicant_documents_display_order ON applicant_documents(display_order);
CREATE INDEX IF NOT EXISTS idx_document_downloads_document_id ON document_downloads(document_id);
CREATE INDEX IF NOT EXISTS idx_document_downloads_applicant_id ON document_downloads(applicant_id);

-- Enable RLS
ALTER TABLE applicant_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_downloads ENABLE ROW LEVEL SECURITY;

-- Policies for applicant_documents
-- Admins can do everything
CREATE POLICY "Admins can view all documents"
  ON applicant_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert documents"
  ON applicant_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update documents"
  ON applicant_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete documents"
  ON applicant_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Students can view active documents based on their status
CREATE POLICY "Students can view accessible documents"
  ON applicant_documents FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      access_rule = 'always'
      OR (
        access_rule = 'after_submission'
        AND EXISTS (
          SELECT 1 FROM applicants
          WHERE applicants.user_id = auth.uid()
          AND applicants.status IN ('submitted', 'approved', 'rejected')
        )
      )
      OR (
        access_rule = 'after_approval'
        AND EXISTS (
          SELECT 1 FROM applicants
          WHERE applicants.user_id = auth.uid()
          AND applicants.status = 'approved'
        )
      )
      OR (
        access_rule = 'after_rejection'
        AND EXISTS (
          SELECT 1 FROM applicants
          WHERE applicants.user_id = auth.uid()
          AND applicants.status = 'rejected'
        )
      )
    )
  );

-- Policies for document_downloads
-- Admins can view all download records
CREATE POLICY "Admins can view all download records"
  ON document_downloads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Students can insert download records for their own applicant record
CREATE POLICY "Students can track their own downloads"
  ON document_downloads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = applicant_id
      AND applicants.user_id = auth.uid()
    )
  );

-- Students can update their own download records
CREATE POLICY "Students can update their own download records"
  ON document_downloads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = applicant_id
      AND applicants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = applicant_id
      AND applicants.user_id = auth.uid()
    )
  );

-- Students can view their own download records
CREATE POLICY "Students can view their own download records"
  ON document_downloads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = applicant_id
      AND applicants.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_applicant_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_applicant_documents_updated_at ON applicant_documents;
CREATE TRIGGER trigger_update_applicant_documents_updated_at
  BEFORE UPDATE ON applicant_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_applicant_documents_updated_at();