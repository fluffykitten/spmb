/*
  # Fix storage bucket policies for applicant documents - correct user_id reference

  1. Issue
    - Current policies check `profiles.id = auth.uid()`
    - But profiles.id is the profile's primary key, NOT the auth user ID
    - Should check `profiles.user_id = auth.uid()` instead

  2. Changes
    - Drop existing policies
    - Recreate with correct user_id reference
    - Ensures admin role check works properly

  3. Security
    - Only admins can upload, update, and delete documents
    - All authenticated users can read documents
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete documents" ON storage.objects;

-- Recreate policies with correct user_id reference
CREATE POLICY "Admins can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'applicant-documents'
    AND (
      SELECT role FROM public.profiles 
      WHERE user_id = auth.uid() 
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
      WHERE user_id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'applicant-documents'
    AND (
      SELECT role FROM public.profiles 
      WHERE user_id = auth.uid() 
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
      WHERE user_id = auth.uid() 
      LIMIT 1
    ) = 'admin'
  );
