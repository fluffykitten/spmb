/*
  # Step 2: Update Data to Use user_id

  1. Changes
    - Convert exam_tokens.assigned_by from profile.id to profile.user_id
    - Convert exam_token_batches.created_by from profile.id to profile.user_id
*/

-- Update exam_tokens: convert profile.id to profile.user_id
UPDATE exam_tokens
SET assigned_by = p.user_id
FROM profiles p
WHERE exam_tokens.assigned_by = p.id
AND exam_tokens.assigned_by IS NOT NULL;

-- Update exam_token_batches: convert profile.id to profile.user_id
UPDATE exam_token_batches
SET created_by = p.user_id
FROM profiles p
WHERE exam_token_batches.created_by = p.id
AND exam_token_batches.created_by IS NOT NULL;
