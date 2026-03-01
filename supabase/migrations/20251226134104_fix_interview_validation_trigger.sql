/*
  # Fix Interview Date Validation Trigger

  ## Problem
  The validation trigger was running on ALL updates to interview_requests,
  including when admin changes status or adds notes. This caused errors when:
  - A student creates a request 3 days in advance (valid)
  - Time passes, now it's only 1 day away
  - Admin tries to request revision (only changing status/notes)
  - Trigger fails because date is now < 2 days away

  ## Solution
  Update the validation function to only check minimum days notice when:
  1. It's a new INSERT (new request), OR
  2. It's an UPDATE where date/time fields actually changed

  ## Changes
  1. Modified `validate_interview_date()` function
     - Check TG_OP to detect INSERT vs UPDATE
     - For UPDATE: compare OLD vs NEW date/time values
     - Skip date validation if only status/notes changed

  2. Retained validations that always run:
     - No Sunday interviews
     - End time must be after start time

  ## Security
  - No RLS changes
  - Maintains all existing security policies
*/

-- Drop and recreate the validation function with conditional logic
CREATE OR REPLACE FUNCTION validate_interview_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Always check: No Sunday interviews (0 = Sunday)
  IF EXTRACT(DOW FROM NEW.proposed_date) = 0 THEN
    RAISE EXCEPTION 'Interview tidak dapat dijadwalkan pada hari Minggu';
  END IF;

  -- Always check: End time must be after start time
  IF NEW.proposed_time_end <= NEW.proposed_time_start THEN
    RAISE EXCEPTION 'Waktu selesai harus lebih besar dari waktu mulai';
  END IF;

  -- Only check minimum days notice if:
  -- 1. This is a new INSERT, OR
  -- 2. This is an UPDATE where date or time fields changed
  IF TG_OP = 'INSERT' OR
     (TG_OP = 'UPDATE' AND (
       OLD.proposed_date != NEW.proposed_date OR
       OLD.proposed_time_start != NEW.proposed_time_start OR
       OLD.proposed_time_end != NEW.proposed_time_end
     )) THEN

    -- Check minimum days notice (2 days)
    IF NEW.proposed_date < CURRENT_DATE + INTERVAL '2 days' THEN
      RAISE EXCEPTION 'Interview harus dijadwalkan minimal 2 hari ke depan';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
