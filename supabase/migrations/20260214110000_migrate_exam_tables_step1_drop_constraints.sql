/*
  # Step 1: Drop Foreign Key Constraints

  1. Changes
    - Drop exam_token_batches foreign key
    - Drop exam_tokens foreign key
    - This allows us to update the data without constraint violations
*/

-- Drop existing foreign key constraints
ALTER TABLE exam_token_batches
DROP CONSTRAINT IF EXISTS exam_token_batches_created_by_fkey;

ALTER TABLE exam_tokens
DROP CONSTRAINT IF EXISTS exam_tokens_assigned_by_fkey;
