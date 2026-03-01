/*
  # Create Storage Buckets for DOCX Template System

  ## Overview
  Creates Supabase Storage buckets for:
  1. docx-templates - Store .docx template files
  2. letterhead-images - Store kop surat images (global)

  ## Buckets Created

  ### 1. docx-templates
  - Stores DOCX template files uploaded by admins
  - Size limit: 10MB per file
  - Allowed types: DOCX only
  - Access: Admin write, authenticated read

  ### 2. letterhead-images  
  - Stores letterhead images (logo, stamp)
  - Size limit: 5MB per file
  - Allowed types: PNG, JPG, JPEG, SVG
  - Access: Admin write, public read (for display in documents)

  ## Security
  - RLS policies ensure proper access control
  - File type validation via bucket configuration
  - Size limits prevent abuse
*/

-- Create docx-templates bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'docx-templates',
    'docx-templates',
    false,
    10485760,
    ARRAY[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- Create letterhead-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'letterhead-images',
    'letterhead-images',
    true,
    5242880,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- Storage policies for docx-templates
CREATE POLICY "Admins can upload DOCX templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'docx-templates' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users can read DOCX templates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'docx-templates');

CREATE POLICY "Admins can update DOCX templates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'docx-templates' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete DOCX templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'docx-templates' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Storage policies for letterhead-images
CREATE POLICY "Admins can upload letterhead images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'letterhead-images' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Everyone can read letterhead images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'letterhead-images');

CREATE POLICY "Admins can update letterhead images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'letterhead-images' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete letterhead images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'letterhead-images' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );