/*
  # Fix applicant_documents and document_downloads table policies - correct user_id reference

  1. Issue
    - Current policies check `profiles.id = auth.uid()`
    - But profiles.id is the profile's primary key, NOT the auth user ID
    - Should check `profiles.user_id = auth.uid()` instead

  2. Changes
    - Drop all existing policies on both tables
    - Recreate with correct user_id reference
    - Ensures admin role checks work properly

  3. Security
    - Admins: Full CRUD access to applicant_documents
    - Students: Read-only access based on access rules and status
    - Download tracking: Students can manage their own records, admins can view all
*/

-- Drop existing policies on applicant_documents
DROP POLICY IF EXISTS "Admins can view all documents" ON applicant_documents;
DROP POLICY IF EXISTS "Admins can insert documents" ON applicant_documents;
DROP POLICY IF EXISTS "Admins can update documents" ON applicant_documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON applicant_documents;
DROP POLICY IF EXISTS "Students can view accessible documents" ON applicant_documents;

-- Drop existing policies on document_downloads
DROP POLICY IF EXISTS "Admins can view all download records" ON document_downloads;
DROP POLICY IF EXISTS "Students can track their own downloads" ON document_downloads;
DROP POLICY IF EXISTS "Students can update their own download records" ON document_downloads;
DROP POLICY IF EXISTS "Students can view their own download records" ON document_downloads;

-- Recreate applicant_documents policies with correct user_id reference
CREATE POLICY "Admins can view all documents"
  ON applicant_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert documents"
  ON applicant_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update documents"
  ON applicant_documents FOR UPDATE
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

CREATE POLICY "Admins can delete documents"
  ON applicant_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
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

-- Recreate document_downloads policies with correct user_id reference
CREATE POLICY "Admins can view all download records"
  ON document_downloads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

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
