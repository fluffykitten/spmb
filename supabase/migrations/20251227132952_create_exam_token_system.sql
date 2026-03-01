/*
  # Exam Token System

  ## Overview
  Comprehensive token-based access control system for exams with security features
  and usage tracking.

  ## New Tables
  
  ### `exam_tokens`
  Main token table for exam access control
  - `id` (uuid, primary key)
  - `exam_id` (uuid, references exams)
  - `token_code` (text, unique) - The actual token string
  - `token_type` ('single_use' | 'multi_use' | 'unlimited')
  - `max_uses` (integer) - Maximum times token can be used (null for unlimited)
  - `current_uses` (integer) - Current usage count
  - `assigned_to` (uuid, nullable, references applicants) - For student-specific tokens
  - `assigned_by` (uuid, references profiles) - Admin who created token
  - `valid_from` (timestamptz) - Token validity start
  - `valid_until` (timestamptz) - Token validity end
  - `is_active` (boolean) - Active status
  - `allowed_attempts` (integer) - Max exam attempts with this token
  - `ip_whitelist` (text[]) - Allowed IP addresses (empty = all)
  - `metadata` (jsonb) - Additional token metadata
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `exam_token_usage`
  Track every token usage attempt
  - `id` (uuid, primary key)
  - `token_id` (uuid, references exam_tokens)
  - `applicant_id` (uuid, references applicants)
  - `exam_attempt_id` (uuid, nullable, references exam_attempts)
  - `used_at` (timestamptz)
  - `ip_address` (inet)
  - `user_agent` (text)
  - `success` (boolean) - Whether token validation succeeded
  - `failure_reason` (text, nullable)
  - `device_fingerprint` (text, nullable)

  ### `exam_token_batches`
  For bulk token generation and management
  - `id` (uuid, primary key)
  - `exam_id` (uuid, references exams)
  - `batch_name` (text)
  - `token_count` (integer)
  - `token_type` ('single_use' | 'multi_use' | 'unlimited')
  - `created_by` (uuid, references profiles)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Admin-only access for token management
  - Students can only redeem tokens, not view them
  - Comprehensive audit logging

  ## Changes
  - Add `token_id` to `exam_attempts` table
  - Add indexes for performance
*/

-- Create enum for token types
DO $$ BEGIN
  CREATE TYPE exam_token_type AS ENUM ('single_use', 'multi_use', 'unlimited');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Main exam tokens table
CREATE TABLE IF NOT EXISTS exam_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  token_code text NOT NULL UNIQUE,
  token_type exam_token_type NOT NULL DEFAULT 'single_use',
  max_uses integer DEFAULT 1,
  current_uses integer DEFAULT 0,
  assigned_to uuid REFERENCES applicants(id) ON DELETE SET NULL,
  assigned_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  allowed_attempts integer DEFAULT 1,
  ip_whitelist text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_max_uses CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT valid_current_uses CHECK (current_uses >= 0),
  CONSTRAINT valid_allowed_attempts CHECK (allowed_attempts > 0),
  CONSTRAINT valid_dates CHECK (valid_until IS NULL OR valid_until > valid_from)
);

-- Token usage tracking
CREATE TABLE IF NOT EXISTS exam_token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES exam_tokens(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  exam_attempt_id uuid REFERENCES exam_attempts(id) ON DELETE SET NULL,
  used_at timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text,
  success boolean DEFAULT false,
  failure_reason text,
  device_fingerprint text,
  created_at timestamptz DEFAULT now()
);

-- Token batches for bulk generation
CREATE TABLE IF NOT EXISTS exam_token_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  batch_name text NOT NULL,
  token_count integer NOT NULL,
  token_type exam_token_type NOT NULL DEFAULT 'single_use',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_token_count CHECK (token_count > 0 AND token_count <= 10000)
);

