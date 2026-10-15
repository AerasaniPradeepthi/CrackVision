-- =========================================================================
-- CrackVision - Inspection Images Cloudinary URL Migration & Verification Script
-- =========================================================================
-- PURPOSE:
-- Safely associates existing inspection images with public, accessible HTTPS
-- Cloudinary URLs to resolve HTTP 404 photo preview errors caused by Render's
-- ephemeral container filesystem restarts.
--
-- TARGET DATABASE: Aiven Cloud MySQL (defaultdb)
--
-- IMPORTANT SAFETY NOTICE:
-- 1. This script MUST NOT be executed automatically. Review each statement.
-- 2. All existing inspection records, AI analysis results, engineer reviews,
--    and timestamps are 100% PRESERVED.
-- 3. Targeted updates use strict, exact (id, inspection_id) pairs - NO broad LIKE updates.
-- 4. Does NOT drop any existing tables.
-- =========================================================================

-- STEP 1: CREATE A BACKUP OF AFFECTED ROWS BEFORE MODIFICATION
-- Creates a dedicated backup table for the 7 affected records.
-- Note: Does NOT drop existing tables. If this table already exists, MySQL will halt execution to protect prior backup data.
CREATE TABLE inspection_images_backup_20261014 (PRIMARY KEY (id)) AS
SELECT * FROM inspection_images
WHERE id IN (3, 4, 8, 9, 10, 11, 14);

-- Verify backup row count (Expect exactly 7 rows before proceeding):
SELECT COUNT(*) AS backed_up_rows FROM inspection_images_backup_20261014;


-- STEP 2: EXPAND COLUMN SIZE FOR FULL HTTPS CLOUDINARY URLS
-- Cloudinary URLs can exceed standard 255 characters. Expand storage_path to VARCHAR(1000).
ALTER TABLE inspection_images MODIFY COLUMN storage_path VARCHAR(1000) NOT NULL;


-- STEP 3: PRE-UPDATE VERIFICATION (SELECT PREVIEW)
-- Inspect current rows and filenames before updating:
SELECT id, inspection_id, original_filename, stored_filename, storage_path, created_at
FROM inspection_images
WHERE id IN (3, 4, 8, 9, 10, 11, 14)
ORDER BY id ASC;


-- STEP 4: EXACT TARGETED CLOUDINARY URL UPDATES
-- Each statement specifies both primary key 'id' AND foreign key 'inspection_id'.
-- All URL values are plain single-quoted HTTPS SQL string literals with no square brackets or parentheses.

-- 1. Image #3, Inspection #2 -> pillarcrack
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack'
WHERE id = 3 AND inspection_id = 2;

-- 2. Image #4, Inspection #1 -> beam
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/beam'
WHERE id = 4 AND inspection_id = 1;

-- 3. Image #8, Inspection #3 -> istockphoto-821516444-1024x1024
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-821516444-1024x1024'
WHERE id = 8 AND inspection_id = 3;

-- 4. Image #9, Inspection #4 -> istockphoto-693649778-170667a
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-693649778-170667a'
WHERE id = 9 AND inspection_id = 4;

-- 5. Image #10, Inspection #5 -> pillarcrack
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillarcrack'
WHERE id = 10 AND inspection_id = 5;

-- 6. Image #11, Inspection #3 -> istockphoto-821516444-1024x1024
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-821516444-1024x1024'
WHERE id = 11 AND inspection_id = 3;

-- 7. Image #14, Inspection #6 -> istockphoto-693649778-170667a
UPDATE inspection_images
SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/istockphoto-693649778-170667a'
WHERE id = 14 AND inspection_id = 6;


-- STEP 5: POST-UPDATE VERIFICATION & ROW COUNT CHECK
-- Verify all 7 records now point to trusted HTTPS Cloudinary URLs:
SELECT id, inspection_id, original_filename, storage_path
FROM inspection_images
WHERE id IN (3, 4, 8, 9, 10, 11, 14)
ORDER BY id ASC;

-- Confirm row count of updated Cloudinary records:
SELECT COUNT(*) AS total_updated_cloudinary_records
FROM inspection_images
WHERE storage_path LIKE 'https://res.cloudinary.com/%';


-- STEP 6: VERIFY AI ANALYSIS AND AUDIT TRAIL INTEGRITY
-- Confirm related AI analysis records remain intact and properly linked:
SELECT a.id AS analysis_id, a.inspection_id, a.image_id,
       a.crack_detected, a.screening_category, a.confidence,
       i.original_filename, i.storage_path
FROM ai_analysis_results a
JOIN inspection_images i ON a.image_id = i.id
WHERE i.id IN (3, 4, 8, 9, 10, 11, 14)
ORDER BY a.id ASC;

-- Confirm certified engineer reviews remain intact:
SELECT r.id AS review_id, r.analysis_id, r.decision, r.reviewed_at
FROM engineer_reviews r
JOIN ai_analysis_results a ON r.analysis_id = a.id
JOIN inspection_images i ON a.image_id = i.id
WHERE i.id IN (3, 4, 8, 9, 10, 11, 14)
ORDER BY r.id ASC;
