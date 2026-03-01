/*
  # Create WhatsApp Notification System

  1. New Tables
    - `whatsapp_templates` - Stores message templates for different notification types
      - `id` (uuid, primary key)
      - `template_key` (text, unique) - Identifier for the template type
      - `template_name` (text) - Human-readable name
      - `message_body` (text) - Template message with variable placeholders
      - `variables` (jsonb) - Array of available variables
      - `is_active` (boolean) - Enable/disable template
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `whatsapp_logs` - Logs all WhatsApp notification attempts
      - `id` (uuid, primary key)
      - `recipient_phone` (text) - Phone number of recipient
      - `recipient_name` (text) - Name of recipient
      - `message_type` (text) - Template key used
      - `message_body` (text) - Actual message sent
      - `status` (text) - sent, failed, pending
      - `error_message` (text) - Error details if failed
      - `applicant_id` (uuid) - Reference to applicant
      - `sent_by` (uuid) - User who triggered the notification
      - `sent_at` (timestamptz) - When notification was sent
      - `retry_count` (integer) - Number of retry attempts
      - `created_at` (timestamptz)

  2. Changes
    - Add `phone_number` to profiles table for user contact info
    - Add WhatsApp configuration keys to app_config table

  3. Security
    - Enable RLS on both tables
    - Admins have full access to both tables
    - Users can view their own notification logs
    - Templates are readable by authenticated users

  4. Default Templates
    - Registration success
    - Application submitted
    - Application approved
    - Application rejected
    - Application needs revision
    - Interview scheduled
*/

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  template_name text NOT NULL,
  message_body text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create whatsapp_logs table
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone text NOT NULL,
  recipient_name text,
  message_type text NOT NULL,
  message_body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  applicant_id uuid REFERENCES applicants(id) ON DELETE SET NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add phone_number column to profiles table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_number text;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_key ON whatsapp_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_active ON whatsapp_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_applicant ON whatsapp_logs(applicant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON whatsapp_logs(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON whatsapp_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);

-- Enable RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_templates
CREATE POLICY "Authenticated users can read templates"
  ON whatsapp_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON whatsapp_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for whatsapp_logs
CREATE POLICY "Admins can view all logs"
  ON whatsapp_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own notification logs"
  ON whatsapp_logs FOR SELECT
  TO authenticated
  USING (
    sent_by = auth.uid()
    OR
    applicant_id IN (
      SELECT id FROM applicants
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert logs"
  ON whatsapp_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update logs"
  ON whatsapp_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default WhatsApp templates
INSERT INTO whatsapp_templates (template_key, template_name, message_body, variables, is_active)
VALUES
  (
    'registration_success',
    'Welcome Message - Registration Success',
    E'Selamat datang di Sistem SPMB!\n\nHalo {{nama_lengkap}},\n\nAkun Anda telah berhasil didaftarkan dengan email: {{email}}\n\nSilakan login dan lengkapi formulir pendaftaran Anda.\n\nTerima kasih.',
    '["nama_lengkap", "email"]'::jsonb,
    true
  ),
  (
    'application_submitted',
    'Application Submitted Confirmation',
    E'Pendaftaran Diterima!\n\nHalo {{nama_lengkap}},\n\nFormulir pendaftaran Anda telah berhasil dikirim.\n\nNomor Registrasi: {{registration_number}}\nTanggal Submit: {{tanggal_submit}}\n\nSilakan tunggu proses verifikasi dari admin.\n\nTerima kasih.',
    '["nama_lengkap", "registration_number", "tanggal_submit"]'::jsonb,
    true
  ),
  (
    'application_approved',
    'Application Approved',
    E'Selamat! Pendaftaran Disetujui\n\nHalo {{nama_lengkap}},\n\nKami dengan senang hati memberitahukan bahwa pendaftaran Anda telah DISETUJUI.\n\nNomor Registrasi: {{registration_number}}\n\nSilakan cek dashboard Anda untuk informasi lebih lanjut.\n\nSelamat!',
    '["nama_lengkap", "registration_number"]'::jsonb,
    true
  ),
  (
    'application_rejected',
    'Application Rejected',
    E'Pemberitahuan Status Pendaftaran\n\nHalo {{nama_lengkap}},\n\nMohon maaf, pendaftaran Anda dengan nomor registrasi {{registration_number}} belum dapat kami setujui saat ini.\n\nUntuk informasi lebih lanjut, silakan hubungi admin.\n\nTerima kasih.',
    '["nama_lengkap", "registration_number"]'::jsonb,
    true
  ),
  (
    'application_needs_revision',
    'Application Needs Revision',
    E'Revisi Diperlukan - Pendaftaran\n\nHalo {{nama_lengkap}},\n\nPendaftaran Anda memerlukan revisi.\n\nNomor Registrasi: {{registration_number}}\n\nKomentar Admin:\n{{admin_comments}}\n\nSilakan login dan perbaiki data Anda sesuai komentar di atas.\n\nTerima kasih.',
    '["nama_lengkap", "registration_number", "admin_comments"]'::jsonb,
    true
  ),
  (
    'interview_scheduled',
    'Interview Scheduled',
    E'Jadwal Wawancara\n\nHalo {{nama_lengkap}},\n\nWawancara Anda telah dijadwalkan:\n\nTanggal: {{interview_date}}\nWaktu: {{interview_time}}\nJenis: {{interview_type}}\n\n{{meeting_details}}\n\nCatatan: {{admin_notes}}\n\nMohon hadir tepat waktu. Terima kasih.',
    '["nama_lengkap", "interview_date", "interview_time", "interview_type", "meeting_details", "admin_notes"]'::jsonb,
    true
  ),
  (
    'custom_message',
    'Custom Message Template',
    E'Halo {{nama_lengkap}},\n\n{{message_content}}\n\nTerima kasih.',
    '["nama_lengkap", "message_content"]'::jsonb,
    true
  )
ON CONFLICT (template_key) DO NOTHING;

-- Insert WhatsApp configuration into app_config if not exists
INSERT INTO app_config (key, value)
VALUES
  ('fonnte_api_token', '""'::jsonb),
  ('fonnte_country_code', '"62"'::jsonb),
  ('fonnte_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add updated_at trigger for whatsapp_templates
CREATE OR REPLACE FUNCTION update_whatsapp_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_whatsapp_template_updated_at
  BEFORE UPDATE ON whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_template_updated_at();

-- Add comments for documentation
COMMENT ON TABLE whatsapp_templates IS 'Stores WhatsApp message templates for different notification types';
COMMENT ON TABLE whatsapp_logs IS 'Logs all WhatsApp notification attempts and their results';
COMMENT ON COLUMN profiles.phone_number IS 'User phone number for WhatsApp notifications (format: 628xxx)';
