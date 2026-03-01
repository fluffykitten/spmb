/*
  # Simplify Exam Token Format to 5 Characters

  ## Changes
  - Update generate_exam_token_code() function to generate simple 5-character codes
  - Format: [A-Z0-9]{5} (e.g., AB12C, XY9Z3)
  - Maintain uniqueness check
  
  ## Security
  - Maintains SECURITY DEFINER for safe token generation
  - Still ensures no duplicate tokens
*/

-- Drop and recreate function with simplified format
DROP FUNCTION IF EXISTS generate_exam_token_code();

CREATE OR REPLACE FUNCTION generate_exam_token_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token_code text;
  v_exists_check boolean;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars like O, 0, I, 1
  v_result text := '';
  v_i integer;
BEGIN
  LOOP
    v_result := '';
    
    -- Generate 5 random characters
    FOR v_i IN 1..5 LOOP
      v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    
    v_token_code := v_result;
    
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