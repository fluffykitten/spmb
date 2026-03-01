/*
  # Add Interview and Exam Fields to Applicants

  Adds fields to track interview and exam status, scores, and final evaluation
  for each applicant in the selection process.

  ## Changes

  - Add interview_status field (not_scheduled, scheduled, completed, skipped)
  - Add interview_score field (numeric, nullable)
  - Add exam_status field (not_assigned, in_progress, completed, failed)
  - Add exam_score field (numeric, nullable)
  - Add final_score field (numeric, nullable) - weighted combination

  ## Notes

  Final score calculation will be done via application logic based on
  configurable weights for form data, interview, and exam scores.
*/

-- Add interview and exam tracking fields to applicants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'interview_status'
  ) THEN
    ALTER TABLE applicants ADD COLUMN interview_status text DEFAULT 'not_scheduled' 
      CHECK (interview_status IN ('not_scheduled', 'scheduled', 'completed', 'skipped'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'interview_score'
  ) THEN
    ALTER TABLE applicants ADD COLUMN interview_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'exam_status'
  ) THEN
    ALTER TABLE applicants ADD COLUMN exam_status text DEFAULT 'not_assigned' 
      CHECK (exam_status IN ('not_assigned', 'in_progress', 'completed', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'exam_score'
  ) THEN
    ALTER TABLE applicants ADD COLUMN exam_score numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applicants' AND column_name = 'final_score'
  ) THEN
    ALTER TABLE applicants ADD COLUMN final_score numeric;
  END IF;
END $$;

-- Create function to update applicant interview status and score
CREATE OR REPLACE FUNCTION update_applicant_interview_status()
RETURNS TRIGGER AS $$
DECLARE
  v_applicant_id uuid;
  v_new_status text;
  v_score numeric;
BEGIN
  v_applicant_id := NEW.applicant_id;

  -- Update interview status based on booking status
  IF NEW.status = 'completed' THEN
    v_new_status := 'completed';
    
    -- Get evaluation score if exists
    SELECT score INTO v_score
    FROM interview_evaluations
    WHERE booking_id = NEW.id;

    -- Update applicant
    UPDATE applicants 
    SET 
      interview_status = v_new_status,
      interview_score = COALESCE(v_score, interview_score)
    WHERE id = v_applicant_id;
    
  ELSIF NEW.status IN ('confirmed', 'pending') THEN
    v_new_status := 'scheduled';
    
    UPDATE applicants 
    SET interview_status = v_new_status
    WHERE id = v_applicant_id;
    
  ELSIF NEW.status = 'cancelled' THEN
    -- Only reset if no other completed bookings
    IF NOT EXISTS (
      SELECT 1 FROM interview_bookings 
      WHERE applicant_id = v_applicant_id 
        AND status = 'completed' 
        AND id != NEW.id
    ) THEN
      UPDATE applicants 
      SET interview_status = 'not_scheduled'
      WHERE id = v_applicant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for interview booking status changes
DROP TRIGGER IF EXISTS update_interview_status_trigger ON interview_bookings;
CREATE TRIGGER update_interview_status_trigger
  AFTER INSERT OR UPDATE OF status ON interview_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_applicant_interview_status();

-- Create function to update applicant interview score from evaluation
CREATE OR REPLACE FUNCTION update_applicant_interview_score()
RETURNS TRIGGER AS $$
DECLARE
  v_applicant_id uuid;
BEGIN
  -- Get applicant_id from booking
  SELECT applicant_id INTO v_applicant_id
  FROM interview_bookings
  WHERE id = NEW.booking_id;

  -- Update applicant interview score
  UPDATE applicants
  SET interview_score = NEW.score
  WHERE id = v_applicant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for interview evaluation changes
DROP TRIGGER IF EXISTS update_interview_score_trigger ON interview_evaluations;
CREATE TRIGGER update_interview_score_trigger
  AFTER INSERT OR UPDATE OF score ON interview_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_applicant_interview_score();

-- Create function to update applicant exam status and score
CREATE OR REPLACE FUNCTION update_applicant_exam_status()
RETURNS TRIGGER AS $$
DECLARE
  v_applicant_id uuid;
  v_new_status text;
  v_score numeric;
  v_percentage numeric;
  v_passed boolean;
BEGIN
  -- Get applicant_id from attempt
  SELECT applicant_id INTO v_applicant_id
  FROM exam_attempts
  WHERE id = NEW.attempt_id;

  -- Get result details
  SELECT percentage, passed INTO v_percentage, v_passed
  FROM exam_results
  WHERE attempt_id = NEW.attempt_id;

  -- Determine exam status
  IF NEW.grading_status = 'completed' THEN
    IF v_passed THEN
      v_new_status := 'completed';
      v_score := v_percentage;
    ELSE
      v_new_status := 'failed';
      v_score := v_percentage;
    END IF;

    -- Update applicant
    UPDATE applicants
    SET 
      exam_status = v_new_status,
      exam_score = v_score
    WHERE id = v_applicant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for exam result changes
DROP TRIGGER IF EXISTS update_exam_status_trigger ON exam_results;
CREATE TRIGGER update_exam_status_trigger
  AFTER INSERT OR UPDATE OF grading_status ON exam_results
  FOR EACH ROW
  EXECUTE FUNCTION update_applicant_exam_status();

-- Create function to update exam status when attempt starts
CREATE OR REPLACE FUNCTION mark_exam_in_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status IS DISTINCT FROM 'in_progress' THEN
    UPDATE applicants
    SET exam_status = 'in_progress'
    WHERE id = NEW.applicant_id
      AND exam_status = 'not_assigned';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for exam attempt status changes
DROP TRIGGER IF EXISTS mark_exam_in_progress_trigger ON exam_attempts;
CREATE TRIGGER mark_exam_in_progress_trigger
  AFTER INSERT OR UPDATE OF status ON exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION mark_exam_in_progress();