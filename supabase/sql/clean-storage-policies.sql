-- Clean up conflicting storage policies and create correct ones
-- Run this in your Supabase SQL Editor

-- Remove ALL existing storage policies to start completely fresh
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

-- Also remove any other potential conflicts
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

-- Create fresh, correct policies with proper roles
-- Policy 1: Public read access (anon + authenticated users)
CREATE POLICY "token_assets_read" ON storage.objects
FOR SELECT 
TO anon, authenticated
USING (bucket_id = 'token-assets');

-- Policy 2: Authenticated upload (only authenticated users)
CREATE POLICY "token_assets_upload" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'token-assets');

-- Policy 3: Users can update their own files (optional)
CREATE POLICY "token_assets_update" ON storage.objects
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'token-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can delete their own files (optional)
CREATE POLICY "token_assets_delete" ON storage.objects
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'token-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Verify: Show only policies for token-assets bucket
SELECT 
  policyname, 
  roles, 
  cmd,
  CASE 
    WHEN qual IS NULL THEN 'No conditions'
    ELSE qual::text
  END as conditions
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND (qual IS NULL OR qual::text LIKE '%token-assets%')
ORDER BY cmd, policyname;

-- Verify bucket exists and is properly configured
SELECT 
  id, 
  name, 
  public, 
  file_size_limit,
  allowed_mime_types::text as mime_types
FROM storage.buckets 
WHERE id = 'token-assets'; 