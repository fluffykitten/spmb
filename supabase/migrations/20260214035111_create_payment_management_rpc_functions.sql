/*
  # Payment Management RPC Functions

  ## Overview
  Creates RPC functions for managing payment records and retrieving monitoring data.

  ## Functions Created

  ### 1. admin_update_payment_status
  Updates payment status and records payment history.
  - Parameters: applicant_id, payment_type, new_status, amount_paid, method, date, notes
  - Returns: updated payment record
  - Security: Admin only

  ### 2. admin_get_payment_history
  Retrieves payment history for a specific payment type.
  - Parameters: applicant_id, payment_type
  - Returns: array of payment history records
  - Security: Admin only

  ### 3. admin_get_document_download_details
  Gets detailed document download information for an applicant.
  - Parameters: applicant_id
  - Returns: array of documents with download status
  - Security: Admin only

  ### 4. admin_initialize_payment_records
  Initializes payment records for an applicant (called after form submission).
  - Parameters: applicant_id, entrance_fee_amount, admin_fee_amount
  - Returns: created payment records
  - Security: Admin only
*/

-- Function: Update payment status and record history
CREATE OR REPLACE FUNCTION admin_update_payment_status(
  p_applicant_id uuid,
  p_payment_type text,
  p_new_status text,
  p_amount_paid numeric,
  p_method text,
  p_payment_date timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
  v_payment_record payment_records;
  v_history_id uuid;
  v_current_paid numeric;
BEGIN
  -- Check if user is admin
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Validate payment type
  IF p_payment_type NOT IN ('entrance_fee', 'administration_fee') THEN
    RAISE EXCEPTION 'Invalid payment type';
  END IF;

  -- Validate payment status
  IF p_new_status NOT IN ('unpaid', 'partial', 'paid', 'waived') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  -- Get current payment record
  SELECT * INTO v_payment_record
  FROM payment_records
  WHERE applicant_id = p_applicant_id
  AND payment_type = p_payment_type;

  IF v_payment_record IS NULL THEN
    RAISE EXCEPTION 'Payment record not found';
  END IF;

  -- Calculate new paid amount
  v_current_paid := COALESCE(v_payment_record.paid_amount, 0) + p_amount_paid;

  -- Validate paid amount doesn't exceed total
  IF v_current_paid > v_payment_record.total_amount AND p_new_status != 'waived' THEN
    RAISE EXCEPTION 'Paid amount cannot exceed total amount';
  END IF;

  -- Update payment record
  UPDATE payment_records
  SET 
    payment_status = p_new_status,
    paid_amount = CASE 
      WHEN p_new_status = 'waived' THEN total_amount
      ELSE v_current_paid
    END,
    payment_method = p_method,
    payment_date = p_payment_date,
    payment_notes = p_notes,
    updated_by = v_admin_id,
    updated_at = now()
  WHERE applicant_id = p_applicant_id
  AND payment_type = p_payment_type
  RETURNING * INTO v_payment_record;

  -- Record payment history (only if amount > 0 or status is waived)
  IF p_amount_paid > 0 OR p_new_status = 'waived' THEN
    INSERT INTO payment_history (
      payment_record_id,
      amount,
      payment_method,
      payment_date,
      notes,
      recorded_by
    ) VALUES (
      v_payment_record.id,
      CASE WHEN p_new_status = 'waived' THEN 0 ELSE p_amount_paid END,
      p_method,
      p_payment_date,
      CASE 
        WHEN p_new_status = 'waived' THEN 'Payment waived' || COALESCE(': ' || p_notes, '')
        ELSE p_notes
      END,
      v_admin_id
    ) RETURNING id INTO v_history_id;
  END IF;

  -- Log to audit_logs
  INSERT INTO audit_logs (user_id, action, target_user_id, details)
  VALUES (
    v_admin_id,
    'payment_updated',
    (SELECT user_id FROM applicants WHERE id = p_applicant_id),
    jsonb_build_object(
      'payment_type', p_payment_type,
      'old_status', v_payment_record.payment_status,
      'new_status', p_new_status,
      'amount_paid', p_amount_paid,
      'payment_method', p_method
    )
  );

  -- Return updated record
  RETURN row_to_json(v_payment_record);
END;
$$;

-- Function: Get payment history for a specific payment type
CREATE OR REPLACE FUNCTION admin_get_payment_history(
  p_applicant_id uuid,
  p_payment_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
  v_result json;
BEGIN
  -- Check if user is admin
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get payment history
  SELECT json_agg(
    json_build_object(
      'id', ph.id,
      'amount', ph.amount,
      'payment_method', ph.payment_method,
      'payment_date', ph.payment_date,
      'notes', ph.notes,
      'recorded_by', ph.recorded_by,
      'recorded_by_name', p.full_name,
      'created_at', ph.created_at
    ) ORDER BY ph.payment_date DESC
  ) INTO v_result
  FROM payment_history ph
  JOIN payment_records pr ON pr.id = ph.payment_record_id
  LEFT JOIN profiles p ON p.user_id = ph.recorded_by
  WHERE pr.applicant_id = p_applicant_id
  AND pr.payment_type = p_payment_type;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- Function: Get document download details for an applicant
CREATE OR REPLACE FUNCTION admin_get_document_download_details(
  p_applicant_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
  v_result json;
BEGIN
  -- Check if user is admin
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Get document download details
  SELECT json_agg(
    json_build_object(
      'document_id', ad.id,
      'document_name', ad.name,
      'document_description', ad.description,
      'is_downloaded', CASE WHEN dd.id IS NOT NULL THEN true ELSE false END,
      'download_count', COALESCE(dd.download_count, 0),
      'last_downloaded', dd.downloaded_at,
      'access_rule', ad.access_rule
    ) ORDER BY ad.display_order
  ) INTO v_result
  FROM applicant_documents ad
  LEFT JOIN document_downloads dd ON dd.document_id = ad.id AND dd.applicant_id = p_applicant_id
  WHERE ad.is_active = true;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- Function: Initialize payment records for an applicant
CREATE OR REPLACE FUNCTION admin_initialize_payment_records(
  p_applicant_id uuid,
  p_entrance_fee_amount numeric DEFAULT 0,
  p_admin_fee_amount numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid;
  v_entrance_record payment_records;
  v_admin_record payment_records;
BEGIN
  -- Check if user is admin
  SELECT user_id INTO v_admin_id
  FROM profiles
  WHERE user_id = auth.uid() AND role = 'admin';
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Create entrance fee record if not exists
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
    p_entrance_fee_amount,
    0,
    v_admin_id
  )
  ON CONFLICT (applicant_id, payment_type) DO UPDATE
  SET total_amount = EXCLUDED.total_amount,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING * INTO v_entrance_record;

  -- Create administration fee record if not exists
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
    p_admin_fee_amount,
    0,
    v_admin_id
  )
  ON CONFLICT (applicant_id, payment_type) DO UPDATE
  SET total_amount = EXCLUDED.total_amount,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING * INTO v_admin_record;

  -- Return both records
  RETURN json_build_object(
    'entrance_fee', row_to_json(v_entrance_record),
    'administration_fee', row_to_json(v_admin_record)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_update_payment_status TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_payment_history TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_document_download_details TO authenticated;
GRANT EXECUTE ON FUNCTION admin_initialize_payment_records TO authenticated;

COMMENT ON FUNCTION admin_update_payment_status IS 'Updates payment status and records transaction history. Admin only.';
COMMENT ON FUNCTION admin_get_payment_history IS 'Retrieves complete payment history for a specific payment type. Admin only.';
COMMENT ON FUNCTION admin_get_document_download_details IS 'Gets detailed document download status for an applicant. Admin only.';
COMMENT ON FUNCTION admin_initialize_payment_records IS 'Initializes payment records for an applicant with default amounts. Admin only.';