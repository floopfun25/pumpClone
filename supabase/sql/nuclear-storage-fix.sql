-- Nuclear option: Completely fix storage issues
-- Run this in your Supabase SQL Editor

-- First, check current authentication state
SELECT 'Current auth state:' as info, 
       auth.uid() as user_id, 
       auth.role() as role;

-- Drop ALL storage policies (nuclear approach)
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage') 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP; 
END $$;

-- Verify all policies are gone
SELECT 'Remaining policies:' as info, COUNT(*) as count
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Update bucket to ensure it's properly configured
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = '{"image/*","application/json"}'::jsonb
WHERE id = 'token-assets';

-- Create VERY permissive policies for testing
-- Policy 1: Allow EVERYONE to read (including anon)
CREATE POLICY "allow_all_read" ON storage.objects
FOR SELECT 
USING (bucket_id = 'token-assets');

-- Policy 2: Allow EVERYONE to upload (including anon for testing)
CREATE POLICY "allow_all_upload" ON storage.objects
FOR INSERT 
WITH CHECK (bucket_id = 'token-assets');

-- Policy 3: Allow EVERYONE to update (for testing)
CREATE POLICY "allow_all_update" ON storage.objects
FOR UPDATE 
USING (bucket_id = 'token-assets');

-- Policy 4: Allow EVERYONE to delete (for testing)
CREATE POLICY "allow_all_delete" ON storage.objects
FOR DELETE 
USING (bucket_id = 'token-assets');

-- Verify bucket is properly set up
SELECT 'Bucket config:' as info, id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets 
WHERE id = 'token-assets';

-- Verify new policies
SELECT 'New policies:' as info, policyname, roles, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;

-- Test bucket access with a direct query
SELECT 'Bucket accessible:' as info,
       CASE 
         WHEN EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'token-assets' AND public = true) 
         THEN 'YES' 
         ELSE 'NO' 
       END as accessible; 