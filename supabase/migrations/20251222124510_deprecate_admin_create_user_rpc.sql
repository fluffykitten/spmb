/*
  # Deprecate admin_create_user RPC Function

  ## Summary
  This migration deprecates the old `admin_create_user` RPC function that directly
  inserted into auth.users using PostgreSQL's crypt() function. This approach caused
  login failures due to incompatibility between PostgreSQL's bcrypt implementation
  and Supabase's GoTrue authentication service.

  ## Problem with Old Approach
  1. Direct database insertion using crypt(password, gen_salt('bf')) creates hashes
     that are technically bcrypt, but not fully compatible with GoTrue's validation
  2. Missing auth.identities records needed by Supabase authentication
  3. Incomplete user initialization causing authentication failures

  ## New Approach
  User creation now uses the Supabase Admin API via an Edge Function:
  - Edge Function: admin-create-user
  - Uses supabase.auth.admin.createUser() for full compatibility
  - Ensures proper password hashing by GoTrue
  - Automatically populates all required auth tables
  - Service role key stays secure on server

  ## Changes
  1. Drop the old admin_create_user function
  2. Add a comment explaining the deprecation
  3. Keep other admin functions (reset password, update profile, etc.) as they don't
     deal with password creation

  ## Notes
  - The handle_new_user trigger still works to create profiles automatically
  - Admin API is the only supported way to create users programmatically
  - This ensures users can successfully log in after creation
*/

-- Drop the old admin_create_user function
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text, text);

-- Add a comment to prevent future confusion
COMMENT ON SCHEMA public IS 'User creation should use the admin-create-user Edge Function, not direct database insertion. The Edge Function uses Supabase Admin API for full authentication compatibility.';
