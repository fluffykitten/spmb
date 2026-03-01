/*
  # Fix app_config Public Read Access

  The Landing page is publicly accessible but needs to read app_config data.
  This migration adds a policy to allow public (unauthenticated) read access
  to the app_config table.

  ## Changes
  - Drop the existing "All authenticated users can read config" policy
  - Add new policy allowing ALL users (authenticated and anonymous) to read config
  - Keep write restrictions (admins only)

  ## Security Notes
  - Configuration data is safe to be publicly readable (school name, logo, etc.)
  - No sensitive data should be stored in app_config
  - Write access remains restricted to admins only
*/

-- Drop the old policy that only allowed authenticated users
DROP POLICY IF EXISTS "All authenticated users can read config" ON app_config;

-- Create new policy allowing everyone to read config
CREATE POLICY "Anyone can read config"
  ON app_config FOR SELECT
  TO public
  USING (true);
