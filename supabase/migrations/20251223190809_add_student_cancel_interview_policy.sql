/*
  # Add Student Cancel Interview Policy
  
  Allows students to cancel their own interview requests when status is pending_review.
  
  ## Changes
  
  1. Add new RLS policy for students to update status to 'cancelled'
     - Students can only update their own requests
     - Only when current status is 'pending_review'
     - Can only set status to 'cancelled'
*/

-- Drop existing student update policy that's too restrictive
DROP POLICY IF EXISTS "Students can update requests when revision requested" ON interview_requests;

-- Create new policy for updating when revision requested
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

-- Add new policy for cancelling pending requests
CREATE POLICY "Students can cancel pending requests"
  ON interview_requests FOR UPDATE
  TO authenticated
  USING (
    status = 'pending_review'
    AND EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = interview_requests.applicant_id
        AND applicants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.id = interview_requests.applicant_id
        AND applicants.user_id = auth.uid()
    )
  );