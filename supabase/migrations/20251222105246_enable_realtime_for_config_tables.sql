/*
  # Enable Realtime for Configuration Tables

  This migration enables Realtime replication for the app_config and slideshow_images
  tables so that the landing page can receive instant updates when configuration changes.

  ## Changes
  - Enable Realtime replication on app_config table
  - Enable Realtime replication on slideshow_images table

  ## Notes
  - This allows the frontend to subscribe to changes via Supabase Realtime
  - Changes will be instantly reflected on the homepage without manual refresh
*/

-- Enable Realtime for app_config
ALTER PUBLICATION supabase_realtime ADD TABLE app_config;

-- Enable Realtime for slideshow_images
ALTER PUBLICATION supabase_realtime ADD TABLE slideshow_images;
