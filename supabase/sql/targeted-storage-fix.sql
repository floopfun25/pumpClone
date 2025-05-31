-- Targeted storage fix - focus on bucket visibility and proper auth
-- Run this in your Supabase SQL Editor

-- Check if RLS is enabled on storage.buckets (this might be the issue)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'buckets';

-- Check current policies on storage.buckets
SELECT 'Bucket policies:' as info, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'buckets' AND schemaname = 'storage';

-- Disable RLS on storage.buckets to allow bucket listing
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Verify the bucket exists and is public
SELECT 'Bucket status:' as info, id, name, public, file_size_limit
FROM storage.buckets 
WHERE id = 'token-assets';

-- Create clean, auth-based policies for storage.objects (not super permissive)
-- First, clean up existing ones
DROP POLICY IF EXISTS "allow_all_read" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_upload" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_update" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_delete" ON storage.objects;

-- Create proper policies
-- 1. Public read access for all users
CREATE POLICY "token_storage_read" ON storage.objects
FOR SELECT 
TO anon, authenticated
USING (bucket_id = 'token-assets');

-- 2. Authenticated users can upload
CREATE POLICY "token_storage_upload" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'token-assets');

-- 3. Users can manage their own files
CREATE POLICY "token_storage_manage_own" ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'token-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify final setup
SELECT 'Final bucket config:' as info, 
       id, name, public, file_size_limit, allowed_mime_types::text as mime_types
FROM storage.buckets 
WHERE id = 'token-assets';

SELECT 'Final policies:' as info, policyname, roles, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%token_storage%'
ORDER BY policyname; 