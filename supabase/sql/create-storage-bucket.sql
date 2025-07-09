-- Create storage bucket for token assets
-- This script is now safe to re-run.

-- Create the bucket if it doesn't exist.
-- Using a DO block to handle potential "duplicate key" errors if the bucket already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'token-assets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'token-assets',
      'token-assets', 
      true,
      5242880, -- 5MB in bytes
      '{"image/*"}'
    );
  END IF;
END $$;


-- Drop old policies to ensure a clean slate
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

-- Create fresh, correct policies

-- 1. Allow public read access for all images in the bucket.
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'token-assets');

-- 2. Allow any authenticated user to upload files.
-- The `owner` of the object will automatically be set to the uploader's auth.uid().
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'token-assets' AND
    auth.role() = 'authenticated'
  );

-- 3. Allow users to update their own files.
-- This compares the logged-in user's ID with the `owner` of the file.
CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'token-assets' AND
    auth.uid() = owner
  );

-- 4. Allow users to delete their own files.
CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'token-assets' AND
    auth.uid() = owner
  ); 