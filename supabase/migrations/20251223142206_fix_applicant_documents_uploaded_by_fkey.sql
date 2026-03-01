/*
  # Fix Applicant Documents Foreign Key Constraint

  1. Changes
    - Drop existing foreign key constraint on `applicant_documents.uploaded_by` that references `profiles(id)`
    - Recreate constraint to reference `profiles(user_id)` instead

  2. Reason
    - The code uses `auth.uid()` which maps to `profiles.user_id`, not `profiles.id`
    - This aligns with the auth pattern used throughout the application
    - Fixes the foreign key violation error when admins upload documents

  3. Impact
    - Allows document uploads to work correctly
    - Maintains referential integrity with proper auth user ID mapping
*/

-- Drop the existing foreign key constraint
ALTER TABLE applicant_documents
  DROP CONSTRAINT IF EXISTS applicant_documents_uploaded_by_fkey;

-- Add the corrected foreign key constraint referencing profiles(user_id)
ALTER TABLE applicant_documents
  ADD CONSTRAINT applicant_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by)
  REFERENCES profiles(user_id)
  ON DELETE SET NULL;
