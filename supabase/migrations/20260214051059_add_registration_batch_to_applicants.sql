/*
  # Add Registration Batch Reference to Applicants

  1. Schema Changes
    - Add `registration_batch_id` column to `applicants` table
    - Add foreign key constraint to `registration_batches`
    - Add index for performance

  2. Functions
    - Create `auto_assign_registration_batch` function to automatically assign batch based on submission date
    - Create trigger to call this function when applicant status changes to submitted

  3. Important Notes
    - Column is nullable to support applicants registered before batch system
    - Auto-assignment happens when status changes from 'draft' to any other status
    - Uses the applicant's created_at date to find matching batch
*/

-- Add registration_batch_id column to applicants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'registration_batch_id'
  ) THEN
    ALTER TABLE applicants ADD COLUMN registration_batch_id uuid REFERENCES registration_batches(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_applicants_batch ON applicants(registration_batch_id);
    COMMENT ON COLUMN applicants.registration_batch_id IS 'Reference to the registration batch this applicant belongs to, auto-assigned based on registration date';
  END IF;
END $$;

-- Function to auto-assign registration batch based on date
CREATE OR REPLACE FUNCTION auto_assign_registration_batch()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  matching_batch_id uuid;
BEGIN
  -- Only auto-assign if:
  -- 1. Status changed from draft to something else (submission)
  -- 2. Batch is not already assigned
  IF NEW.status != 'draft' AND (OLD.status IS NULL OR OLD.status = 'draft') AND NEW.registration_batch_id IS NULL THEN
    -- Find the most specific matching batch (smallest date range that includes created_at)
    SELECT id INTO matching_batch_id
    FROM registration_batches
    WHERE is_active = true
      AND DATE(NEW.created_at) >= start_date
      AND DATE(NEW.created_at) <= end_date
    ORDER BY (end_date - start_date) ASC  -- Prefer narrower date ranges
    LIMIT 1;

    -- Assign the batch if found
    IF matching_batch_id IS NOT NULL THEN
      NEW.registration_batch_id := matching_batch_id;
      
      -- Log the auto-assignment
      INSERT INTO audit_logs (user_id, action, target_user_id, details)
      VALUES (
        NEW.user_id,
        'auto_assign_batch',
        NEW.user_id,
        jsonb_build_object(
          'applicant_id', NEW.id,
          'batch_id', matching_batch_id,
          'registration_date', NEW.created_at
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS trigger_auto_assign_batch ON applicants;
CREATE TRIGGER trigger_auto_assign_batch
  BEFORE UPDATE OF status ON applicants
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_registration_batch();

-- Also handle new inserts that are already submitted (edge case)
CREATE OR REPLACE FUNCTION auto_assign_batch_on_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  matching_batch_id uuid;
BEGIN
  -- Only auto-assign if status is not draft and batch not already assigned
  IF NEW.status != 'draft' AND NEW.registration_batch_id IS NULL THEN
    SELECT id INTO matching_batch_id
    FROM registration_batches
    WHERE is_active = true
      AND DATE(NEW.created_at) >= start_date
      AND DATE(NEW.created_at) <= end_date
    ORDER BY (end_date - start_date) ASC
    LIMIT 1;

    IF matching_batch_id IS NOT NULL THEN
      NEW.registration_batch_id := matching_batch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_assign_batch_on_insert ON applicants;
CREATE TRIGGER trigger_auto_assign_batch_on_insert
  BEFORE INSERT ON applicants
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_batch_on_insert();