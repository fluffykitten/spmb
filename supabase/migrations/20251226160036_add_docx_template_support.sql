/*
  # Add DOCX Template Support for Self-Service Document Generation

  ## Overview
  This migration adds comprehensive support for DOCX-based templates that students
  can use to generate their own documents. Includes:
  - DOCX template storage configuration
  - Global letterhead/kop surat settings
  - Generation limit tracking (3x per template per student)
  - Template availability rules based on student status

  ## Changes to letter_templates Table

  New Columns:
  - template_format: 'html' or 'docx'
  - docx_template_url: Path to .docx file in storage
  - docx_variables: Array of variables available in DOCX
  - docx_layout_config: Page size, margins, orientation
  - access_rule: Defines which students can access template
  - required_status: Array of applicant statuses that can use template
  - is_self_service: Boolean to enable student self-generation
  - generation_limit: Max times a student can generate (default 3)

  ## New Tables

  ### 1. letterhead_config
  Stores global letterhead/kop surat configuration

  ### 2. document_generations
  Tracks every document generation by students with limits

  ## Security
  - RLS policies ensure students only generate their own documents
  - Generation limits enforced at database level
  - Audit trail for all document generations
*/

-- Add new columns to letter_templates table
DO $$
BEGIN
  -- Template format: 'html' or 'docx'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'template_format'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN template_format TEXT DEFAULT 'html' CHECK (template_format IN ('html', 'docx'));
  END IF;

  -- URL to DOCX file in storage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'docx_template_url'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN docx_template_url TEXT;
  END IF;

  -- Variables available in DOCX template
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'docx_variables'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN docx_variables TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  -- Layout configuration for DOCX
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'docx_layout_config'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN docx_layout_config JSONB DEFAULT '{
      "page_size": "A4",
      "margin_top": 2.54,
      "margin_bottom": 2.54,
      "margin_left": 3.17,
      "margin_right": 3.17,
      "orientation": "portrait"
    }'::JSONB;
  END IF;

  -- Access rule for template availability
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'access_rule'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN access_rule TEXT DEFAULT 'status_based'
      CHECK (access_rule IN ('all', 'status_based', 'manual'));
  END IF;

  -- Required applicant status to access template
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'required_status'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN required_status TEXT[] DEFAULT ARRAY['approved']::TEXT[];
  END IF;

  -- Enable self-service generation by students
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'is_self_service'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN is_self_service BOOLEAN DEFAULT false;
  END IF;

  -- Generation limit per student
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'generation_limit'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN generation_limit INTEGER DEFAULT 3;
  END IF;

  -- Template description for students
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'description'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN description TEXT;
  END IF;

  -- Template type for categorization
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'template_type'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN template_type TEXT DEFAULT 'general';
  END IF;

  -- Variables array for HTML templates (compatibility)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letter_templates' AND column_name = 'variables'
  ) THEN
    ALTER TABLE letter_templates ADD COLUMN variables TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Create letterhead_config table for global kop surat
CREATE TABLE IF NOT EXISTS letterhead_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE DEFAULT 'global',
  school_name TEXT,
  school_address TEXT,
  school_phone TEXT,
  school_email TEXT,
  school_website TEXT,
  school_logo_url TEXT,
  foundation_name TEXT,
  foundation_logo_url TEXT,
  stamp_image_url TEXT,
  letterhead_style JSONB DEFAULT '{
    "logo_size": 80,
    "logo_position": "center",
    "show_foundation_logo": false,
    "border_style": "double",
    "text_align": "center"
  }'::JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on letterhead_config
ALTER TABLE letterhead_config ENABLE ROW LEVEL SECURITY;

-- Policies for letterhead_config
CREATE POLICY "Everyone can read active letterhead config"
  ON letterhead_config FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage letterhead config"
  ON letterhead_config FOR ALL
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

-- Insert default letterhead config
INSERT INTO letterhead_config (config_key, school_name, is_active)
VALUES ('global', 'Sekolah Anda', true)
ON CONFLICT (config_key) DO NOTHING;

-- Create document_generations table to track generation limits
CREATE TABLE IF NOT EXISTS document_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
  generation_count INTEGER NOT NULL DEFAULT 1,
  last_generated_at TIMESTAMPTZ DEFAULT now(),
  file_url TEXT,
  file_size_bytes INTEGER,
  generation_method TEXT DEFAULT 'self_service' CHECK (generation_method IN ('self_service', 'admin_generated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for document_generations
CREATE INDEX IF NOT EXISTS idx_document_generations_applicant_template
  ON document_generations(applicant_id, template_id);

CREATE INDEX IF NOT EXISTS idx_document_generations_last_generated
  ON document_generations(last_generated_at DESC);

-- Enable RLS on document_generations
ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;

-- Policies for document_generations
CREATE POLICY "Students can read their own generation history"
  ON document_generations FOR SELECT
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert their own generations"
  ON document_generations FOR INSERT
  TO authenticated
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can update their own generations"
  ON document_generations FOR UPDATE
  TO authenticated
  USING (
    applicant_id IN (
      SELECT id FROM applicants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id FROM applicants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all generations"
  ON document_generations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all generations"
  ON document_generations FOR ALL
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

-- Create function to check generation limit
CREATE OR REPLACE FUNCTION check_generation_limit(
  p_applicant_id UUID,
  p_template_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_count INTEGER;
  v_generation_limit INTEGER;
BEGIN
  -- Get the generation limit from template
  SELECT generation_limit INTO v_generation_limit
  FROM letter_templates
  WHERE id = p_template_id;

  -- Get current generation count
  SELECT COALESCE(generation_count, 0) INTO v_current_count
  FROM document_generations
  WHERE applicant_id = p_applicant_id
    AND template_id = p_template_id;

  -- Check if limit exceeded
  RETURN v_current_count < v_generation_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment generation count
CREATE OR REPLACE FUNCTION increment_generation_count(
  p_applicant_id UUID,
  p_template_id UUID,
  p_file_url TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Insert or update generation count
  INSERT INTO document_generations (
    applicant_id,
    template_id,
    generation_count,
    last_generated_at,
    file_url,
    file_size_bytes,
    generation_method
  )
  VALUES (
    p_applicant_id,
    p_template_id,
    1,
    now(),
    p_file_url,
    p_file_size,
    'self_service'
  )
  ON CONFLICT (applicant_id, template_id)
  DO UPDATE SET
    generation_count = document_generations.generation_count + 1,
    last_generated_at = now(),
    file_url = COALESCE(p_file_url, document_generations.file_url),
    file_size_bytes = COALESCE(p_file_size, document_generations.file_size_bytes),
    updated_at = now()
  RETURNING generation_count INTO v_new_count;

  RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add unique constraint for document_generations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_generations_applicant_template_unique'
  ) THEN
    ALTER TABLE document_generations
    ADD CONSTRAINT document_generations_applicant_template_unique
    UNIQUE (applicant_id, template_id);
  END IF;
END $$;

-- Create trigger for document_generations updated_at
DROP TRIGGER IF EXISTS update_document_generations_updated_at ON document_generations;
CREATE TRIGGER update_document_generations_updated_at
  BEFORE UPDATE ON document_generations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for letterhead_config updated_at
DROP TRIGGER IF EXISTS update_letterhead_config_updated_at ON letterhead_config;
CREATE TRIGGER update_letterhead_config_updated_at
  BEFORE UPDATE ON letterhead_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_letter_templates_self_service
  ON letter_templates(is_self_service, is_active) WHERE is_self_service = true;

CREATE INDEX IF NOT EXISTS idx_letter_templates_format
  ON letter_templates(template_format);