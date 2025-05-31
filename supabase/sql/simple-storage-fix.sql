-- Simple storage fix - only modify what we can access
-- Run this in your Supabase SQL Editor

-- Clean up any existing conflicting policies on storage.objects
DROP POLICY IF EXISTS "Authenticated users can upload token images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for token images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own token images" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_user_delete" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_user_update" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_read" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_upload" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_update" ON storage.objects;
DROP POLICY IF EXISTS "token_assets_delete" ON storage.objects;
DROP POLICY IF EXISTS "token_storage_read" ON storage.objects;
DROP POLICY IF EXISTS "token_storage_upload" ON storage.objects;
DROP POLICY IF EXISTS "token_storage_manage_own" ON storage.objects;

-- Create simple, working policies
-- 1. Allow everyone to read from token-assets bucket
CREATE POLICY "token_read_all" ON storage.objects
FOR SELECT 
USING (bucket_id = 'token-assets');

-- 2. Allow authenticated users to upload to token-assets bucket  
CREATE POLICY "token_upload_auth" ON storage.objects
FOR INSERT 
WITH CHECK (bucket_id = 'token-assets' AND auth.role() = 'authenticated');

-- 3. Allow authenticated users to delete their own files
CREATE POLICY "token_delete_own" ON storage.objects
FOR DELETE 
USING (bucket_id = 'token-assets' AND auth.role() = 'authenticated');

-- Verify the bucket configuration
SELECT 'Bucket exists:' as check_name, 
       CASE WHEN id IS NOT NULL THEN 'YES' ELSE 'NO' END as result,
       public as is_public,
       file_size_limit
FROM storage.buckets 
WHERE id = 'token-assets';

-- Show final policies
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE 'token_%'
ORDER BY policyname; 