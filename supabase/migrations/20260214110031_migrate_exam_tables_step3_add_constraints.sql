/*
  # Step 3: Add Foreign Key Constraints Referencing user_id

  1. Changes
    - Add foreign key for exam_token_batches.created_by -> profiles.user_id
    - Add foreign key for exam_tokens.assigned_by -> profiles.user_id
*/

-- Add foreign key constraints referencing profiles.user_id
ALTER TABLE exam_token_batches
ADD CONSTRAINT exam_token_batches_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES profiles(user_id)
ON DELETE SET NULL;

ALTER TABLE exam_tokens
ADD CONSTRAINT exam_tokens_assigned_by_fkey
FOREIGN KEY (assigned_by)
REFERENCES profiles(user_id)
ON DELETE SET NULL;
