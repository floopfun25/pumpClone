-- Clean up corrupted image files from Supabase Storage
-- Run this in your Supabase SQL Editor

-- 1. Find recent tokens with image URLs that might be corrupted
SELECT 
  t.id,
  t.name,
  t.symbol,
  t.mint_address,
  t.image_url,
  t.created_at,
  o.name as storage_file_name,
  o.created_at as file_created_at,
  o.metadata
FROM tokens t
LEFT JOIN storage.objects o ON t.image_url LIKE '%' || o.name || '%'
WHERE t.image_url IS NOT NULL 
  AND t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC;

-- 2. Check for files that might be corrupted (look for unusual metadata)
SELECT 
  name,
  bucket_id,
  created_at,
  updated_at,
  metadata,
  LENGTH(metadata::text) as metadata_size
FROM storage.objects 
WHERE bucket_id = 'token-assets'
  AND created_at > NOW() - INTERVAL '24 hours'
  AND (
    metadata IS NULL 
    OR metadata::text LIKE '%form-data%'
    OR metadata::text LIKE '%boundary%'
  )
ORDER BY created_at DESC;

-- 3. Optional: Delete specific corrupted file (uncomment to use)
-- DELETE FROM storage.objects 
-- WHERE bucket_id = 'token-assets' 
--   AND name = 'token-images/1751042743554-9xoyhn.png';

-- 4. Optional: Clear image_url for tokens with corrupted images (uncomment to use)
-- UPDATE tokens 
-- SET image_url = NULL
-- WHERE image_url LIKE '%1751042743554-9xoyhn.png%';

-- 5. Show summary of storage bucket health
SELECT 
  bucket_id,
  COUNT(*) as total_files,
  COUNT(CASE WHEN metadata IS NULL THEN 1 END) as files_without_metadata,
  COUNT(CASE WHEN metadata::text LIKE '%form-data%' THEN 1 END) as potentially_corrupted,
  MIN(created_at) as oldest_file,
  MAX(created_at) as newest_file
FROM storage.objects 
WHERE bucket_id = 'token-assets'
GROUP BY bucket_id;

SELECT 'Corrupted image cleanup analysis complete!' as status; 