-- Add token_id to exam_attempts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_attempts' AND column_name = 'token_id'
  ) THEN
    ALTER TABLE exam_attempts ADD COLUMN token_id uuid REFERENCES exam_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_tokens_exam_id ON exam_tokens(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_assigned_to ON exam_tokens(assigned_to);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_token_code ON exam_tokens(token_code);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_active ON exam_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_exam_token_usage_token_id ON exam_token_usage(token_id);
CREATE INDEX IF NOT EXISTS idx_exam_token_usage_applicant_id ON exam_token_usage(applicant_id);
CREATE INDEX IF NOT EXISTS idx_exam_token_batches_exam_id ON exam_token_batches(exam_id);

-- Enable RLS
ALTER TABLE exam_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_token_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_tokens
CREATE POLICY "Admins can manage all tokens"
  ON exam_tokens FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for exam_token_usage
CREATE POLICY "Admins can view all token usage"
  ON exam_token_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert token usage"
  ON exam_token_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for exam_token_batches
CREATE POLICY "Admins can manage token batches"
  ON exam_token_batches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to generate secure token code
CREATE OR REPLACE FUNCTION generate_exam_token_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_code text;
  exists_check boolean;
BEGIN
  LOOP
    -- Generate token: EXAM-XXXX-XXXX-XXXX (12 alphanumeric chars)
    token_code := 'EXAM-' || 
                  upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
                  upper(substring(md5(random()::text) from 1 for 4)) || '-' ||
                  upper(substring(md5(random()::text) from 1 for 4));
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM exam_tokens WHERE exam_tokens.token_code = generate_exam_token_code.token_code) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN token_code;
END;
$$;

-- Function to validate and redeem token
CREATE OR REPLACE FUNCTION redeem_exam_token(
  p_token_code text,
  p_applicant_id uuid,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_device_fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token exam_tokens%ROWTYPE;
  v_exam_id uuid;
  v_usage_count integer;
  v_attempt_count integer;
  v_result jsonb;
BEGIN
  -- Find and lock token
  SELECT * INTO v_token
  FROM exam_tokens
  WHERE token_code = p_token_code
  FOR UPDATE;
  
  -- Token not found
  IF NOT FOUND THEN
    INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
    VALUES (NULL, p_applicant_id, false, 'Token not found', p_ip_address, p_user_agent, p_device_fingerprint);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token tidak ditemukan'
    );
  END IF;
  
  -- Check if token is active
  IF NOT v_token.is_active THEN
    INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
    VALUES (v_token.id, p_applicant_id, false, 'Token inactive', p_ip_address, p_user_agent, p_device_fingerprint);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token tidak aktif'
    );
  END IF;
  
  -- Check validity period
  IF v_token.valid_from > now() THEN
    INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
    VALUES (v_token.id, p_applicant_id, false, 'Token not yet valid', p_ip_address, p_user_agent, p_device_fingerprint);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token belum dapat digunakan'
    );
  END IF;
  
  IF v_token.valid_until IS NOT NULL AND v_token.valid_until < now() THEN
    INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
    VALUES (v_token.id, p_applicant_id, false, 'Token expired', p_ip_address, p_user_agent, p_device_fingerprint);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token sudah kadaluarsa'
    );
  END IF;
  
  -- Check if token is assigned to specific student
  IF v_token.assigned_to IS NOT NULL AND v_token.assigned_to != p_applicant_id THEN
    INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
    VALUES (v_token.id, p_applicant_id, false, 'Token assigned to different student', p_ip_address, p_user_agent, p_device_fingerprint);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token ini tidak dapat Anda gunakan'
    );
  END IF;
  
  -- Check usage limits
  IF v_token.token_type != 'unlimited' THEN
    IF v_token.max_uses IS NOT NULL AND v_token.current_uses >= v_token.max_uses THEN
      INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
      VALUES (v_token.id, p_applicant_id, false, 'Token usage limit reached', p_ip_address, p_user_agent, p_device_fingerprint);
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Token sudah mencapai batas penggunaan'
      );
    END IF;
  END IF;
  
  -- Check IP whitelist
  IF array_length(v_token.ip_whitelist, 1) > 0 AND p_ip_address IS NOT NULL THEN
    IF NOT (p_ip_address::text = ANY(v_token.ip_whitelist)) THEN
      INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
      VALUES (v_token.id, p_applicant_id, false, 'IP not whitelisted', p_ip_address, p_user_agent, p_device_fingerprint);
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Token tidak dapat digunakan dari lokasi ini'
      );
    END IF;
  END IF;
  
  -- Check if student has already used this token (for single_use)
  IF v_token.token_type = 'single_use' THEN
    SELECT COUNT(*) INTO v_usage_count
    FROM exam_token_usage
    WHERE token_id = v_token.id
    AND applicant_id = p_applicant_id
    AND success = true;
    
    IF v_usage_count > 0 THEN
      INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
      VALUES (v_token.id, p_applicant_id, false, 'Token already used by student', p_ip_address, p_user_agent, p_device_fingerprint);
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Anda sudah menggunakan token ini sebelumnya'
      );
    END IF;
  END IF;
  
  -- Check exam attempt limits
  SELECT COUNT(*) INTO v_attempt_count
  FROM exam_attempts
  WHERE exam_id = v_token.exam_id
  AND applicant_id = p_applicant_id;
  
  IF v_attempt_count >= v_token.allowed_attempts THEN
    INSERT INTO exam_token_usage (token_id, applicant_id, success, failure_reason, ip_address, user_agent, device_fingerprint)
    VALUES (v_token.id, p_applicant_id, false, 'Attempt limit reached', p_ip_address, p_user_agent, p_device_fingerprint);
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Anda sudah mencapai batas percobaan untuk ujian ini'
    );
  END IF;
  
  -- All validations passed - log successful usage
  INSERT INTO exam_token_usage (token_id, applicant_id, success, ip_address, user_agent, device_fingerprint)
  VALUES (v_token.id, p_applicant_id, true, p_ip_address, p_user_agent, p_device_fingerprint);
  
  -- Increment usage count
  UPDATE exam_tokens
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = v_token.id;
  
  -- Return success with exam info
  RETURN jsonb_build_object(
    'success', true,
    'token_id', v_token.id,
    'exam_id', v_token.exam_id,
    'allowed_attempts', v_token.allowed_attempts,
    'current_attempts', v_attempt_count
  );
