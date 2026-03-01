/*
  # Create Slideshow Images Table

  ## Description
  This migration creates the slideshow_images table for managing
  hero images on the landing page.

  ## New Tables
  1. `slideshow_images`
    - `id` (uuid, primary key) - Unique identifier
    - `title` (text) - Image title/caption
    - `description` (text) - Image description
    - `image_url` (text, required) - URL to the image
    - `order_index` (integer) - Display order (lower numbers first)
    - `is_active` (boolean) - Whether image is shown in slideshow
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on slideshow_images table
  - Public can view active slides (for landing page)
  - Only admins can manage slides (CRUD operations)

  ## Notes
  - Images are ordered by order_index ASC
  - Only active images are shown on landing page
  - Admin can reorder by changing order_index
*/

CREATE TABLE IF NOT EXISTS slideshow_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  description text,
  image_url text NOT NULL,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE slideshow_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active slides"
  ON slideshow_images FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all slides"
  ON slideshow_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert slides"
  ON slideshow_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update slides"
  ON slideshow_images FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete slides"
  ON slideshow_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_slideshow_order ON slideshow_images(order_index);
CREATE INDEX IF NOT EXISTS idx_slideshow_active ON slideshow_images(is_active);

-- Insert default slideshow images (using placeholder images from Pexels)
INSERT INTO slideshow_images (title, description, image_url, order_index, is_active) VALUES
  ('Gedung Sekolah', 'Fasilitas modern dan nyaman untuk kegiatan belajar mengajar', 'https://images.pexels.com/photos/256395/pexels-photo-256395.jpeg?auto=compress&cs=tinysrgb&w=1920', 1, true),
  ('Ruang Kelas', 'Ruang kelas ber-AC dengan teknologi pembelajaran terkini', 'https://images.pexels.com/photos/289737/pexels-photo-289737.jpeg?auto=compress&cs=tinysrgb&w=1920', 2, true),
  ('Perpustakaan', 'Perpustakaan lengkap dengan ribuan koleksi buku', 'https://images.pexels.com/photos/2041540/pexels-photo-2041540.jpeg?auto=compress&cs=tinysrgb&w=1920', 3, true);
