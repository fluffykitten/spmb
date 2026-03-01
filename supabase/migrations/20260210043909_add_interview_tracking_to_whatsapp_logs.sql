/*
  # Add Interview Tracking to WhatsApp Logs

  1. Changes
    - Add `interview_request_id` column to `whatsapp_logs` table
      - UUID foreign key to `interview_requests` table
      - Nullable (not all WhatsApp notifications are interview-related)
      - Used to track WhatsApp notifications sent for interview requests
    
    - Add `recipient_user_id` column to `whatsapp_logs` table
      - UUID foreign key to `auth.users` table
      - Nullable (maintains backward compatibility)
      - Used to track which user received the notification
    
  2. Security
    - No RLS policy changes needed
    - Existing policies remain in place
    
  3. Performance
    - Add indexes for common query patterns
    - Improves performance when filtering by interview_request_id
    
  4. Notes
    - Maintains backward compatibility with existing WhatsApp logs
    - Allows better tracking of interview-related notifications
    - Enables querying all notifications for a specific interview request
*/

-- Add interview_request_id column to whatsapp_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_logs' AND column_name = 'interview_request_id'
  ) THEN
    ALTER TABLE whatsapp_logs ADD COLUMN interview_request_id uuid;
    
    -- Add foreign key constraint
    ALTER TABLE whatsapp_logs 
    ADD CONSTRAINT whatsapp_logs_interview_request_id_fkey 
    FOREIGN KEY (interview_request_id) 
    REFERENCES interview_requests(id) 
    ON DELETE SET NULL;
    
    -- Add index for performance
    CREATE INDEX idx_whatsapp_logs_interview_request_id 
    ON whatsapp_logs(interview_request_id) 
    WHERE interview_request_id IS NOT NULL;
    
    COMMENT ON COLUMN whatsapp_logs.interview_request_id IS 'Foreign key to interview_requests table for tracking interview-related notifications';
  END IF;
END $$;

-- Add recipient_user_id column to whatsapp_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_logs' AND column_name = 'recipient_user_id'
  ) THEN
    ALTER TABLE whatsapp_logs ADD COLUMN recipient_user_id uuid;
    
    -- Add foreign key constraint
    ALTER TABLE whatsapp_logs 
    ADD CONSTRAINT whatsapp_logs_recipient_user_id_fkey 
    FOREIGN KEY (recipient_user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;
    
    -- Add index for performance
    CREATE INDEX idx_whatsapp_logs_recipient_user_id 
    ON whatsapp_logs(recipient_user_id) 
    WHERE recipient_user_id IS NOT NULL;
    
    COMMENT ON COLUMN whatsapp_logs.recipient_user_id IS 'Foreign key to auth.users table for tracking which user received the notification';
  END IF;
END $$;