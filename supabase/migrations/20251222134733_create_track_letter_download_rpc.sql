/*
  # Create RPC Function for Letter Download Tracking

  ## Purpose
  Provides a secure RPC function to track when students download letters.
  
  ## Changes
  
  1. **RPC Function: track_letter_download**
     - Updates download_count and sets downloaded_at on first download
     - Can only be called by authenticated users who own the letter
     - Atomic operation to prevent race conditions
  
  ## Security
  - SECURITY DEFINER to allow proper updates
  - Validates user owns the applicant record associated with the letter
  - Prevents unauthorized tracking updates
*/

-- Create RPC function to track letter downloads
CREATE OR REPLACE FUNCTION track_letter_download(letter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_id uuid;
BEGIN
  -- Get the applicant_id for this letter
  SELECT applicant_id INTO v_applicant_id
  FROM generated_letters
  WHERE id = letter_id;

  -- Check if user owns this letter
  IF NOT EXISTS (
    SELECT 1 FROM applicants
    WHERE id = v_applicant_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized access to letter';
  END IF;

  -- Update download tracking
  UPDATE generated_letters
  SET 
    downloaded_at = COALESCE(downloaded_at, now()),
    download_count = download_count + 1
  WHERE id = letter_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION track_letter_download(uuid) TO authenticated;
