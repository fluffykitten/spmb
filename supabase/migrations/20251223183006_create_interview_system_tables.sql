/*
  # Create Interview System Tables

  This migration creates the complete interview scheduling system with support for:
  - Interviewer management
  - Interview session scheduling (online, offline, hybrid)
  - Time slot generation and booking
  - Student booking preferences
  - Interview evaluations and scoring
  - Configurable evaluation criteria

  ## New Tables

  1. **interviewers**
     - Stores interviewer information
     - Links to profiles table via user_id
     - Tracks specialization and active status

  2. **interview_sessions**
     - Defines interview events/sessions
     - Supports online, offline, and hybrid modes
     - Configurable duration and buffer times
     - Status tracking (draft, published, completed, cancelled)

  3. **interview_slots**
     - Auto-generated time slots for each session
     - Tracks availability status

  4. **interview_bookings**
     - Student bookings for interview slots
     - Stores preference for hybrid sessions (online/offline)
     - Status tracking with timestamps
     - Cancellation reason tracking

  5. **interview_evaluations**
     - Post-interview evaluation and scoring
     - JSON-based flexible criteria evaluation
     - Recommendation tracking

  6. **interview_criteria**
     - Configurable evaluation criteria
     - Weighted scoring system
     - Reorderable with order_index

  ## Security

  - RLS enabled on all tables
  - Admin: full access to all tables
  - Student: read published sessions, manage own bookings
  - Interviewer: read assigned sessions, manage evaluations
*/

-- Create interviewers table
CREATE TABLE IF NOT EXISTS interviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  specialization text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create interview_sessions table
CREATE TABLE IF NOT EXISTS interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  interview_type text NOT NULL CHECK (interview_type IN ('online', 'offline', 'hybrid')),
  location text,
  meeting_link text,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  buffer_minutes integer DEFAULT 5,
  max_participants integer DEFAULT 1,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed', 'cancelled')),
  interviewer_id uuid REFERENCES interviewers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create interview_slots table
CREATE TABLE IF NOT EXISTS interview_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create interview_bookings table
CREATE TABLE IF NOT EXISTS interview_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES applicants(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES interview_sessions(id) ON DELETE CASCADE NOT NULL,
  slot_id uuid REFERENCES interview_slots(id) ON DELETE CASCADE NOT NULL,
  preferred_type text CHECK (preferred_type IN ('online', 'offline')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  cancellation_reason text,
  notes text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(applicant_id, session_id)
);

-- Create interview_evaluations table
CREATE TABLE IF NOT EXISTS interview_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES interview_bookings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  interviewer_id uuid REFERENCES interviewers(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  evaluation_data jsonb DEFAULT '{}'::jsonb,
  notes text,
  recommendation text CHECK (recommendation IN ('highly_recommended', 'recommended', 'neutral', 'not_recommended')),
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create interview_criteria table
CREATE TABLE IF NOT EXISTS interview_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  max_score integer NOT NULL DEFAULT 100,
  weight numeric NOT NULL DEFAULT 1.0,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_interviewers_user_id ON interviewers(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_date ON interview_sessions(date);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_interviewer ON interview_sessions(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_interview_slots_session ON interview_slots(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_bookings_applicant ON interview_bookings(applicant_id);
CREATE INDEX IF NOT EXISTS idx_interview_bookings_session ON interview_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_bookings_status ON interview_bookings(status);
CREATE INDEX IF NOT EXISTS idx_interview_evaluations_booking ON interview_evaluations(booking_id);

-- Enable RLS
ALTER TABLE interviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interviewers table
CREATE POLICY "Admin can manage all interviewers"
  ON interviewers FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Interviewers can read their own data"
  ON interviewers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for interview_sessions table
CREATE POLICY "Admin can manage all sessions"
  ON interview_sessions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view published sessions"
  ON interview_sessions FOR SELECT
  TO authenticated
  USING (status = 'published');

CREATE POLICY "Interviewers can view their assigned sessions"
  ON interview_sessions FOR SELECT
  TO authenticated
  USING (interviewer_id IN (
    SELECT id FROM interviewers WHERE user_id = auth.uid()
  ));

-- RLS Policies for interview_slots table
CREATE POLICY "Admin can manage all slots"
  ON interview_slots FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can view slots for published sessions"
  ON interview_slots FOR SELECT
  TO authenticated
  USING (session_id IN (
    SELECT id FROM interview_sessions WHERE status = 'published'
  ));

-- RLS Policies for interview_bookings table
CREATE POLICY "Admin can manage all bookings"
  ON interview_bookings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view their own bookings"
  ON interview_bookings FOR SELECT
  TO authenticated
  USING (applicant_id IN (
    SELECT id FROM applicants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can create their own bookings"
  ON interview_bookings FOR INSERT
  TO authenticated
  WITH CHECK (applicant_id IN (
    SELECT id FROM applicants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can update their own bookings"
  ON interview_bookings FOR UPDATE
  TO authenticated
  USING (applicant_id IN (
    SELECT id FROM applicants WHERE user_id = auth.uid()
  ));

-- RLS Policies for interview_evaluations table
CREATE POLICY "Admin can manage all evaluations"
  ON interview_evaluations FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Interviewers can manage their evaluations"
  ON interview_evaluations FOR ALL
  TO authenticated
  USING (interviewer_id IN (
    SELECT id FROM interviewers WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can view their own evaluations"
  ON interview_evaluations FOR SELECT
  TO authenticated
  USING (booking_id IN (
    SELECT id FROM interview_bookings 
    WHERE applicant_id IN (
      SELECT id FROM applicants WHERE user_id = auth.uid()
    )
  ));

-- RLS Policies for interview_criteria table
CREATE POLICY "Admin can manage all criteria"
  ON interview_criteria FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Everyone can view active criteria"
  ON interview_criteria FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_interviewers_updated_at BEFORE UPDATE ON interviewers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_sessions_updated_at BEFORE UPDATE ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_bookings_updated_at BEFORE UPDATE ON interview_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_evaluations_updated_at BEFORE UPDATE ON interview_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interview_criteria_updated_at BEFORE UPDATE ON interview_criteria
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default interview criteria
INSERT INTO interview_criteria (name, description, max_score, weight, order_index) VALUES
  ('Komunikasi', 'Kemampuan berkomunikasi dan mengekspresikan ide', 100, 0.25, 1),
  ('Motivasi', 'Motivasi dan antusiasme untuk belajar', 100, 0.20, 2),
  ('Pengetahuan Umum', 'Wawasan dan pengetahuan umum', 100, 0.20, 3),
  ('Kepribadian', 'Karakter dan kepribadian', 100, 0.20, 4),
  ('Potensi Akademik', 'Potensi untuk berkembang secara akademik', 100, 0.15, 5)
ON CONFLICT DO NOTHING;