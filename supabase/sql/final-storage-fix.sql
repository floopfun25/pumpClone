-- Final storage fix for authenticated users
-- Run this in your Supabase SQL Editor

-- Clean up any existing conflicting policies
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
DROP POLICY IF EXISTS "token_read_all" ON storage.objects;
DROP POLICY IF EXISTS "token_upload_auth" ON storage.objects;
DROP POLICY IF EXISTS "token_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "token_upload_anon" ON storage.objects;
DROP POLICY IF EXISTS "token_delete_anon" ON storage.objects;

-- Create final, clean policies for authenticated users
-- 1. Allow everyone to read (public access to view images)
CREATE POLICY "floppfun_public_read" ON storage.objects
FOR SELECT 
TO anon, authenticated
USING (bucket_id = 'token-assets');

-- 2. Allow authenticated users to upload (our Supabase auth integration)
CREATE POLICY "floppfun_auth_upload" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'token-assets');

-- 3. Allow authenticated users to update their own files
CREATE POLICY "floppfun_auth_update" ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'token-assets');

-- 4. Allow authenticated users to delete their own files
CREATE POLICY "floppfun_auth_delete" ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'token-assets');

-- Verify the bucket exists and is properly configured
SELECT 'Bucket status:' as info, 
       id, name, public, file_size_limit, 
       allowed_mime_types::text as mime_types
FROM storage.buckets 
WHERE id = 'token-assets';

-- Show final clean policies
SELECT 'Final policies:' as info, 
       policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE 'floppfun_%'
ORDER BY cmd, policyname; 