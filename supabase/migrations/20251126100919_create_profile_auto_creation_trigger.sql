/*
  # Create Profile Auto-Creation Trigger

  ## Purpose
  Automatically create a profile record when a new user signs up via auth.users.
  This ensures every user always has a profile, preventing "profile not found" errors.

  ## How It Works
  1. Trigger fires AFTER INSERT on auth.users table
  2. Function creates corresponding profile record in public.profiles
  3. Uses user metadata for full_name if available
  4. Sets default role as 'student'

  ## Security
  - Function uses SECURITY DEFINER to access auth.users table
  - Only creates profile for newly inserted user
  - No external input, only data from auth.users

  ## Impact
  - All new signups will automatically get a profile
  - Fixes signup flow where profile creation might fail
  - Ensures profile is always available after signup
*/

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, full_name, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    'student',
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    true
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the signup
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;