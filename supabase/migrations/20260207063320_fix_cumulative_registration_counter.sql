/*
  # Fix Cumulative Registration Counter

  ## Overview
  Fixes the registration number counter to be cumulative across the entire
  academic year instead of resetting to 001 every new date.

  ## Problem
  - Counter was per-date, resetting to 001 each new day
  - Example: Jan 15 = 001, Jan 21 = 001 (wrong, should be 002)

  ## Solution
  - Counter now queries ALL registration numbers within the academic year
  - Finds the global MAX counter and increments from there
  - Existing registration numbers are updated to use cumulative counters

  ## Changes

  1. **Updated `get_next_registration_counter`**
     - Now searches across all dates within the academic year
     - Returns the next cumulative counter, not per-date

  2. **Updated existing registration numbers**
     - Re-numbered to be sequential across the academic year
     - Ordered by original creation date

  3. **Updated counter table**
     - Counter now reflects cumulative total for academic year

  ## Security
  - No changes to RLS policies
  - Functions remain SECURITY DEFINER
*/

-- Step 1: Fix the counter function to be cumulative across academic year
CREATE OR REPLACE FUNCTION get_next_registration_counter(reg_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_counter integer;
  academic_year_prefix text;
BEGIN
  -- Calculate academic year prefix (first 4 chars of registration number)
  IF EXTRACT(MONTH FROM reg_date) >= 7 THEN
    academic_year_prefix := SUBSTRING(EXTRACT(YEAR FROM reg_date)::text, 3, 2) ||
                            SUBSTRING((EXTRACT(YEAR FROM reg_date) + 1)::text, 3, 2);
  ELSE
    academic_year_prefix := SUBSTRING((EXTRACT(YEAR FROM reg_date) - 1)::text, 3, 2) ||
                            SUBSTRING(EXTRACT(YEAR FROM reg_date)::text, 3, 2);
  END IF;

  -- Get the maximum counter across ALL dates in this academic year
  -- Registration format: AcademicYear(4) + Date(6) + Counter(3) = 13 characters
  SELECT COALESCE(MAX(
    CASE
      WHEN LENGTH(registration_number) >= 13
      THEN SUBSTRING(registration_number FROM 11 FOR 3)::integer
      ELSE 0
    END
  ), 0) INTO next_counter
  FROM applicants
  WHERE registration_number LIKE academic_year_prefix || '%'
    AND registration_number IS NOT NULL;

  RAISE NOTICE 'get_next_registration_counter: academic_year=%, max_counter=%, next=%',
    academic_year_prefix, next_counter, next_counter + 1;

  -- Return the next counter (increment by 1)
  RETURN next_counter + 1;
END;
$$;

-- Step 2: Update generate_registration_number to use cumulative counter
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reg_date date;
  academic_year text;
  date_part text;
  counter_val integer;
  new_reg_number text;
  start_year text;
  end_year text;
  current_month integer;
  max_attempts integer := 10;
  attempt integer := 0;
BEGIN
  reg_date := CURRENT_DATE;
  current_month := EXTRACT(MONTH FROM reg_date);

  IF current_month >= 7 THEN
    start_year := SUBSTRING(EXTRACT(YEAR FROM reg_date)::text, 3, 2);
    end_year := SUBSTRING((EXTRACT(YEAR FROM reg_date) + 1)::text, 3, 2);
  ELSE
    start_year := SUBSTRING((EXTRACT(YEAR FROM reg_date) - 1)::text, 3, 2);
    end_year := SUBSTRING(EXTRACT(YEAR FROM reg_date)::text, 3, 2);
  END IF;

  academic_year := start_year || end_year;
  date_part := TO_CHAR(reg_date, 'YYMMDD');

  RAISE NOTICE 'generate_registration_number: date=%, academic_year=%, date_part=%',
    reg_date, academic_year, date_part;

  LOOP
    attempt := attempt + 1;

    -- Get next cumulative counter across the entire academic year
    counter_val := get_next_registration_counter(reg_date);

    new_reg_number := academic_year || date_part || LPAD(counter_val::text, 3, '0');

    RAISE NOTICE 'generate_registration_number: attempt=%, counter=%, reg_number=%',
      attempt, counter_val, new_reg_number;

    IF NOT EXISTS (SELECT 1 FROM applicants WHERE registration_number = new_reg_number) THEN
      -- Update counter table for monitoring
      INSERT INTO registration_counters (date, counter)
      VALUES (reg_date, counter_val)
      ON CONFLICT (date)
      DO UPDATE SET
        counter = GREATEST(registration_counters.counter, counter_val),
        updated_at = now();

      RETURN new_reg_number;
    END IF;

    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique registration number after % attempts', max_attempts;
    END IF;

    PERFORM pg_sleep(0.001);
  END LOOP;
END;
$$;

-- Step 3: Fix existing registration numbers to use cumulative counters
-- We need to re-number them in order of creation
DO $$
DECLARE
  rec record;
  new_counter integer := 0;
  academic_year text;
  date_part text;
  new_reg_number text;
BEGIN
  RAISE NOTICE 'Starting re-numbering of existing registration numbers...';

  -- Temporarily disable the trigger to avoid re-generation
  ALTER TABLE applicants DISABLE TRIGGER trigger_auto_generate_registration_number;

  -- Process all applicants with registration numbers, ordered by creation date
  FOR rec IN
    SELECT id, registration_number, created_at
    FROM applicants
    WHERE registration_number IS NOT NULL
    ORDER BY created_at ASC
  LOOP
    new_counter := new_counter + 1;

    -- Extract academic year and date from existing registration number
    academic_year := SUBSTRING(rec.registration_number FROM 1 FOR 4);
    date_part := SUBSTRING(rec.registration_number FROM 5 FOR 6);

    new_reg_number := academic_year || date_part || LPAD(new_counter::text, 3, '0');

    RAISE NOTICE 'Re-numbering: % -> % (applicant %)',
      rec.registration_number, new_reg_number, rec.id;

    UPDATE applicants
    SET registration_number = new_reg_number
    WHERE id = rec.id;
  END LOOP;

  -- Re-enable the trigger
  ALTER TABLE applicants ENABLE TRIGGER trigger_auto_generate_registration_number;

  RAISE NOTICE 'Re-numbering complete. % registration numbers updated.', new_counter;
END $$;

-- Step 4: Update counter table to reflect cumulative totals
DO $$
DECLARE
  academic_year_prefix text;
  max_counter integer;
BEGIN
  -- Calculate current academic year prefix
  IF EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN
    academic_year_prefix := SUBSTRING(EXTRACT(YEAR FROM CURRENT_DATE)::text, 3, 2) ||
                            SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text, 3, 2);
  ELSE
    academic_year_prefix := SUBSTRING((EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text, 3, 2) ||
                            SUBSTRING(EXTRACT(YEAR FROM CURRENT_DATE)::text, 3, 2);
  END IF;

  -- Find current max counter
  SELECT COALESCE(MAX(
    CASE
      WHEN LENGTH(registration_number) >= 13
      THEN SUBSTRING(registration_number FROM 11 FOR 3)::integer
      ELSE 0
    END
  ), 0) INTO max_counter
  FROM applicants
  WHERE registration_number LIKE academic_year_prefix || '%'
    AND registration_number IS NOT NULL;

  -- Update the latest counter entry
  UPDATE registration_counters
  SET counter = max_counter, updated_at = now()
  WHERE date = (SELECT MAX(date) FROM registration_counters);

  RAISE NOTICE 'Counter table updated. Current max counter: %', max_counter;
END $$;

-- Step 5: Update sync function for cumulative counters
CREATE OR REPLACE FUNCTION sync_registration_counters()
RETURNS TABLE(sync_date date, old_counter integer, new_counter integer, synced boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  counter_record record;
  actual_max integer;
  old_val integer;
BEGIN
  actual_max := get_next_registration_counter(CURRENT_DATE) - 1;

  FOR counter_record IN
    SELECT rc.date, rc.counter
    FROM registration_counters rc
    ORDER BY rc.date DESC
    LIMIT 1
  LOOP
    old_val := counter_record.counter;

    IF actual_max != old_val THEN
      UPDATE registration_counters
      SET counter = actual_max, updated_at = now()
      WHERE date = counter_record.date;

      sync_date := counter_record.date;
      old_counter := old_val;
      new_counter := actual_max;
      synced := true;
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- Step 6: Update health check for cumulative counter
CREATE OR REPLACE FUNCTION check_counter_health()
RETURNS TABLE(
  check_date date,
  counter_value integer,
  actual_count integer,
  is_synced boolean,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actual_max integer;
BEGIN
  actual_max := get_next_registration_counter(CURRENT_DATE) - 1;

  RETURN QUERY
  SELECT
    rc.date as check_date,
    rc.counter as counter_value,
    actual_max as actual_count,
    (rc.counter = actual_max) as is_synced,
    CASE
      WHEN rc.counter = actual_max THEN 'OK'
      WHEN rc.counter > actual_max THEN 'Counter ahead of actual'
      ELSE 'Counter behind actual'
    END as status
  FROM registration_counters rc
  ORDER BY rc.date DESC
  LIMIT 1;
END;
$$;

-- Step 7: Update delete sync trigger for cumulative logic
CREATE OR REPLACE FUNCTION sync_counter_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  actual_max integer;
BEGIN
  IF OLD.registration_number IS NOT NULL AND LENGTH(OLD.registration_number) >= 13 THEN
    -- Recalculate cumulative counter after deletion
    actual_max := get_next_registration_counter(CURRENT_DATE) - 1;

    RAISE NOTICE 'sync_counter_on_delete: deleted reg_number=%, new max counter=%',
      OLD.registration_number, actual_max;

    -- Update the latest counter entry
    UPDATE registration_counters
    SET counter = actual_max, updated_at = now()
    WHERE date = (SELECT MAX(date) FROM registration_counters);
  END IF;

  RETURN OLD;
END;
$$;

-- Add comments
COMMENT ON FUNCTION get_next_registration_counter(date) IS
'Calculates the next cumulative registration counter for the academic year. Counter does NOT reset daily - it increments across all dates within the same academic year.';

COMMENT ON FUNCTION generate_registration_number() IS
'Generates a unique registration number with format: AcademicYear(4) + Date(6) + CumulativeCounter(3). Counter is cumulative across the entire academic year.';