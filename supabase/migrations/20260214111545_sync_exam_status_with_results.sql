/*
  # Sync Exam Status with Results

  ## Overview
  Ensures exam_status in applicants table is correctly synced with exam_results

  ## Problem
  Some applicants may have incorrect exam_status values that don't match their actual exam results
  (e.g., showing 'failed' when they actually passed)

  ## Solution
  Update all applicants' exam_status based on their latest completed exam result:
  - If passed = true → exam_status = 'completed' (will show as "Lulus")
  - If passed = false → exam_status = 'failed' (will show as "Tidak Lulus")
  - If no completed results → keep current status

  ## Impact
  - Fixes any inconsistencies between exam_results and applicants table
  - Ensures monitoring dashboard shows correct exam status
*/

-- Update exam_status for all applicants based on their latest exam result
UPDATE applicants a
SET 
  exam_status = CASE 
    WHEN er.passed = true THEN 'completed'
    WHEN er.passed = false THEN 'failed'
    ELSE a.exam_status
  END,
  exam_score = er.percentage
FROM (
  SELECT DISTINCT ON (ea.applicant_id)
    ea.applicant_id,
    er.passed,
    er.percentage,
    er.grading_status
  FROM exam_attempts ea
  JOIN exam_results er ON er.attempt_id = ea.id
  WHERE er.grading_status = 'completed'
    AND er.passed IS NOT NULL
  ORDER BY ea.applicant_id, ea.submitted_at DESC NULLS LAST
) er
WHERE a.id = er.applicant_id;

-- Log the update
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Synced exam_status for % applicants', v_updated_count;
END $$;
