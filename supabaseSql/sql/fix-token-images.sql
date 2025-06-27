-- Fix token images storage configuration
-- Run this in your Supabase SQL Editor

-- Ensure the token-assets bucket exists with correct configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'token-assets',
  'token-assets',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Public read access for token assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload token assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own token assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own token assets" ON storage.objects;

-- Create comprehensive storage policies
CREATE POLICY "token_assets_public_read" ON storage.objects
FOR SELECT 
TO anon, authenticated
USING (bucket_id = 'token-assets');

CREATE POLICY "token_assets_auth_upload" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'token-assets');

CREATE POLICY "token_assets_auth_update" ON storage.objects
FOR UPDATE 
TO authenticated
USING (bucket_id = 'token-assets');

CREATE POLICY "token_assets_auth_delete" ON storage.objects
FOR DELETE 
TO authenticated
USING (bucket_id = 'token-assets');

-- Check if we have any tokens with images in the database
SELECT 
  name, 
  symbol, 
  image_url,
  metadata_uri,
  CASE 
    WHEN image_url IS NOT NULL THEN 'Has image URL'
    WHEN metadata_uri IS NOT NULL THEN 'Has metadata URI'
    ELSE 'No image data'
  END as image_status
FROM tokens 
ORDER BY created_at DESC 
LIMIT 10;

SELECT 'Token images storage configured successfully!' as status; 