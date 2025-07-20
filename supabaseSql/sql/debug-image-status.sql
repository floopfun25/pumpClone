-- Debug Image Status Script
-- Run this in your Supabase SQL Editor to investigate image issues

-- 1. Check if token-assets bucket exists and its configuration
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'token-assets';

-- 2. Check storage policies for token-assets bucket
SELECT 
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname ILIKE '%token%';

-- 3. Check recent tokens and their image data
SELECT 
  t.id,
  t.name,
  t.symbol,
  t.mint_address,
  t.image_url,
  t.metadata_uri,
  t.created_at,
  CASE 
    WHEN t.image_url IS NOT NULL AND t.image_url != '' THEN 
      CASE 
        WHEN t.image_url LIKE '%supabase%' THEN 'Supabase URL'
        WHEN t.image_url LIKE 'http%' THEN 'External URL'
        ELSE 'Other URL'
      END
    ELSE 'No Image URL'
  END as image_status
FROM tokens t
ORDER BY t.created_at DESC 
LIMIT 10;

-- 4. Check if there are any files in the token-assets bucket
SELECT 
  name,
  bucket_id,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'token-assets'
ORDER BY created_at DESC 
LIMIT 10;

-- 5. Count total objects in storage
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  MIN(created_at) as first_upload,
  MAX(created_at) as latest_upload
FROM storage.objects 
WHERE bucket_id = 'token-assets'
GROUP BY bucket_id;

-- 6. Check for authentication issues
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'Authenticated'
    ELSE 'Not Authenticated'
  END as auth_status; 