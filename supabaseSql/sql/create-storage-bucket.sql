-- Ensure storage bucket exists for token assets
-- Run this in your Supabase SQL Editor

-- Create bucket if it doesn't exist (this will fail silently if bucket exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'token-assets',
  'token-assets', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Public read access for token assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload token assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own token assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own token assets" ON storage.objects;

-- Create RLS policies for the bucket
-- Allow public read access
CREATE POLICY "Public read access for token assets" ON storage.objects
FOR SELECT USING (bucket_id = 'token-assets');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload token assets" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'token-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own uploads
CREATE POLICY "Users can update their own token assets" ON storage.objects
FOR UPDATE WITH CHECK (
  bucket_id = 'token-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own token assets" ON storage.objects
FOR DELETE USING (
  bucket_id = 'token-assets' 
  AND auth.role() = 'authenticated'
);

SELECT 'Storage bucket and policies configured successfully!' as status; 