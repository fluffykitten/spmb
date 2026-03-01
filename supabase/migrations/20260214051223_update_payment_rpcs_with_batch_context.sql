/*
  # Update Payment Management RPCs with Batch Context

  1. Updated Functions
    - `admin_initialize_payment_records` - Now uses batch amounts if available
    - `admin_initialize_payment_records_for_batch` - Bulk initialize for a specific batch
    - `admin_assign_batch_to_applicant` - Manually assign batch with optional payment re-initialization

  2. Important Notes
    - If applicant has a batch, amounts are auto-populated from batch
    - If no batch or manual override, uses provided amounts
    - Batch amounts are logged in audit trail
    - Bulk operations skip applicants with existing payment records
*/

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS admin_initialize_payment_records(uuid, numeric, numeric);

-- Update the existing payment initialization function to use batch context
CREATE OR REPLACE FUNCTION admin_initialize_payment_records(
  p_applicant_id uuid,
  p_entrance_fee_amount numeric DEFAULT NULL,
  p_administration_fee_amount numeric DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
  v_batch_entrance_fee numeric;
  v_batch_admin_fee numeric;
  v_final_entrance_fee numeric;
  v_final_admin_fee numeric;
  v_batch_id uuid;
  v_batch_name text;
  v_entrance_record_id uuid;
  v_admin_record_id uuid;
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

  -- Check if applicant exists
  IF NOT EXISTS (SELECT 1 FROM applicants WHERE id = p_applicant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Applicant not found'
    );
  END IF;

  -- Check if payment records already exist
  IF EXISTS (SELECT 1 FROM payment_records WHERE applicant_id = p_applicant_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment records already exist for this applicant'
    );
  END IF;

  -- Get batch information if applicant is assigned to a batch
  SELECT 
    rb.id,
    rb.name,
    rb.entrance_fee_amount,
    rb.administration_fee_amount
  INTO v_batch_id, v_batch_name, v_batch_entrance_fee, v_batch_admin_fee
  FROM applicants a
  LEFT JOIN registration_batches rb ON a.registration_batch_id = rb.id
  WHERE a.id = p_applicant_id;

  -- Determine final amounts: use batch amounts if available, otherwise use provided amounts
  v_final_entrance_fee := COALESCE(p_entrance_fee_amount, v_batch_entrance_fee, 0);
  v_final_admin_fee := COALESCE(p_administration_fee_amount, v_batch_admin_fee, 0);

  -- Create entrance fee record
  INSERT INTO payment_records (
    applicant_id,
    payment_type,
    payment_status,
    total_amount,
    paid_amount,
    updated_by
  ) VALUES (
    p_applicant_id,
    'entrance_fee',
    'unpaid',
    v_final_entrance_fee,
    0,
    v_admin_id
  ) RETURNING id INTO v_entrance_record_id;

  -- Create administration fee record
  INSERT INTO payment_records (
    applicant_id,
    payment_type,
    payment_status,
    total_amount,
    paid_amount,
    updated_by
  ) VALUES (
    p_applicant_id,
    'administration_fee',
    'unpaid',
    v_final_admin_fee,
    0,
    v_admin_id
  ) RETURNING id INTO v_admin_record_id;

  -- Log to audit trail
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  SELECT 
    v_admin_id,
    'initialize_payment_records',
    a.user_id,
    jsonb_build_object(
      'applicant_id', p_applicant_id,
      'batch_id', v_batch_id,
      'batch_name', v_batch_name,
      'entrance_fee', v_final_entrance_fee,
      'administration_fee', v_final_admin_fee,
      'used_batch_amounts', (v_batch_id IS NOT NULL AND p_entrance_fee_amount IS NULL AND p_administration_fee_amount IS NULL)
    )
  FROM applicants a
  WHERE a.id = p_applicant_id;

  RETURN jsonb_build_object(
    'success', true,
    'entrance_record_id', v_entrance_record_id,
    'admin_record_id', v_admin_record_id,
    'batch_name', v_batch_name,
    'entrance_fee', v_final_entrance_fee,
    'administration_fee', v_final_admin_fee,
    'used_batch_amounts', (v_batch_id IS NOT NULL AND p_entrance_fee_amount IS NULL AND p_administration_fee_amount IS NULL)
  );
END;
$$;

-- Function to bulk initialize payment records for all applicants in a batch
CREATE OR REPLACE FUNCTION admin_initialize_payment_records_for_batch(
  p_batch_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
  v_batch_entrance_fee numeric;
  v_batch_admin_fee numeric;
  v_batch_name text;
  v_applicant record;
  v_success_count integer := 0;
  v_skipped_count integer := 0;
  v_error_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
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
  SELECT name, entrance_fee_amount, administration_fee_amount
  INTO v_batch_name, v_batch_entrance_fee, v_batch_admin_fee
  FROM registration_batches
  WHERE id = p_batch_id;

  IF v_batch_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch not found'
    );
  END IF;

  -- Loop through all applicants in this batch
  FOR v_applicant IN
    SELECT a.id, a.user_id
    FROM applicants a
    WHERE a.registration_batch_id = p_batch_id
      AND a.status != 'draft'
  LOOP
    BEGIN
      -- Check if payment records already exist
      IF EXISTS (SELECT 1 FROM payment_records WHERE applicant_id = v_applicant.id) THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- Create payment records
      INSERT INTO payment_records (applicant_id, payment_type, payment_status, total_amount, paid_amount, updated_by)
      VALUES (v_applicant.id, 'entrance_fee', 'unpaid', v_batch_entrance_fee, 0, v_admin_id);

      INSERT INTO payment_records (applicant_id, payment_type, payment_status, total_amount, paid_amount, updated_by)
      VALUES (v_applicant.id, 'administration_fee', 'unpaid', v_batch_admin_fee, 0, v_admin_id);

      v_success_count := v_success_count + 1;

      -- Log to audit trail
      INSERT INTO audit_logs (user_id, action, target_user_id, details)
      VALUES (
        v_admin_id,
        'bulk_initialize_payment',
        v_applicant.user_id,
        jsonb_build_object(
          'applicant_id', v_applicant.id,
          'batch_id', p_batch_id,
          'batch_name', v_batch_name
        )
      );

    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'applicant_id', v_applicant.id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batch_name', v_batch_name,
    'success_count', v_success_count,
    'skipped_count', v_skipped_count,
    'error_count', v_error_count,
    'errors', v_errors
  );
