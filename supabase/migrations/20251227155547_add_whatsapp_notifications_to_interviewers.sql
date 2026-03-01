/*
  # Add WhatsApp Notifications Support for Interviewers

  1. Changes
    - Add `whatsapp_notifications` column to `interviewers` table
      - Boolean field to enable/disable WhatsApp notifications per interviewer
      - Defaults to true (enabled)
    
  2. Notes
    - Existing `phone` column will be used to store WhatsApp number
    - Admin can control whether each interviewer receives WhatsApp notifications
    - Email notifications remain separate with existing `email_notifications` column
*/

-- Add whatsapp_notifications column to interviewers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interviewers' AND column_name = 'whatsapp_notifications'
  ) THEN
    ALTER TABLE interviewers ADD COLUMN whatsapp_notifications boolean DEFAULT true;
  END IF;
END $$;