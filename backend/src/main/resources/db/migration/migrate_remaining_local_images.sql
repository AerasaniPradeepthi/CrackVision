-- ==============================================================================
-- CrackVision — Migration Script for Remaining 5 Local Inspection Images
-- Safe, audited migration script with dedicated backup table
--
-- Target records:
-- 1. (id = 1,  inspection_id = 1) -> crack.png
-- 2. (id = 6,  inspection_id = 1) -> WhatsApp Image 2026-10-13 at 9.55.22 PM.jpeg
-- 3. (id = 7,  inspection_id = 1) -> crack.png
-- 4. (id = 12, inspection_id = 4) -> WhatsApp Image 2026-10-13 at 9.55.22 PM.jpeg
-- 5. (id = 13, inspection_id = 5) -> pillar2.png
-- ==============================================================================

-- STEP 1: Verify current state of the 5 records before any modification
SELECT id, inspection_id, original_filename, stored_filename, storage_path 
FROM inspection_images 
WHERE id IN (1, 6, 7, 12, 13) 
ORDER BY id ASC;

-- STEP 2: Create a safe, isolated backup table for only these 5 records
CREATE TABLE IF NOT EXISTS inspection_images_backup_remaining_20261015 AS
SELECT * FROM inspection_images 
WHERE id IN (1, 6, 7, 12, 13);

-- STEP 3: Verify the backup table contains exactly 5 records
SELECT COUNT(*) AS verified_backup_count 
FROM inspection_images_backup_remaining_20261015;

-- STEP 4: Targeted UPDATE statements matching both id AND inspection_id
-- (Cloudinary URLs to be populated once files are uploaded to Cloudinary cloud 'dudhz46j')

-- Image ID #1 (crack.png, inspection 1)
-- UPDATE inspection_images
-- SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/crack1'
-- WHERE id = 1 AND inspection_id = 1;

-- Image ID #6 (WhatsApp Image..., inspection 1)
-- UPDATE inspection_images
-- SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/whatsapp_img_1'
-- WHERE id = 6 AND inspection_id = 1;

-- Image ID #7 (crack.png, inspection 1)
-- UPDATE inspection_images
-- SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/crack2'
-- WHERE id = 7 AND inspection_id = 1;

-- Image ID #12 (WhatsApp Image..., inspection 4)
-- UPDATE inspection_images
-- SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/whatsapp_img_4'
-- WHERE id = 12 AND inspection_id = 4;

-- Image ID #13 (pillar2.png, inspection 5)
-- UPDATE inspection_images
-- SET storage_path = 'https://res.cloudinary.com/dudhz46j/image/upload/f_auto,q_auto/pillar2'
-- WHERE id = 13 AND inspection_id = 5;

-- STEP 5: Verification query to confirm all updated rows begin with https://res.cloudinary.com/
-- SELECT id, inspection_id, original_filename, storage_path
-- FROM inspection_images
-- WHERE id IN (1, 6, 7, 12, 13)
--   AND storage_path LIKE 'https://res.cloudinary.com/%';
