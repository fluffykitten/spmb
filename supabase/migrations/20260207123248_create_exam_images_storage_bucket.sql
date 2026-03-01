/*
  # Create Exam Images Storage Bucket

  1. New Storage Bucket
    - `exam-images` - Public bucket for storing images used in exam questions
    - Allows authenticated users to upload images
    - Public read access for rendering images in exams

  2. Security
    - Upload restricted to authenticated users only
    - File size limited to 1MB
    - Only image file types allowed (png, jpg, jpeg, gif, webp)
    - Public read access for all images
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-images',
  'exam-images',
  true,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

CREATE POLICY "Authenticated users can upload exam images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exam-images');

CREATE POLICY "Anyone can view exam images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'exam-images');

CREATE POLICY "Admins can delete exam images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exam-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update exam images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exam-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'exam-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );