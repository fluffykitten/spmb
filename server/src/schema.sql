-- SPMB Database Schema (migrated from Supabase)
-- This replaces Supabase auth.users with a local users table

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

------------------------------------------------------------
-- USERS (replaces Supabase auth.users)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- PROFILES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

------------------------------------------------------------
-- REGISTRATION BATCHES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  entrance_fee_amount NUMERIC DEFAULT 0,
  administration_fee_amount NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- APPLICANTS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applicants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft',
  dynamic_data JSONB DEFAULT '{}',
  registration_number TEXT,
  admin_comments TEXT,
  commented_by UUID,
  commented_at TIMESTAMPTZ,
  interview_status TEXT DEFAULT 'not_scheduled',
  interview_score NUMERIC,
  exam_status TEXT DEFAULT 'not_assigned',
  exam_score NUMERIC,
  final_score NUMERIC,
  registration_batch_id UUID REFERENCES registration_batches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- PAYMENT RECORDS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('entrance_fee', 'administration_fee')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'waived')),
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'other')),
  payment_notes TEXT,
  payment_date TIMESTAMPTZ,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- PAYMENT HISTORY
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_record_id UUID NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- LETTER TEMPLATES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS letter_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  html_content TEXT DEFAULT '',
  description TEXT,
  variables JSONB,
  template_type TEXT,
  letterhead_config JSONB,
  typography_config JSONB,
  letter_number_config JSONB,
  signature_config JSONB,
  layout_config JSONB,
  pdf_source_url TEXT,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  access_rule TEXT,
  is_available_for_students BOOLEAN DEFAULT FALSE,
  template_format TEXT,
  docx_template_url TEXT,
  docx_variables TEXT[],
  docx_layout_config JSONB,
  required_status TEXT[],
  is_self_service BOOLEAN DEFAULT FALSE,
  generation_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- APP CONFIG
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEWERS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interviewers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEW SESSIONS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  interview_type TEXT NOT NULL CHECK (interview_type IN ('online', 'offline', 'hybrid')),
  location TEXT,
  meeting_link TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  buffer_minutes INTEGER DEFAULT 5,
  max_participants INTEGER DEFAULT 1,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed', 'cancelled')),
  interviewer_id UUID REFERENCES interviewers(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEW SLOTS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEW BOOKINGS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES interview_slots(id) ON DELETE CASCADE,
  preferred_type TEXT CHECK (preferred_type IN ('online', 'offline')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancellation_reason TEXT,
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEW EVALUATIONS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES interview_bookings(id) ON DELETE CASCADE,
  interviewer_id UUID,
  score NUMERIC DEFAULT 0,
  evaluation_data JSONB DEFAULT '{}',
  notes TEXT,
  recommendation TEXT CHECK (recommendation IN ('highly_recommended', 'recommended', 'neutral', 'not_recommended')),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEW CRITERIA
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  max_score NUMERIC DEFAULT 100,
  weight NUMERIC DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAMS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER DEFAULT 60,
  passing_score NUMERIC DEFAULT 70,
  max_attempts INTEGER DEFAULT 1,
  randomize_questions BOOLEAN DEFAULT FALSE,
  randomize_options BOOLEAN DEFAULT FALSE,
  show_results_immediately BOOLEAN DEFAULT TRUE,
  show_correct_answers BOOLEAN DEFAULT FALSE,
  enable_proctoring BOOLEAN DEFAULT FALSE,
  require_fullscreen BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'specific', 'by_status')),
  target_status TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM QUESTIONS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'essay')),
  question_text TEXT NOT NULL,
  question_image TEXT,
  points NUMERIC DEFAULT 1,
  order_index INTEGER DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM QUESTION OPTIONS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_question_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_image TEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM ATTEMPTS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  attempt_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  time_remaining_seconds INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM ANSWERS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_option_id UUID,
  essay_answer TEXT,
  is_correct BOOLEAN,
  points_earned NUMERIC,
  is_flagged BOOLEAN DEFAULT FALSE,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM RESULTS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  total_points NUMERIC DEFAULT 0,
  max_points NUMERIC DEFAULT 0,
  percentage NUMERIC DEFAULT 0,
  passed BOOLEAN DEFAULT FALSE,
  auto_graded_points NUMERIC DEFAULT 0,
  manual_graded_points NUMERIC DEFAULT 0,
  grading_status TEXT DEFAULT 'pending' CHECK (grading_status IN ('pending', 'partial', 'completed')),
  graded_by UUID,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM PROCTORING LOGS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_proctoring_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM TOKENS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  token_code TEXT NOT NULL UNIQUE,
  token_type TEXT DEFAULT 'single_use' CHECK (token_type IN ('single_use', 'multi_use', 'time_limited')),
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- EXAM TOKEN REDEMPTIONS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_token_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID NOT NULL REFERENCES exam_tokens(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- AUDIT LOGS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT NOT NULL,
  target_user_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- WHATSAPP NOTIFICATION LOGS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID REFERENCES applicants(id),
  recipient_number TEXT,
  message_content TEXT,
  template_name TEXT,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- DOCUMENT GENERATIONS (track letter/doc downloads)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES letter_templates(id),
  applicant_id UUID REFERENCES applicants(id),
  generated_by UUID,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- FORM SCHEMA (dynamic form builder)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'default',
  schema JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INDEXES
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_applicants_user_id ON applicants(user_id);
CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_batch ON applicants(registration_batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_applicant ON payment_records(applicant_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_applicant ON exam_attempts(applicant_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_tokens_code ON exam_tokens(token_code);
CREATE INDEX IF NOT EXISTS idx_interview_bookings_applicant ON interview_bookings(applicant_id);

------------------------------------------------------------
-- LETTERHEAD CONFIG
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS letterhead_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL DEFAULT 'global',
  letterhead_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

------------------------------------------------------------
-- INTERVIEW REQUESTS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interview_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
