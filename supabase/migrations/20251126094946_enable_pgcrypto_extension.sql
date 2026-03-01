/*
  # Enable pgcrypto Extension for Password Hashing

  ## Description
  This migration enables the pgcrypto extension which is required for the
  admin_create_user RPC function. The extension provides cryptographic functions
  including gen_salt() and crypt() for secure password hashing.

  ## Changes
  1. Enable pgcrypto extension if not already enabled
  2. Ensure extension is available in the public schema

  ## Security
  - pgcrypto is a standard PostgreSQL extension for cryptographic operations
  - Required for password hashing in user creation functions
  - Safe to enable in production environments

  ## Notes
  - This fixes the "function gen_salt(unknown) does not exist" error
  - Extension will be available to all functions that need it
*/

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
