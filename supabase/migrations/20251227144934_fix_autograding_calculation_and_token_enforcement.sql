/*
  # Fix Autograding Calculation and Token Enforcement

  ## Problem 1: Autograding Bug
  The calculate_exam_result function was calculating max_points only from ANSWERED questions.
  This caused incorrect percentage calculations when students didn't answer all questions.
  
  ## Problem 2: Token Not Enforced
  Students could start exams without redeeming a token.

  ## Changes
  
  ### 1. Fix calculate_exam_result Function
  - Change max_points calculation to include ALL questions in the exam, not just answered ones
  - This ensures percentage is calculated correctly: (points_earned / total_possible_points) * 100
  
  ### 2. Add Token Validation RPC
  - Create function to check if student has valid redeemed token for an exam
  - Returns token_id if valid, null if not
*/

-- Fix the calculate_exam_result function
CREATE OR REPLACE FUNCTION calculate_exam_result(p_attempt_id uuid)
RETURNS void AS $$
DECLARE
  v_total_points numeric := 0;
  v_max_points numeric := 0;
  v_auto_graded_points numeric := 0;
  v_manual_graded_points numeric := 0;
  v_percentage numeric;
  v_passing_score numeric;
  v_passed boolean;
  v_grading_status text;
  v_has_essay boolean;
  v_essay_graded_count integer;
  v_essay_total_count integer;
  v_exam_id uuid;
BEGIN
  -- Get exam_id for this attempt
  SELECT exam_id INTO v_exam_id
  FROM exam_attempts
  WHERE id = p_attempt_id;

  -- Calculate max points from ALL questions in the exam (not just answered ones)
  SELECT COALESCE(SUM(eq.points), 0) INTO v_max_points
  FROM exam_questions eq
  WHERE eq.exam_id = v_exam_id;

  -- Calculate auto-graded points (multiple choice, true/false)
  SELECT COALESCE(SUM(ea.points_earned), 0) INTO v_auto_graded_points
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id
    AND eq.question_type IN ('multiple_choice', 'true_false')
    AND ea.points_earned IS NOT NULL;

  -- Calculate manual-graded points (essay)
  SELECT COALESCE(SUM(ea.points_earned), 0) INTO v_manual_graded_points
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id
    AND eq.question_type = 'essay'
    AND ea.points_earned IS NOT NULL;

  -- Check essay grading status
  SELECT 
    COUNT(*) FILTER (WHERE eq.question_type = 'essay') > 0,
    COUNT(*) FILTER (WHERE eq.question_type = 'essay' AND ea.points_earned IS NOT NULL),
    COUNT(*) FILTER (WHERE eq.question_type = 'essay')
  INTO v_has_essay, v_essay_graded_count, v_essay_total_count
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id;

  -- Determine grading status
  IF NOT v_has_essay THEN
    v_grading_status := 'completed';
  ELSIF v_essay_graded_count = 0 THEN
    v_grading_status := 'pending';
  ELSIF v_essay_graded_count < v_essay_total_count THEN
    v_grading_status := 'partial';
  ELSE
    v_grading_status := 'completed';
  END IF;

  -- Calculate total points
  v_total_points := v_auto_graded_points + v_manual_graded_points;

  -- Calculate percentage
  IF v_max_points > 0 THEN
    v_percentage := (v_total_points / v_max_points) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  -- Get passing score
  SELECT e.passing_score INTO v_passing_score
  FROM exam_attempts ea
  JOIN exams e ON e.id = ea.exam_id
  WHERE ea.id = p_attempt_id;

  -- Determine if passed (only if fully graded)
  v_passed := v_grading_status = 'completed' AND v_percentage >= v_passing_score;

  -- Insert or update result
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
    v_passed,
    v_auto_graded_points,
    v_manual_graded_points,
    v_grading_status
  )
  ON CONFLICT (attempt_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    max_points = EXCLUDED.max_points,
    percentage = EXCLUDED.percentage,
    passed = EXCLUDED.passed,
    auto_graded_points = EXCLUDED.auto_graded_points,
    manual_graded_points = EXCLUDED.manual_graded_points,
    grading_status = EXCLUDED.grading_status,
    updated_at = now();
    
  -- Log calculation for debugging
  RAISE NOTICE 'Exam result calculated - Attempt: %, Max Points: %, Total Points: %, Percentage: %, Status: %', 
    p_attempt_id, v_max_points, v_total_points, v_percentage, v_grading_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if student has valid token for exam
CREATE OR REPLACE FUNCTION check_exam_token_access(
  p_exam_id uuid,
  p_applicant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_usage exam_token_usage%ROWTYPE;
  v_token exam_tokens%ROWTYPE;
  v_attempt_count integer;
BEGIN
  -- Check if student has successfully redeemed a token for this exam
  SELECT etu.* INTO v_token_usage
  FROM exam_token_usage etu
  JOIN exam_tokens et ON et.id = etu.token_id
  WHERE et.exam_id = p_exam_id
    AND etu.applicant_id = p_applicant_id
    AND etu.success = true
  ORDER BY etu.used_at DESC
  LIMIT 1;
  
  -- No valid token found
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'error', 'Token belum diaktifkan untuk ujian ini'
    );
  END IF;
  
  -- Get token details
  SELECT * INTO v_token
  FROM exam_tokens
  WHERE id = v_token_usage.token_id;
  
  -- Check if token is still valid
  IF NOT v_token.is_active THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'error', 'Token sudah tidak aktif'
    );
  END IF;
  
  IF v_token.valid_until IS NOT NULL AND v_token.valid_until < now() THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'error', 'Token sudah kadaluarsa'
    );
  END IF;
  
  -- Check attempt limits
  SELECT COUNT(*) INTO v_attempt_count
  FROM exam_attempts
  WHERE exam_id = p_exam_id
    AND applicant_id = p_applicant_id;
  
  IF v_attempt_count >= v_token.allowed_attempts THEN
    RETURN jsonb_build_object(
      'has_access', false,
      'error', 'Batas percobaan ujian sudah tercapai'
    );
  END IF;
  
  -- All checks passed
  RETURN jsonb_build_object(
    'has_access', true,
    'token_id', v_token.id,
    'allowed_attempts', v_token.allowed_attempts,
    'current_attempts', v_attempt_count,
    'remaining_attempts', v_token.allowed_attempts - v_attempt_count
  );
END;
$$;