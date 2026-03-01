/*
  # Fix User Monitoring View

  ## Overview
  Fixes document count and improves data accuracy in user_monitoring_status view

  ## Changes
  1. Fix document download count to use document_generations instead of document_downloads
     - document_generations tracks generated documents (letters, certificates)
     - document_downloads was tracking uploaded documents (KTP, ijazah)
  2. Count documents where downloaded_at IS NOT NULL as downloaded
  3. Count total document_generations as total available documents

  ## Impact
  - Document statistics in monitoring dashboard will now show correct counts
  - Will properly track student document download progress
*/

-- Drop and recreate the user_monitoring_status view with correct document counting
CREATE OR REPLACE VIEW user_monitoring_status AS
SELECT
  p.id as profile_id,
  p.user_id,
  p.full_name,
  p.email,
  p.phone_number,
  p.role,
  p.is_active,
  a.id as applicant_id,
  a.registration_number,
  a.status as form_status,
  a.created_at as application_date,
  a.interview_status,
  a.interview_score,
  a.exam_status,
  a.exam_score,
  a.final_score,

  -- Document download statistics (FIXED: using document_generations)
  -- Count documents that have been downloaded (downloaded_at IS NOT NULL)
  (SELECT COUNT(*)
   FROM document_generations dg
   WHERE dg.applicant_id = a.id
   AND dg.downloaded_at IS NOT NULL) as documents_downloaded_count,
  -- Count total documents generated for this applicant
  (SELECT COUNT(*)
   FROM document_generations dg
   WHERE dg.applicant_id = a.id) as total_documents_count,

  -- Interview request data
  (SELECT ir.status
   FROM interview_requests ir
   WHERE ir.applicant_id = a.id
   ORDER BY ir.created_at DESC
   LIMIT 1) as latest_interview_request_status,

  -- Exam attempt data
  (SELECT COUNT(*)
   FROM exam_attempts ea
   WHERE ea.applicant_id = a.id) as exam_attempts_count,

  -- Payment status for entrance fee
  (SELECT pr.payment_status
   FROM payment_records pr
   WHERE pr.applicant_id = a.id
   AND pr.payment_type = 'entrance_fee') as entrance_fee_status,
  (SELECT pr.paid_amount
   FROM payment_records pr
   WHERE pr.applicant_id = a.id
   AND pr.payment_type = 'entrance_fee') as entrance_fee_paid,
  (SELECT pr.total_amount
   FROM payment_records pr
   WHERE pr.applicant_id = a.id
   AND pr.payment_type = 'entrance_fee') as entrance_fee_total,

  -- Payment status for administration fee
  (SELECT pr.payment_status
   FROM payment_records pr
   WHERE pr.applicant_id = a.id
   AND pr.payment_type = 'administration_fee') as administration_fee_status,
  (SELECT pr.paid_amount
   FROM payment_records pr
   WHERE pr.applicant_id = a.id
   AND pr.payment_type = 'administration_fee') as administration_fee_paid,
  (SELECT pr.total_amount
   FROM payment_records pr
   WHERE pr.applicant_id = a.id
   AND pr.payment_type = 'administration_fee') as administration_fee_total

FROM profiles p
LEFT JOIN applicants a ON a.user_id = p.user_id
WHERE p.role = 'student'
ORDER BY p.created_at DESC;

-- Ensure proper access
GRANT SELECT ON user_monitoring_status TO authenticated;

COMMENT ON VIEW user_monitoring_status IS 'Comprehensive view of student progress including form, documents (from document_generations), interviews, exams, and payments';
