/*
  # Create Batch Backfill Functions

  1. New Functions
    - `admin_backfill_batch_assignments` - Assigns batches to existing applicants based on their registration date
    - `admin_sync_batch_payments` - Ensures all applicants in a batch have payment records initialized

  2. Purpose
    - Handles retroactive assignment of batches to applicants who registered before batches were created
    - Initializes payment records for all applicants in a batch who don't have them

  3. Security
    - Requires admin authentication
    - All operations logged to audit trail
    - Safe operations that skip already-assigned applicants
*/

-- Function to backfill batch assignments for existing applicants
CREATE OR REPLACE FUNCTION admin_backfill_batch_assignments(
  p_batch_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
  v_batch record;
  v_applicant record;
  v_assigned_count integer := 0;
  v_skipped_count integer := 0;
  v_batches_processed jsonb := '[]'::jsonb;
BEGIN
  -- Verify admin user
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- If batch_id is provided, process only that batch
  -- Otherwise, process all active batches
  FOR v_batch IN
    SELECT id, name, start_date, end_date, entrance_fee_amount, administration_fee_amount
    FROM registration_batches
    WHERE (p_batch_id IS NULL OR id = p_batch_id)
      AND is_active = true
    ORDER BY start_date
  LOOP
    DECLARE
      v_batch_assigned integer := 0;
      v_batch_skipped integer := 0;
    BEGIN
      -- Find applicants whose created_at falls within this batch's date range
      -- and who don't have a batch assigned yet
      FOR v_applicant IN
        SELECT a.id, a.user_id, a.created_at, a.status
        FROM applicants a
        WHERE a.registration_batch_id IS NULL
          AND a.status != 'draft'
          AND a.created_at::date >= v_batch.start_date
          AND a.created_at::date <= v_batch.end_date
      LOOP
        -- Assign the batch
        UPDATE applicants
        SET registration_batch_id = v_batch.id
        WHERE id = v_applicant.id;

        v_batch_assigned := v_batch_assigned + 1;
        v_assigned_count := v_assigned_count + 1;

        -- Log to audit trail
        INSERT INTO audit_logs (user_id, action, target_user_id, details)
        VALUES (
          v_admin_id,
          'backfill_batch_assignment',
          v_applicant.user_id,
          jsonb_build_object(
            'applicant_id', v_applicant.id,
            'batch_id', v_batch.id,
            'batch_name', v_batch.name,
            'registration_date', v_applicant.created_at,
            'batch_date_range', v_batch.start_date || ' to ' || v_batch.end_date
          )
        );
      END LOOP;

      -- Count applicants already assigned to this batch (skipped)
      SELECT COUNT(*)
      INTO v_batch_skipped
      FROM applicants
      WHERE registration_batch_id = v_batch.id
        AND status != 'draft';

      v_skipped_count := v_skipped_count + v_batch_skipped;

      -- Add batch summary to results
      v_batches_processed := v_batches_processed || jsonb_build_object(
        'batch_id', v_batch.id,
        'batch_name', v_batch.name,
        'assigned', v_batch_assigned,
        'already_assigned', v_batch_skipped
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_assigned', v_assigned_count,
    'total_already_assigned', v_skipped_count,
    'batches_processed', v_batches_processed
  );
END;
$$;

-- Function to sync payment records for all applicants in a batch
CREATE OR REPLACE FUNCTION admin_sync_batch_payments(
  p_batch_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
  v_batch record;
  v_applicant record;
  v_initialized_count integer := 0;
  v_already_has_payment integer := 0;
  v_no_batch_count integer := 0;
BEGIN
  -- Verify admin user
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Get batch information
  SELECT id, name, entrance_fee_amount, administration_fee_amount
  INTO v_batch
  FROM registration_batches
  WHERE id = p_batch_id;

  IF v_batch.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch not found'
    );
  END IF;

  -- First, backfill batch assignments for this specific batch
  PERFORM admin_backfill_batch_assignments(p_batch_id);

  -- Process all applicants in this batch
  FOR v_applicant IN
    SELECT a.id, a.user_id, a.status
    FROM applicants a
    WHERE a.registration_batch_id = p_batch_id
      AND a.status != 'draft'
  LOOP
    -- Check if payment records already exist
    IF EXISTS (SELECT 1 FROM payment_records WHERE applicant_id = v_applicant.id) THEN
      v_already_has_payment := v_already_has_payment + 1;
      CONTINUE;
    END IF;

    -- Create payment records using batch amounts
    INSERT INTO payment_records (
      applicant_id,
      payment_type,
      payment_status,
      total_amount,
      paid_amount,
      updated_by
    ) VALUES
      (v_applicant.id, 'entrance_fee', 'unpaid', v_batch.entrance_fee_amount, 0, v_admin_id),
      (v_applicant.id, 'administration_fee', 'unpaid', v_batch.administration_fee_amount, 0, v_admin_id);

    v_initialized_count := v_initialized_count + 1;

    -- Log to audit trail
    INSERT INTO audit_logs (user_id, action, target_user_id, details)
    VALUES (
      v_admin_id,
      'sync_batch_payments',
      v_applicant.user_id,
      jsonb_build_object(
        'applicant_id', v_applicant.id,
        'batch_id', p_batch_id,
        'batch_name', v_batch.name,
        'entrance_fee', v_batch.entrance_fee_amount,
        'administration_fee', v_batch.administration_fee_amount
      )
    );
  END LOOP;

  -- Count applicants without batch assignment
  SELECT COUNT(*)
  INTO v_no_batch_count
  FROM applicants
  WHERE registration_batch_id IS NULL
    AND status != 'draft';

  RETURN jsonb_build_object(
    'success', true,
    'batch_name', v_batch.name,
    'initialized', v_initialized_count,
    'already_had_payment', v_already_has_payment,
    'applicants_without_batch', v_no_batch_count
  );
END;
$$;

-- Function to get batch statistics for admin dashboard
CREATE OR REPLACE FUNCTION admin_get_batch_statistics(
  p_batch_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
  v_total_applicants integer;
  v_with_payment integer;
  v_without_payment integer;
  v_unassigned_in_range integer;
  v_batch record;
BEGIN
  -- Verify admin user
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';

  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Get batch info
  SELECT id, name, start_date, end_date
  INTO v_batch
  FROM registration_batches
  WHERE id = p_batch_id;

  IF v_batch.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch not found'
    );
  END IF;

  -- Count applicants in this batch
  SELECT COUNT(*)
  INTO v_total_applicants
  FROM applicants
  WHERE registration_batch_id = p_batch_id
    AND status != 'draft';

  -- Count applicants with payment records
  SELECT COUNT(DISTINCT a.id)
  INTO v_with_payment
  FROM applicants a
  WHERE a.registration_batch_id = p_batch_id
    AND a.status != 'draft'
    AND EXISTS (SELECT 1 FROM payment_records pr WHERE pr.applicant_id = a.id);

  v_without_payment := v_total_applicants - v_with_payment;

  -- Count unassigned applicants whose registration date falls in this batch's range
  SELECT COUNT(*)
  INTO v_unassigned_in_range
  FROM applicants
  WHERE registration_batch_id IS NULL
    AND status != 'draft'
    AND created_at::date >= v_batch.start_date
    AND created_at::date <= v_batch.end_date;

  RETURN jsonb_build_object(
    'success', true,
    'batch_name', v_batch.name,
    'total_applicants', v_total_applicants,
    'with_payment_records', v_with_payment,
    'without_payment_records', v_without_payment,
    'unassigned_in_date_range', v_unassigned_in_range
  );
END;
$$;
