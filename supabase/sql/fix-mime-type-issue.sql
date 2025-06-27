-- Fix MIME type restriction issue
-- Run this in your Supabase SQL Editor

-- Update the bucket to remove MIME type restrictions that are causing conflicts
UPDATE storage.buckets 
SET allowed_mime_types = NULL
WHERE id = 'token-assets';

-- Alternatively, if you want to keep restrictions but fix the conflict, use this instead:
-- UPDATE storage.buckets 
-- SET allowed_mime_types = '["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "application/json"]'
-- WHERE id = 'token-assets';

-- Verify the change
SELECT 'Updated bucket configuration:' as info, 
       id, name, public, file_size_limit, 
       allowed_mime_types::text as mime_types
FROM storage.buckets 
WHERE id = 'token-assets'; 