/*
  # Fix generate_exam_token_code Function

  ## Changes
  - Fix name collision in EXISTS query
  - Change qualified reference to use variable directly
  
  ## Security
  - Maintains SECURITY DEFINER for safe token generation
*/

-- Drop and recreate function with fix
DROP FUNCTION IF EXISTS generate_exam_token_code();

CREATE OR REPLACE FUNCTION generate_exam_token_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_code text;
  v_exists_check boolean;
BEGIN
  LOOP
    -- Generate token: EXAM-XXXX-XXXX-XXXX (12 alphanumeric chars)
    v_token_code := 'EXAM-' || 
                  upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
                  upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
                  upper(substring(md5(random()::text) from 1 for 4));
    
    -- Check if token already exists
    SELECT EXISTS(
      SELECT 1 FROM exam_tokens 
      WHERE token_code = v_token_code
    ) INTO v_exists_check;
    
    EXIT WHEN NOT v_exists_check;
  END LOOP;
  
  RETURN v_token_code;
END;
$$;
