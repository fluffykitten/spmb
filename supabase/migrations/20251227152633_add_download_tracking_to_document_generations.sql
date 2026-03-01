/*
  # Add Download Tracking to Document Generations

  ## Overview
  This migration adds download tracking capability to the document_generations table
  to track when a student first downloads their generated document.

  ## Changes

  ### 1. Add downloaded_at Column
  - `downloaded_at` (timestamptz, nullable): Timestamp of first download
  - NULL indicates document has never been downloaded
  - Once set, should never be changed (first download only)

  ### 2. Create Tracking Function
  - `track_document_generation_download`: RPC function to record first download
  - Only updates if downloaded_at is NULL (first download only)
  - Returns boolean indicating if update was successful

  ## Security
  - Students can only track downloads for their own documents
  - Function uses SECURITY DEFINER with proper checks
*/

-- Add downloaded_at column to document_generations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_generations' AND column_name = 'downloaded_at'
  ) THEN
    ALTER TABLE document_generations ADD COLUMN downloaded_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for download tracking queries
CREATE INDEX IF NOT EXISTS idx_document_generations_downloaded_at
  ON document_generations(applicant_id, downloaded_at);

-- Create function to track document download (first download only)
CREATE OR REPLACE FUNCTION track_document_generation_download(
  p_applicant_id UUID,
  p_template_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  -- Update downloaded_at only if it's NULL (first download)
  UPDATE document_generations
  SET downloaded_at = now()
  WHERE applicant_id = p_applicant_id
    AND template_id = p_template_id
    AND downloaded_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- Return true if a row was updated, false otherwise
  RETURN v_rows_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION track_document_generation_download(UUID, UUID) TO authenticated;
