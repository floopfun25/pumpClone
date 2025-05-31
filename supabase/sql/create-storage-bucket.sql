-- Create storage bucket for token assets
-- Run this in your Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'token-assets',
  'token-assets', 
  true,
  5242880, -- 5MB in bytes
  '{"image/*"}'
);

-- Create policy for public read access
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'token-assets');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'token-assets' 
  AND auth.role() = 'authenticated'
);

-- Create policy for users to update their own uploads
CREATE POLICY "Users can update own uploads" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'token-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for users to delete their own uploads  
CREATE POLICY "Users can delete own uploads" ON storage.objects
FOR DELETE USING (
  bucket_id = 'token-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
); 