/*
  # Create get_activated_exam_ids RPC function

  1. New Functions
    - `get_activated_exam_ids(p_applicant_id uuid)` - Returns list of exam IDs 
      that a student has successfully activated via token redemption
    - Runs as SECURITY DEFINER to bypass RLS on exam_token_usage and exam_tokens
    - This fixes the bug where students cannot see their activated exams because
      RLS policies on exam_token_usage and exam_tokens only allow admin access

  2. Security
    - Function runs with SECURITY DEFINER (same pattern as existing 
      check_exam_token_access and redeem_exam_token functions)
    - Only returns exam IDs, no sensitive token details exposed
*/

CREATE OR REPLACE FUNCTION get_activated_exam_ids(p_applicant_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT et.exam_id)
  INTO v_exam_ids
  FROM exam_token_usage etu
  JOIN exam_tokens et ON et.id = etu.token_id
  WHERE etu.applicant_id = p_applicant_id
    AND etu.success = true
    AND et.is_active = true;

  IF v_exam_ids IS NULL THEN
    v_exam_ids := ARRAY[]::uuid[];
  END IF;

  RETURN v_exam_ids;
END;
$$;