END;
$$;

-- Function to bulk generate tokens
CREATE OR REPLACE FUNCTION generate_exam_token_batch(
  p_exam_id uuid,
  p_batch_name text,
  p_token_count integer,
  p_token_type exam_token_type,
  p_max_uses integer,
  p_allowed_attempts integer,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid;
  v_token_code text;
  i integer;
BEGIN
  -- Validate inputs
  IF p_token_count <= 0 OR p_token_count > 10000 THEN
    RAISE EXCEPTION 'Token count must be between 1 and 10000';
  END IF;
  
  -- Create batch record
  INSERT INTO exam_token_batches (exam_id, batch_name, token_count, token_type, created_by)
  VALUES (p_exam_id, p_batch_name, p_token_count, p_token_type, p_created_by)
  RETURNING id INTO v_batch_id;
  
  -- Generate tokens
  FOR i IN 1..p_token_count LOOP
    v_token_code := generate_exam_token_code();
    
    INSERT INTO exam_tokens (
      exam_id,
      token_code,
      token_type,
      max_uses,
      allowed_attempts,
      valid_from,
      valid_until,
      assigned_by,
      metadata
    ) VALUES (
      p_exam_id,
      v_token_code,
      p_token_type,
      p_max_uses,
      p_allowed_attempts,
      p_valid_from,
      p_valid_until,
      p_created_by,
      jsonb_build_object('batch_id', v_batch_id)
    );
  END LOOP;
  
  RETURN v_batch_id;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exam_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER exam_tokens_updated_at
  BEFORE UPDATE ON exam_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_exam_tokens_updated_at();
