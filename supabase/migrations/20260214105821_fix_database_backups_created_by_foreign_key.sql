/*
  # Fix database_backups created_by Foreign Key

  1. Issue
    - Foreign key `database_backups_created_by_fkey` points to `profiles.id`
    - Code inserts `auth.uid()` which should reference `profiles.user_id`
    - This causes FK constraint violations

  2. Solution
    - Drop the existing foreign key constraint
    - Recreate it to reference `profiles.user_id` instead

  3. Changes
    - Drop `database_backups_created_by_fkey` constraint
    - Add new foreign key referencing `profiles.user_id`
*/

-- Drop the existing foreign key constraint
ALTER TABLE database_backups
DROP CONSTRAINT IF EXISTS database_backups_created_by_fkey;

-- Add new foreign key constraint referencing profiles.user_id
ALTER TABLE database_backups
ADD CONSTRAINT database_backups_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES profiles(user_id)
ON DELETE SET NULL;
