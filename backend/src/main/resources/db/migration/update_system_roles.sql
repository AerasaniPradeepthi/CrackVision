-- =========================================================================
-- CrackVision â€” Safe System Roles Migration & Update Script
-- =========================================================================
-- This script safely updates existing users or allows database administrators
-- to set the designated roles without losing passwords, user IDs, or inspection records.
--
-- Supported roles: SITE_WORKER, SITE_ENGINEER, SITE_ADMIN, ADMIN, PROJECT_MANAGER
-- =========================================================================

-- 1. Assign Site Admin role to siteadmin@crackvision.com if the user exists
UPDATE users
SET role = 'SITE_ADMIN'
WHERE email = 'siteadmin@crackvision.com';

-- 2. Assign Site Engineer role to siteengineer@crackvision.com if the user exists
UPDATE users
SET role = 'SITE_ENGINEER'
WHERE email = 'siteengineer@crackvision.com';

-- 3. Assign Site Worker role to siteworker@crackvision.com if the user exists
UPDATE users
SET role = 'SITE_WORKER'
WHERE email = 'siteworker@crackvision.com';

-- 4. Promote siteengineer@gmail.com to SITE_ENGINEER if registered
UPDATE users
SET role = 'SITE_ENGINEER'
WHERE email = 'siteengineer@gmail.com';

-- Verify results
SELECT id, name, email, role, created_at FROM users
WHERE email IN (
    'siteadmin@crackvision.com',
    'siteengineer@crackvision.com',
    'siteworker@crackvision.com',
    'siteengineer@gmail.com'
);
