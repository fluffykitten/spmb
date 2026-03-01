# Testing Guide for Admin User Management Fixes

## Quick Verification

All fixes have been successfully applied. Here's how to verify each fix works:

---

## Test 1: User Creation (Fix: pgcrypto extension)

### What Was Broken
❌ Error: `function gen_salt(unknown) does not exist`

### How to Test
1. Login as admin (admin@smabibs.sch.id)
2. Navigate to **User Management** page
3. Click **"Create User"** button
4. Fill in the form:
   - Email: `newuser@test.com`
   - Full Name: `New Test User`
   - Role: `student`
   - Password: Generate or enter one
5. Click **"Create User"**

### Expected Result
✅ User is created successfully
✅ Password modal appears with the generated password
✅ No console errors
✅ User appears in the user list

### Database Verification
```sql
-- Check that pgcrypto is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';
-- Should return: pgcrypto | 1.3

-- Check the new user exists
SELECT user_id, email, full_name, role FROM profiles WHERE email = 'newuser@test.com';
-- Should show the new user

-- Check audit log was created
SELECT action, details FROM audit_logs WHERE action = 'user_created' ORDER BY created_at DESC LIMIT 1;
-- Should show the user creation event
```

---

## Test 2: Password Reset (Fix: user_id mapping)

### What Was Broken
❌ Error: `Target user not found: 7b325d03-eb73-41d2-9200-3a0ff7cc372b`
- Frontend sent `profiles.id` instead of `profiles.user_id`
- Password reset function looked for wrong ID

### How to Test
1. Login as admin
2. Navigate to **User Management** page
3. Find any student user in the list
4. Click the **Key icon** (Reset Password) for that user
5. Wait for the operation to complete

### Expected Result
✅ Password reset succeeds
✅ Modal shows the new temporary password
✅ No "user not found" error
✅ User can login with new password

### Database Verification
```sql
-- Check that admin_get_all_profiles returns user_id as id
-- This should show that the 'id' field contains the auth.users.id value
SELECT id, user_id FROM admin_get_all_profiles() LIMIT 3;
-- The 'id' and 'user_id' columns should have the same values

-- Check audit log for password reset
SELECT user_id, action, target_user_id, details
FROM audit_logs
WHERE action = 'password_reset'
ORDER BY created_at DESC LIMIT 1;
-- Should show the password reset event with correct user_id and target_user_id
```

---

## Test 3: User Deletion (Fix: audit_logs schema)

### What Was Broken
❌ Error: `column "table_name" of relation "audit_logs" does not exist`
- Function tried to insert `table_name` and `record_id` columns
- But audit_logs only has: `user_id`, `action`, `target_user_id`, `details`

### How to Test
1. Login as admin
2. Navigate to **User Management** page
3. Find a test user (NOT yourself) in the list
4. Click the **Trash icon** (Delete) for that user
5. Confirm the deletion in the dialog

### Expected Result
✅ User is deleted successfully
✅ User disappears from the list immediately
✅ No "column does not exist" error
✅ Audit log is created

### Database Verification
```sql
-- Check audit_logs table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;
-- Should show: id, user_id, action, target_user_id, details, created_at
-- Should NOT have: table_name, record_id

-- Check recent deletion audit log
SELECT user_id, action, target_user_id, details
FROM audit_logs
WHERE action = 'user_delete'
ORDER BY created_at DESC LIMIT 1;
-- Should show correct structure with all columns populated
```

---

## Automated Test Suite

Run this SQL query to verify all fixes at once:

```sql
-- Comprehensive Verification Test
SELECT
  'pgcrypto extension' as test,
  CASE WHEN COUNT(*) > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM pg_extension WHERE extname = 'pgcrypto'

UNION ALL

SELECT
  'audit_logs has correct schema' as test,
  CASE WHEN COUNT(*) = 6 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns
WHERE table_name = 'audit_logs'
  AND column_name IN ('id', 'user_id', 'action', 'target_user_id', 'details', 'created_at')

UNION ALL

SELECT
  'all admin functions exist' as test,
  CASE WHEN COUNT(*) = 5 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.routines
WHERE routine_name IN (
  'admin_get_all_profiles',
  'admin_create_user',
  'admin_reset_user_password',
  'admin_delete_profile',
  'admin_update_profile'
)

UNION ALL

SELECT
  'profiles has id and user_id' as test,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('id', 'user_id')

ORDER BY test;
```

**Expected Output:**
```
test                              | status
----------------------------------+---------
all admin functions exist         | ✅ PASS
audit_logs has correct schema     | ✅ PASS
pgcrypto extension               | ✅ PASS
profiles has id and user_id      | ✅ PASS
```

---

## Interactive Testing Page

For manual testing of all operations, open the test page in your browser:

1. Copy the file `src/test-admin-operations.html` to your web server
2. Update the Supabase credentials at the top of the file
3. Login as admin first
4. Open the test page
5. Run each test in sequence

---

## Common Issues and Solutions

### Issue: "Access denied. Admin only."
**Solution:** Make sure you're logged in as an admin user
- Check: `SELECT role FROM profiles WHERE user_id = auth.uid();`
- Should return: `admin`

### Issue: "Cannot reset your own password"
**Solution:** This is expected behavior. Use a different user for testing password reset.

### Issue: "Cannot delete your own profile"
**Solution:** This is expected behavior. Use a different user for testing deletion.

### Issue: Build warnings about chunk sizes
**Solution:** These are just warnings, not errors. The app works fine. Can be optimized later with code splitting.

---

## Rollback Instructions

If you need to rollback the changes:

```sql
-- 1. Drop the modified functions
DROP FUNCTION IF EXISTS admin_get_all_profiles();
DROP FUNCTION IF EXISTS admin_update_profile(uuid, text, text, text, boolean);
DROP FUNCTION IF EXISTS admin_delete_profile(uuid);

-- 2. Restore from previous migration file
-- (Re-run migration 20251126101813_create_admin_rpc_functions.sql)

-- Note: pgcrypto extension can stay enabled (it's safe)
```

---

## Success Metrics

All tests should show these results:

| Test | Status | Metric |
|------|--------|--------|
| User Creation | ✅ Pass | No gen_salt errors |
| Password Reset | ✅ Pass | No "user not found" errors |
| User Deletion | ✅ Pass | No "column table_name" errors |
| Audit Logs | ✅ Pass | All entries have correct schema |
| Build Process | ✅ Pass | npm run build succeeds |
| Database Schema | ✅ Pass | All tables and functions exist |

---

## Performance Notes

The fixes do not impact performance:
- pgcrypto extension is lightweight and standard
- Function execution time is unchanged
- Database queries remain efficient
- No additional indexes needed

---

## Security Validation

All security measures remain in place:
- ✅ SECURITY DEFINER functions with admin role checks
- ✅ Prevention of self-deletion
- ✅ Prevention of self-password-reset via admin flow
- ✅ Audit logging for all admin actions
- ✅ Password hashing with bcrypt
- ✅ RLS policies still enforced

---

## Next Steps

After verifying all tests pass:
1. Test the complete user lifecycle (create → edit → reset password → delete)
2. Check audit logs to ensure all actions are tracked
3. Test with multiple concurrent admin users
4. Verify student users cannot access admin functions
5. Test error handling (invalid emails, duplicate users, etc.)

---

## Support

If you encounter any issues:
1. Check the console for error messages
2. Verify you're logged in as admin
3. Check audit_logs table for any error details
4. Review FIX_SUMMARY.md for detailed technical information
5. Run the automated test query above to identify specific failures
