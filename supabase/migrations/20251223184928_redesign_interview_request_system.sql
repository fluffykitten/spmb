/*
  # Redesign Interview System - Student-Initiated Requests
  
  Complete redesign of interview system where students propose schedules and admin reviews.
  
  ## Key Features
  
  1. **Student Proposes**
     - Date (Monday-Saturday, Sunday NOT allowed)
     - Time range
     - Format (online/offline)
     - Optional notes
  
  2. **Admin Reviews**
     - Approve (+ assign interviewer + meeting link if online)
     - Request revision (+ notes)
     - Reject (+ reason)
  
  3. **Automatic**
     - Location always at school (from config)
     - Conflict detection
     - Validation (no Sunday, min days notice, working hours)
  
  ## Changes
  
  1. Drop old tables
     - interview_slots (no longer needed)
     
  2. Redesign interview_requests
     - proposed_date, proposed_time_start, proposed_time_end
     - proposed_type (online/offline)
     - meeting_link (admin fills for online)
     - approval/rejection workflow fields
     
  3. Add school configuration
     - school_name, school_address, interview_location
     - interview hours, minimum notice days
  
  ## Security
  
  - Students: create, read own, update when revision_requested
  - Admin: full access
  - All operations logged
*/

-- Step 1: Drop old structure
DROP TABLE IF EXISTS interview_slots CASCADE;

-- Step 2: Drop and recreate interview_requests with new structure
DROP TABLE IF EXISTS interview_requests CASCADE;

CREATE TABLE interview_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  
  -- Proposed schedule by student
  proposed_date date NOT NULL,
  proposed_time_start time NOT NULL,
  proposed_time_end time NOT NULL,
  proposed_type text NOT NULL CHECK (proposed_type IN ('online', 'offline')),
  student_notes text,
  
  -- Admin fills these
  meeting_link text,
  admin_notes text,
  interviewer_id uuid REFERENCES interviewers(id),
  
  -- Approval workflow
  status text NOT NULL DEFAULT 'pending_review' 
    CHECK (status IN ('pending_review', 'revision_requested', 'approved', 'rejected', 'completed', 'cancelled')),
  
  -- Revision workflow
  revision_requested_notes text,
  
  -- Rejection workflow
  rejection_reason text,
  
  -- Tracking
  approved_by uuid REFERENCES profiles(user_id),
  approved_at timestamptz,
  rejected_by uuid REFERENCES profiles(user_id),
  rejected_at timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Create indexes
CREATE INDEX idx_interview_requests_applicant ON interview_requests(applicant_id);
CREATE INDEX idx_interview_requests_status ON interview_requests(status);
CREATE INDEX idx_interview_requests_date ON interview_requests(proposed_date);
CREATE INDEX idx_interview_requests_interviewer ON interview_requests(interviewer_id);

-- Step 4: Validation function - Check Sunday (day 0)
CREATE OR REPLACE FUNCTION validate_interview_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if Sunday (0 = Sunday)
  IF EXTRACT(DOW FROM NEW.proposed_date) = 0 THEN
    RAISE EXCEPTION 'Interview tidak dapat dijadwalkan pada hari Minggu';
  END IF;
  
  -- Check minimum days notice (from config)
  IF NEW.proposed_date < CURRENT_DATE + INTERVAL '2 days' THEN
    RAISE EXCEPTION 'Interview harus dijadwalkan minimal 2 hari ke depan';
  END IF;
  
  -- Check time range validity
  IF NEW.proposed_time_end <= NEW.proposed_time_start THEN
    RAISE EXCEPTION 'Waktu selesai harus lebih besar dari waktu mulai';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_interview_date_trigger
  BEFORE INSERT OR UPDATE ON interview_requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_interview_date();

-- Step 5: Conflict detection function
CREATE OR REPLACE FUNCTION check_interview_time_conflict(
  p_interviewer_id uuid,
  p_proposed_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  has_conflict boolean,
  conflict_details text,
  conflicting_times text[]
) AS $$
DECLARE
  v_conflicts text[];
BEGIN
  -- Get all conflicting time slots
  SELECT array_agg(
    proposed_time_start::text || ' - ' || proposed_time_end::text
  ) INTO v_conflicts
  FROM interview_requests
  WHERE interviewer_id = p_interviewer_id
    AND proposed_date = p_proposed_date
    AND status IN ('approved', 'pending_review')
    AND (id != p_exclude_request_id OR p_exclude_request_id IS NULL)
    AND (
      (proposed_time_start, proposed_time_end) OVERLAPS (p_start_time, p_end_time)
    );
  
  RETURN QUERY
  SELECT 
    COALESCE(array_length(v_conflicts, 1), 0) > 0 as has_conflict,
    CASE 
      WHEN COALESCE(array_length(v_conflicts, 1), 0) > 0
      THEN 'Waktu bentrok dengan interview lain pada: ' || array_to_string(v_conflicts, ', ')
      ELSE 'Tidak ada konflik jadwal'
    END as conflict_details,
    COALESCE(v_conflicts, ARRAY[]::text[]) as conflicting_times;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: RLS Policies
ALTER TABLE interview_requests ENABLE ROW LEVEL SECURITY;

-- Students can create interview requests
CREATE POLICY "Students can create interview requests"
  ON interview_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = interview_requests.applicant_id
        AND applicants.user_id = auth.uid()
    )
  );

-- Students can read their own requests
CREATE POLICY "Students can read own interview requests"
  ON interview_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = interview_requests.applicant_id
        AND applicants.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Students can update only when revision requested
CREATE POLICY "Students can update requests when revision requested"
  ON interview_requests FOR UPDATE
  TO authenticated
  USING (
    status = 'revision_requested'
    AND EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = interview_requests.applicant_id
        AND applicants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'pending_review'
    AND EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = interview_requests.applicant_id
        AND applicants.user_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY "Admin can manage all interview requests"
  ON interview_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Step 7: Add school configuration
INSERT INTO app_config (key, value)
VALUES
  ('school_name', '"SMA Negeri 1"'),
  ('school_address', '"Jl. Pendidikan No. 123, Jakarta Pusat"'),
  ('interview_location', '"Ruang Bimbingan Konseling (BK) Lantai 2"'),
  ('interview_start_hour', '"08:00"'),
  ('interview_end_hour', '"16:00"'),
  ('interview_min_days_notice', '2'),
  ('interview_duration_options', '[30, 45, 60]'),
  ('interview_allowed_days', '[1, 2, 3, 4, 5, 6]')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value;

-- Step 8: Update timestamp trigger
CREATE OR REPLACE FUNCTION update_interview_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_interview_requests_timestamp_trigger
  BEFORE UPDATE ON interview_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_interview_requests_timestamp();

-- Step 9: Helper function to get available interviewers
CREATE OR REPLACE FUNCTION get_available_interviewers(
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  specialization text,
  is_available boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.name,
    i.email,
    i.specialization,
    NOT EXISTS (
      SELECT 1 FROM interview_requests ir
      WHERE ir.interviewer_id = i.id
        AND ir.proposed_date = p_date
        AND ir.status IN ('approved', 'pending_review')
        AND (ir.proposed_time_start, ir.proposed_time_end) OVERLAPS (p_start_time, p_end_time)
    ) as is_available
  FROM interviewers i
  WHERE i.is_active = true
  ORDER BY is_available DESC, i.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Enable realtime for interview_requests
ALTER PUBLICATION supabase_realtime ADD TABLE interview_requests;