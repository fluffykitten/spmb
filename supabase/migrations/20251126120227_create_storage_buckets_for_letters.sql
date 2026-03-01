/*
  # Create Storage Buckets for Letter System

  ## Overview
  Creates Supabase Storage buckets for:
  1. letter-template-pdfs - Uploaded PDF templates
  2. letterhead-assets - Logos, signatures, stamps
  3. generated-letters - Final generated PDF letters

  ## Buckets Created

  ### 1. letter-template-pdfs
  - Stores original PDF templates uploaded by admins
  - Size limit: 10MB per file
  - Allowed types: PDF only
  - Access: Admin only

  ### 2. letterhead-assets
  - Stores logos, signatures, and stamps
  - Size limit: 5MB per file
  - Allowed types: PNG, JPG, JPEG, SVG
  - Access: Admin write, public read

  ### 3. generated-letters
  - Stores generated PDF letters
  - Size limit: 10MB per file
  - Allowed types: PDF only
  - Access: Admin read/write, students read own letters

  ## Security
  - RLS policies ensure proper access control
  - File type validation via bucket configuration
  - Size limits prevent abuse

  ## File Organization
  - letter-template-pdfs: flat structure with UUID names
  - letterhead-assets: /{type}/{filename} (e.g., /logos/school-logo.png)
  - generated-letters: /{year}/{month}/{filename}
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'letter-template-pdfs',
    'letter-template-pdfs',
    false,
    10485760, -- 10MB
    ARRAY['application/pdf']::text[]
  ),
  (
    'letterhead-assets',
    'letterhead-assets',
    true, -- Public read for displaying in templates
    5242880, -- 5MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']::text[]
  ),
  (
    'generated-letters',
    'generated-letters',
    false,
    10485760, -- 10MB
    ARRAY['application/pdf']::text[]
  )
ON CONFLICT (id) DO NOTHING;

-- Storage policies for letter-template-pdfs (admin only)
CREATE POLICY "Admins can upload template PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'letter-template-pdfs' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can read template PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'letter-template-pdfs' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update template PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'letter-template-pdfs' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete template PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'letter-template-pdfs' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Storage policies for letterhead-assets (admin write, public read)
CREATE POLICY "Admins can upload letterhead assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'letterhead-assets' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Anyone can read letterhead assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'letterhead-assets');

CREATE POLICY "Admins can update letterhead assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'letterhead-assets' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete letterhead assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'letterhead-assets' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Storage policies for generated-letters (admin all, students read own)
CREATE POLICY "Admins can upload generated letters"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generated-letters' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can read all generated letters"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-letters' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Students can read their own letters"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generated-letters' AND
    -- Check if file path contains student's applicant ID
    -- Format: {year}/{month}/{applicant_id}_{template_name}.pdf
    EXISTS (
      SELECT 1 FROM applicants
      WHERE applicants.user_id = auth.uid()
      AND storage.objects.name LIKE '%' || applicants.id::text || '%'
    )
  );

CREATE POLICY "Admins can update generated letters"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'generated-letters' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete generated letters"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generated-letters' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );