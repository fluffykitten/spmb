/*
  # Convert to Full Manual Grading System

  1. Changes
    - Drop `auto_grade_answer_trigger` on `exam_answers` - no more automatic grading of MC/TF questions
    - Drop `recalculate_result_on_answer_change` on `exam_answers` - no more automatic result recalculation on every answer save
    - Update `calculate_exam_result` function to treat ALL question types as manually graded
    - Grading status now checks ALL answers (not just essay) for `points_earned IS NULL`
    - `passed` is now always set to NULL by default - admin decides pass/fail manually
    - Change `passed` column default from `false` to `NULL`

  2. Security
    - No RLS changes
    - Existing policies remain intact

  3. Important Notes
    - All grading (MC, TF, essay) is now done manually by admin
    - Admin can use "Mark by Answer Key" shortcut button in UI for MC/TF
    - Pass/fail decision is fully manual by admin
    - The `update_applicant_exam_status` trigger still works correctly since it reads `passed` from `exam_results`
*/

-- 1. Drop auto-grading trigger (was grading MC/TF automatically on insert/update)
DROP TRIGGER IF EXISTS auto_grade_answer_trigger ON exam_answers;

-- 2. Drop auto-recalculate trigger (was recalculating results on every answer change)
DROP TRIGGER IF EXISTS recalculate_result_on_answer_change ON exam_answers;

-- 3. Change passed column default to NULL
ALTER TABLE exam_results ALTER COLUMN passed SET DEFAULT NULL;

-- 4. Replace calculate_exam_result function for full manual grading
CREATE OR REPLACE FUNCTION calculate_exam_result(p_attempt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_points numeric := 0;
  v_max_points numeric := 0;
  v_manual_graded_points numeric := 0;
  v_percentage numeric;
  v_grading_status text;
  v_graded_count integer;
  v_total_answer_count integer;
  v_exam_id uuid;
BEGIN
  SELECT exam_id INTO v_exam_id
  FROM exam_attempts
  WHERE id = p_attempt_id;

  SELECT COALESCE(SUM(eq.points), 0) INTO v_max_points
  FROM exam_questions eq
  WHERE eq.exam_id = v_exam_id;

  SELECT COALESCE(SUM(ea.points_earned), 0) INTO v_manual_graded_points
  FROM exam_answers ea
  WHERE ea.attempt_id = p_attempt_id
  AND ea.points_earned IS NOT NULL;

  SELECT
    COUNT(*) FILTER (WHERE ea.points_earned IS NOT NULL),
    COUNT(*)
  INTO v_graded_count, v_total_answer_count
  FROM exam_answers ea
  WHERE ea.attempt_id = p_attempt_id;

  IF v_total_answer_count = 0 THEN
    v_grading_status := 'pending';
  ELSIF v_graded_count = 0 THEN
    v_grading_status := 'pending';
  ELSIF v_graded_count < v_total_answer_count THEN
    v_grading_status := 'partial';
  ELSE
    v_grading_status := 'completed';
  END IF;

  v_total_points := v_manual_graded_points;

  IF v_max_points > 0 THEN
    v_percentage := (v_total_points / v_max_points) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  INSERT INTO exam_results (
    attempt_id,
    total_points,
    max_points,
    percentage,
    passed,
    auto_graded_points,
    manual_graded_points,
    grading_status
  ) VALUES (
    p_attempt_id,
    v_total_points,
    v_max_points,
    v_percentage,
    NULL,
    0,
    v_manual_graded_points,
    v_grading_status
  )
  ON CONFLICT (attempt_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    max_points = EXCLUDED.max_points,
    percentage = EXCLUDED.percentage,
    auto_graded_points = EXCLUDED.auto_graded_points,
    manual_graded_points = EXCLUDED.manual_graded_points,
    grading_status = EXCLUDED.grading_status,
    updated_at = now();

  RAISE NOTICE 'Exam result calculated - Attempt: %, Max: %, Total: %, Pct: %, Status: %, Graded: %/%',
    p_attempt_id, v_max_points, v_total_points, v_percentage, v_grading_status, v_graded_count, v_total_answer_count;
END;
$$;
