-- Fix MIME type configuration for token-assets bucket
-- Run this in your Supabase SQL Editor

-- 1. Check current bucket configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'token-assets';

-- 2. Update bucket to have cleaner MIME type restrictions
-- Remove potential conflicts by setting a cleaner allowed_mime_types array
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif',
  'application/json'
]
WHERE id = 'token-assets';

-- 3. Verify the update
SELECT 
  id,
  name,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'token-assets';

-- 4. Check if there are any policy conflicts
SELECT 
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname ILIKE '%token%';

SELECT 'MIME type configuration updated successfully!' as status; 