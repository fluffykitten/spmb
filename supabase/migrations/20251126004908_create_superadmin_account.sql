/*
  # Create Superadmin Account

  ## Description
  This migration creates a superadmin account with full privileges.
  The superadmin can manage all aspects of the system including creating other admins.

  ## Changes
  1. Create superadmin user in auth.users
  2. Create corresponding profile with admin role
  3. Fix existing admin@ppdb.sch.id profile if needed

  ## Credentials
  - Email: admin@smabibs.sch.id
  - Password: admin
  - Role: admin (superadmin)

  ## Security
  - Uses Supabase auth system
  - Password is hashed automatically
  - RLS policies apply

  ## Notes
  - This is for initial setup only
  - Password should be changed after first login
  - Superadmin has full access to all features
*/

-- First, update the existing admin@ppdb.sch.id profile to have email
UPDATE profiles 
SET email = 'admin@ppdb.sch.id'
WHERE user_id = 'd2a3abd7-f42d-4d00-9de7-4e2c267a9cc6' AND email IS NULL;

-- Create the superadmin user
-- Note: We'll use Supabase's signup function which handles password hashing
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Insert into auth.users (this creates the authentication account)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    aud,
    role
  ) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@smabibs.sch.id',
    crypt('admin', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    '',
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO new_user_id;

  -- Create profile for the superadmin
  INSERT INTO profiles (user_id, email, full_name, role, created_at, updated_at)
  VALUES (
    new_user_id,
    'admin@smabibs.sch.id',
    'Super Administrator',
    'admin',
    now(),
    now()
  );

  RAISE NOTICE 'Superadmin account created with ID: %', new_user_id;
END $$;
