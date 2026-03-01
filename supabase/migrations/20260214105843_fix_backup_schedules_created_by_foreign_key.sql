/*
  # Fix backup_schedules created_by Foreign Key

  1. Issue
    - Foreign key `backup_schedules_created_by_fkey` points to `profiles.id`
    - Should reference `profiles.user_id` to match auth.uid()

  2. Solution
    - Drop the existing foreign key constraint
    - Recreate it to reference `profiles.user_id` instead

  3. Changes
    - Drop `backup_schedules_created_by_fkey` constraint
    - Add new foreign key referencing `profiles.user_id`
*/

-- Drop the existing foreign key constraint
ALTER TABLE backup_schedules
DROP CONSTRAINT IF EXISTS backup_schedules_created_by_fkey;

-- Add new foreign key constraint referencing profiles.user_id
ALTER TABLE backup_schedules
ADD CONSTRAINT backup_schedules_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES profiles(user_id)
ON DELETE SET NULL;