END;
$$;

-- Function to manually assign batch to an applicant
CREATE OR REPLACE FUNCTION admin_assign_batch_to_applicant(
  p_applicant_id uuid,
  p_batch_id uuid,
  p_reinitialize_payments boolean DEFAULT false
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_admin_id uuid;
  v_old_batch_id uuid;
  v_batch_name text;
  v_applicant_user_id uuid;
  v_had_payments boolean;
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

  -- Check if batch exists
  SELECT name INTO v_batch_name
  FROM registration_batches
  WHERE id = p_batch_id;

  IF v_batch_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Batch not found'
    );
  END IF;

  -- Get old batch and check for existing payments
  SELECT 
    a.registration_batch_id,
    a.user_id,
    EXISTS (SELECT 1 FROM payment_records WHERE applicant_id = a.id)
  INTO v_old_batch_id, v_applicant_user_id, v_had_payments
  FROM applicants a
  WHERE a.id = p_applicant_id;

  IF v_applicant_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Applicant not found'
    );
  END IF;

  -- Update batch assignment
  UPDATE applicants
  SET registration_batch_id = p_batch_id
  WHERE id = p_applicant_id;

  -- If requested, delete old payments and create new ones
  IF p_reinitialize_payments AND v_had_payments THEN
    -- Delete old payment records and history
    DELETE FROM payment_history WHERE payment_record_id IN (
      SELECT id FROM payment_records WHERE applicant_id = p_applicant_id
    );
    DELETE FROM payment_records WHERE applicant_id = p_applicant_id;

    -- Initialize new payments using the batch amounts
    PERFORM admin_initialize_payment_records(p_applicant_id);
  END IF;

  -- Log to audit trail
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    v_admin_id,
    'assign_batch',
    v_applicant_user_id,
    jsonb_build_object(
      'applicant_id', p_applicant_id,
      'old_batch_id', v_old_batch_id,
      'new_batch_id', p_batch_id,
      'batch_name', v_batch_name,
      'reinitialized_payments', p_reinitialize_payments
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_name', v_batch_name,
    'had_payments', v_had_payments,
    'reinitialized', p_reinitialize_payments
  );
END;
$$;