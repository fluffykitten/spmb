/*
  # Create Online Exam System Tables

  This migration creates the complete online examination system with:
  - Configurable exam settings (duration, randomization, proctoring)
  - Multiple question types (multiple choice, true/false, essay)
  - Auto-grading for objective questions
  - Manual grading for essay questions
  - Attempt tracking with time limits
  - Basic proctoring logs
  - Comprehensive result tracking

  ## New Tables

  1. **exams**
     - Exam configuration and settings
     - Duration, passing score, attempt limits
     - Randomization options
     - Proctoring settings
     - Target audience configuration

  2. **exam_questions**
     - Questions for each exam
     - Multiple types: multiple_choice, true_false, essay
     - Image support for questions
     - Points and ordering

  3. **exam_question_options**
     - Answer options for multiple choice and true/false
     - Correct answer marking
     - Image support for options

  4. **exam_attempts**
     - Student attempt tracking
     - Status and timing information
     - IP and user agent logging

  5. **exam_answers**
     - Student answers for each question
     - Auto-grading for objective questions
     - Flag for review feature

  6. **exam_results**
     - Comprehensive results per attempt
     - Separate auto and manual graded points
     - Grading status tracking

  7. **exam_proctoring_logs**
     - Activity monitoring logs
     - Tab switches, fullscreen exits, etc.

  ## Security

  - RLS enabled on all tables
  - Admin: full access
  - Student: read published exams, manage own attempts
  - Auto-grading via database functions
*/

-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructions text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  passing_score numeric NOT NULL DEFAULT 60,
  max_attempts integer DEFAULT 1,
  randomize_questions boolean DEFAULT false,
  randomize_options boolean DEFAULT false,
  show_results_immediately boolean DEFAULT false,
  show_correct_answers boolean DEFAULT false,
  enable_proctoring boolean DEFAULT false,
  require_fullscreen boolean DEFAULT true,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  start_date timestamptz,
  end_date timestamptz,
  target_audience text DEFAULT 'all' CHECK (target_audience IN ('all', 'specific', 'by_status')),
  target_status text[],
  created_by uuid REFERENCES profiles(user_id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exam_questions table
CREATE TABLE IF NOT EXISTS exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'essay')),
  question_text text NOT NULL,
  question_image text,
  points numeric NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0,
  explanation text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exam_question_options table
CREATE TABLE IF NOT EXISTS exam_question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES exam_questions(id) ON DELETE CASCADE NOT NULL,
  option_text text NOT NULL,
  option_image text,
  is_correct boolean DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create exam_attempts table
CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  applicant_id uuid REFERENCES applicants(id) ON DELETE CASCADE NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned', 'expired')),
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  time_remaining_seconds integer,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exam_answers table
CREATE TABLE IF NOT EXISTS exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES exam_attempts(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES exam_questions(id) ON DELETE CASCADE NOT NULL,
  selected_option_id uuid REFERENCES exam_question_options(id) ON DELETE SET NULL,
  essay_answer text,
  is_correct boolean,
  points_earned numeric,
  is_flagged boolean DEFAULT false,
  answered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Create exam_results table
CREATE TABLE IF NOT EXISTS exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES exam_attempts(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_points numeric NOT NULL DEFAULT 0,
  max_points numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  passed boolean DEFAULT false,
  auto_graded_points numeric DEFAULT 0,
  manual_graded_points numeric DEFAULT 0,
  grading_status text DEFAULT 'pending' CHECK (grading_status IN ('pending', 'partial', 'completed')),
  graded_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  graded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exam_proctoring_logs table
CREATE TABLE IF NOT EXISTS exam_proctoring_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES exam_attempts(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('tab_switch', 'fullscreen_exit', 'copy_attempt', 'paste_attempt', 'right_click', 'suspicious_activity')),
  event_data jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_dates ON exams(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_question_options_question ON exam_question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_applicant ON exam_attempts(applicant_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_answers_question ON exam_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_attempt ON exam_results(attempt_id);
CREATE INDEX IF NOT EXISTS idx_exam_proctoring_logs_attempt ON exam_proctoring_logs(attempt_id);

-- Enable RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_proctoring_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exams table
CREATE POLICY "Admin can manage all exams"
  ON exams FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view published exams"
  ON exams FOR SELECT
  TO authenticated
  USING (status = 'published' AND 
    (start_date IS NULL OR start_date <= now()) AND
    (end_date IS NULL OR end_date >= now())
  );

-- RLS Policies for exam_questions table
CREATE POLICY "Admin can manage all questions"
  ON exam_questions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view questions for published exams"
  ON exam_questions FOR SELECT
  TO authenticated
  USING (exam_id IN (
    SELECT id FROM exams WHERE status = 'published'
  ));

-- RLS Policies for exam_question_options table
CREATE POLICY "Admin can manage all options"
  ON exam_question_options FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view options for published exams"
  ON exam_question_options FOR SELECT
  TO authenticated
  USING (question_id IN (
    SELECT eq.id FROM exam_questions eq
    JOIN exams e ON e.id = eq.exam_id
    WHERE e.status = 'published'
  ));

-- RLS Policies for exam_attempts table
CREATE POLICY "Admin can manage all attempts"
  ON exam_attempts FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view their own attempts"
  ON exam_attempts FOR SELECT
  TO authenticated
  USING (applicant_id IN (
    SELECT id FROM applicants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can create their own attempts"
  ON exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (applicant_id IN (
    SELECT id FROM applicants WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can update their own attempts"
  ON exam_attempts FOR UPDATE
  TO authenticated
  USING (applicant_id IN (
    SELECT id FROM applicants WHERE user_id = auth.uid()
  ));

-- RLS Policies for exam_answers table
CREATE POLICY "Admin can manage all answers"
  ON exam_answers FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can manage their own answers"
  ON exam_answers FOR ALL
  TO authenticated
  USING (attempt_id IN (
    SELECT ea.id FROM exam_attempts ea
    JOIN applicants a ON a.id = ea.applicant_id
    WHERE a.user_id = auth.uid()
  ));

-- RLS Policies for exam_results table
CREATE POLICY "Admin can manage all results"
  ON exam_results FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can view their own results"
  ON exam_results FOR SELECT
  TO authenticated
  USING (attempt_id IN (
    SELECT ea.id FROM exam_attempts ea
    JOIN applicants a ON a.id = ea.applicant_id
    WHERE a.user_id = auth.uid()
  ));

-- RLS Policies for exam_proctoring_logs table
CREATE POLICY "Admin can manage all proctoring logs"
  ON exam_proctoring_logs FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Students can insert their own proctoring logs"
  ON exam_proctoring_logs FOR INSERT
  TO authenticated
  WITH CHECK (attempt_id IN (
    SELECT ea.id FROM exam_attempts ea
    JOIN applicants a ON a.id = ea.applicant_id
    WHERE a.user_id = auth.uid()
  ));

-- Create triggers for updated_at
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_questions_updated_at BEFORE UPDATE ON exam_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_attempts_updated_at BEFORE UPDATE ON exam_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_answers_updated_at BEFORE UPDATE ON exam_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_results_updated_at BEFORE UPDATE ON exam_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-grade objective questions
CREATE OR REPLACE FUNCTION auto_grade_answer()
RETURNS TRIGGER AS $$
DECLARE
  v_question_type text;
  v_points numeric;
  v_is_correct boolean;
BEGIN
  -- Get question type and points
  SELECT eq.question_type, eq.points INTO v_question_type, v_points
  FROM exam_questions eq
  WHERE eq.id = NEW.question_id;

  -- Only auto-grade multiple_choice and true_false
  IF v_question_type IN ('multiple_choice', 'true_false') AND NEW.selected_option_id IS NOT NULL THEN
    -- Check if selected option is correct
    SELECT is_correct INTO v_is_correct
    FROM exam_question_options
    WHERE id = NEW.selected_option_id;

    -- Update answer with grading
    NEW.is_correct := v_is_correct;
    NEW.points_earned := CASE WHEN v_is_correct THEN v_points ELSE 0 END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-grading
CREATE TRIGGER auto_grade_answer_trigger
  BEFORE INSERT OR UPDATE ON exam_answers
  FOR EACH ROW
  EXECUTE FUNCTION auto_grade_answer();

-- Create function to calculate exam results
CREATE OR REPLACE FUNCTION calculate_exam_result(p_attempt_id uuid)
RETURNS void AS $$
DECLARE
  v_total_points numeric := 0;
  v_max_points numeric := 0;
  v_auto_graded_points numeric := 0;
  v_manual_graded_points numeric := 0;
  v_percentage numeric;
  v_passing_score numeric;
  v_passed boolean;
  v_grading_status text;
  v_has_essay boolean;
  v_essay_graded_count integer;
  v_essay_total_count integer;
BEGIN
  -- Calculate max points
  SELECT COALESCE(SUM(eq.points), 0) INTO v_max_points
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id;

  -- Calculate auto-graded points (multiple choice, true/false)
  SELECT COALESCE(SUM(ea.points_earned), 0) INTO v_auto_graded_points
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id
    AND eq.question_type IN ('multiple_choice', 'true_false')
    AND ea.points_earned IS NOT NULL;

  -- Calculate manual-graded points (essay)
  SELECT COALESCE(SUM(ea.points_earned), 0) INTO v_manual_graded_points
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id
    AND eq.question_type = 'essay'
    AND ea.points_earned IS NOT NULL;

  -- Check essay grading status
  SELECT 
    COUNT(*) FILTER (WHERE eq.question_type = 'essay') > 0,
    COUNT(*) FILTER (WHERE eq.question_type = 'essay' AND ea.points_earned IS NOT NULL),
    COUNT(*) FILTER (WHERE eq.question_type = 'essay')
  INTO v_has_essay, v_essay_graded_count, v_essay_total_count
  FROM exam_answers ea
  JOIN exam_questions eq ON eq.id = ea.question_id
  WHERE ea.attempt_id = p_attempt_id;

  -- Determine grading status
  IF NOT v_has_essay THEN
    v_grading_status := 'completed';
  ELSIF v_essay_graded_count = 0 THEN
    v_grading_status := 'pending';
  ELSIF v_essay_graded_count < v_essay_total_count THEN
    v_grading_status := 'partial';
  ELSE
    v_grading_status := 'completed';
  END IF;

  -- Calculate total points
  v_total_points := v_auto_graded_points + v_manual_graded_points;

  -- Calculate percentage
  IF v_max_points > 0 THEN
    v_percentage := (v_total_points / v_max_points) * 100;
  ELSE
    v_percentage := 0;
  END IF;

  -- Get passing score
  SELECT e.passing_score INTO v_passing_score
  FROM exam_attempts ea
  JOIN exams e ON e.id = ea.exam_id
  WHERE ea.id = p_attempt_id;

  -- Determine if passed (only if fully graded)
  v_passed := v_grading_status = 'completed' AND v_percentage >= v_passing_score;

  -- Insert or update result
  INSERT INTO exam_results (
    attempt_id,
    total_points,
    max_points,
    percentage,
    passed,
    auto_graded_points,
    manual_graded_points,
    grading_status
  ) VALUES (
    p_attempt_id,
    v_total_points,
    v_max_points,
    v_percentage,
    v_passed,
    v_auto_graded_points,
    v_manual_graded_points,
    v_grading_status
  )
  ON CONFLICT (attempt_id) DO UPDATE SET
    total_points = EXCLUDED.total_points,
    max_points = EXCLUDED.max_points,
    percentage = EXCLUDED.percentage,
    passed = EXCLUDED.passed,
    auto_graded_points = EXCLUDED.auto_graded_points,
    manual_graded_points = EXCLUDED.manual_graded_points,
    grading_status = EXCLUDED.grading_status,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to recalculate results when answers change
CREATE OR REPLACE FUNCTION trigger_recalculate_result()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calculate_exam_result(NEW.attempt_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalculate_result_on_answer_change
  AFTER INSERT OR UPDATE ON exam_answers
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_result();