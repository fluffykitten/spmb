/*
  # Fix storage bucket policies for applicant documents

  1. Changes
    - Drop existing policies to avoid conflicts
    - Recreate policies with proper permissions
    - Ensure admin role check works correctly

  2. Security
    - Only admins can upload, update, and delete
    - All authenticated users can read
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- Recreate policies with proper admin check
CREATE POLICY "Admins can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'applicant-documents'
    AND (
      SELECT role FROM public.profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'applicant-documents');

CREATE POLICY "Admins can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'applicant-documents'
    AND (
      SELECT role FROM public.profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'applicant-documents'
    AND (
      SELECT role FROM public.profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );

CREATE POLICY "Admins can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'applicant-documents'
    AND (
      SELECT role FROM public.profiles 
      WHERE id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );