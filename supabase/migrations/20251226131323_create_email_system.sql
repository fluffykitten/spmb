/*
  # Email Notification System

  1. New Tables
    - `email_logs`
      - `id` (uuid, primary key)
      - `recipient_email` (text) - Email address of recipient
      - `recipient_type` (text) - Type: interviewer, student, admin
      - `recipient_user_id` (uuid, nullable) - Link to auth.users if available
      - `email_type` (text) - Type of email: interview_assigned, interview_reminder, etc.
      - `subject` (text) - Email subject line
      - `status` (text) - Status: pending, sent, failed, bounced
      - `error_message` (text, nullable) - Error details if failed
      - `interview_request_id` (uuid, nullable) - Related interview request
      - `sent_by` (uuid) - Admin who triggered the email
      - `sent_at` (timestamptz, nullable) - When email was sent
      - `created_at` (timestamptz) - When log entry was created

    - `email_templates`
      - `id` (uuid, primary key)
      - `template_key` (text, unique) - Unique identifier for template
      - `template_name` (text) - Human-readable name
      - `subject` (text) - Email subject with variable placeholders
      - `html_body` (text) - HTML email body with variable placeholders
      - `text_body` (text) - Plain text version
      - `variables` (jsonb) - Array of available variables
      - `is_active` (boolean) - Whether template is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updates to Existing Tables
    - Add email preferences to `interviewers` table

  3. Security
    - Enable RLS on both tables
    - Admin-only access for email logs
    - Admin-only access for email templates
*/

-- Create email_logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  recipient_type text CHECK (recipient_type IN ('interviewer', 'student', 'admin')),
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email_type text NOT NULL,
  subject text NOT NULL,
  status text CHECK (status IN ('pending', 'sent', 'failed', 'bounced')) DEFAULT 'pending',
  error_message text,
  interview_request_id uuid REFERENCES interview_requests(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  template_name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add email preferences to interviewers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interviewers' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE interviewers ADD COLUMN email_notifications boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interviewers' AND column_name = 'phone'
  ) THEN
    ALTER TABLE interviewers ADD COLUMN phone text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
CREATE POLICY "Admins can view all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email logs"
  ON email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update email logs"
  ON email_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for email_templates
CREATE POLICY "Admins can view all email templates"
  ON email_templates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email templates"
  ON email_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update email templates"
  ON email_templates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete email templates"
  ON email_templates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_interview_request_id ON email_logs(interview_request_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_templates_template_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_is_active ON email_templates(is_active);

-- Insert default email template for interview assignment
INSERT INTO email_templates (template_key, template_name, subject, html_body, text_body, variables, is_active)
VALUES (
  'interview_assigned',
  'Interview Assignment Notification',
  'Interview Assignment - {{student_name}}',
  '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f8f9fa; padding: 20px; }
    .details { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Interview Assignment</h1>
    </div>
    <div class="content">
      <p>Halo <strong>{{interviewer_name}}</strong>,</p>
      <p>Anda telah ditugaskan untuk melakukan interview dengan siswa berikut:</p>

      <div class="details">
        <div class="detail-row">
          <span class="label">Nama Siswa:</span> {{student_name}}
        </div>
        <div class="detail-row">
          <span class="label">No. Registrasi:</span> {{registration_number}}
        </div>
        <div class="detail-row">
          <span class="label">Tanggal:</span> {{interview_date}}
        </div>
        <div class="detail-row">
          <span class="label">Waktu:</span> {{interview_time}}
        </div>
        <div class="detail-row">
          <span class="label">Tipe:</span> {{interview_type}}
        </div>
        {{#if meeting_link}}
        <div class="detail-row">
          <span class="label">Meeting Link:</span> <a href="{{meeting_link}}">{{meeting_link}}</a>
        </div>
        {{/if}}
        {{#if admin_notes}}
        <div class="detail-row">
          <span class="label">Catatan Admin:</span> {{admin_notes}}
        </div>
        {{/if}}
      </div>

      <p>Mohon konfirmasi kehadiran Anda dan persiapkan materi interview yang diperlukan.</p>
      <p>Terima kasih atas dedikasi Anda!</p>
    </div>
    <div class="footer">
      <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
    </div>
  </div>
</body>
</html>',
  'Halo {{interviewer_name}},

Anda telah ditugaskan untuk melakukan interview dengan siswa berikut:

Nama Siswa: {{student_name}}
No. Registrasi: {{registration_number}}
Tanggal: {{interview_date}}
Waktu: {{interview_time}}
Tipe: {{interview_type}}
{{#if meeting_link}}
Meeting Link: {{meeting_link}}
{{/if}}
{{#if admin_notes}}
Catatan Admin: {{admin_notes}}
{{/if}}

Mohon konfirmasi kehadiran Anda dan persiapkan materi interview yang diperlukan.

Terima kasih atas dedikasi Anda!

---
Email ini dikirim secara otomatis. Mohon tidak membalas email ini.',
  '["interviewer_name", "student_name", "registration_number", "interview_date", "interview_time", "interview_type", "meeting_link", "admin_notes"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO NOTHING;
