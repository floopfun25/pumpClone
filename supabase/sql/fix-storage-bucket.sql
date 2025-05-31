-- Fix storage bucket issues for token-assets
-- Run this in your Supabase SQL Editor

-- First, let's check if the bucket exists and its current state
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'token-assets';

-- Check existing policies on storage.objects
SELECT policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Drop all existing storage policies to start fresh
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1khdkh_0" ON storage.objects;
DROP POLICY IF EXISTS "Give anon users access to images in folder 1khdkh_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1khdkh_0" ON storage.objects;

-- If bucket doesn't exist, create it (will fail silently if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'token-assets',
  'token-assets',
  true,
  5242880, -- 5MB
  '{"image/*","application/json"}'
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create comprehensive storage policies
-- Policy 1: Allow anyone to view all objects in token-assets bucket
CREATE POLICY "token_assets_public_read" ON storage.objects
FOR SELECT 
USING (bucket_id = 'token-assets');

-- Policy 2: Allow authenticated users to upload to token-assets bucket
CREATE POLICY "token_assets_authenticated_upload" ON storage.objects
FOR INSERT 
WITH CHECK (
  bucket_id = 'token-assets' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow users to update their own uploads (optional)
CREATE POLICY "token_assets_user_update" ON storage.objects
FOR UPDATE 
USING (
  bucket_id = 'token-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Allow users to delete their own uploads (optional)
CREATE POLICY "token_assets_user_delete" ON storage.objects
FOR DELETE 
USING (
  bucket_id = 'token-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Alternative: More permissive policies if the above don't work
-- Uncomment these if you're still having issues

-- CREATE POLICY "token_assets_allow_all_authenticated" ON storage.objects
-- FOR ALL
-- USING (bucket_id = 'token-assets' AND auth.role() = 'authenticated')
-- WITH CHECK (bucket_id = 'token-assets' AND auth.role() = 'authenticated');

-- Verify the setup
SELECT 'Bucket exists:' as check_type, EXISTS(
  SELECT 1 FROM storage.buckets WHERE id = 'token-assets'
) as result;

SELECT 'Policies created:' as check_type, COUNT(*) as result
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage' 
AND policyname LIKE 'token_assets_%';

-- Show final bucket configuration
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'token-assets';

-- Show all policies for storage.objects
SELECT policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname; 