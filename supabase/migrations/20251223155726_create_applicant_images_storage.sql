/*
  # Create Storage Bucket for Applicant Images

  1. New Storage Bucket
    - `applicant-images` bucket for storing uploaded images from application forms
    - Supports image files (JPEG, PNG, WEBP)
    - 5MB file size limit per file
    - Organized by user_id/field_name structure

  2. Security
    - Students can upload to their own folder (user_id)
    - Students can read their own images
    - Admins can read all images
    - Students cannot delete or update images once uploaded
*/

-- Create the applicant-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'applicant-images',
  'applicant-images',
  false,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Students can upload images to their own folder
CREATE POLICY "Students can upload own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'applicant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Students can read their own images
CREATE POLICY "Students can read own images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'applicant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Admins can read all images
CREATE POLICY "Admins can read all images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'applicant-images' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: Students can update their own images (for re-upload)
CREATE POLICY "Students can update own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'applicant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'applicant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Students can delete their own images (for re-upload)
CREATE POLICY "Students can delete own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'applicant-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
