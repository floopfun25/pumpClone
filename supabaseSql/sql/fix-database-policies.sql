-- Fix database RLS policies to allow proper access
-- Run this in your Supabase SQL Editor

-- Enable RLS on main tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow public read access on tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow authenticated users to create tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow creators to update their tokens" ON public.tokens;

-- Create more permissive policies for development
-- Users table policies
CREATE POLICY "Allow public read access on users" ON public.users
FOR SELECT USING (true);

CREATE POLICY "Allow anyone to insert users" ON public.users
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to update their own profile" ON public.users
FOR UPDATE USING (true);

-- Tokens table policies  
CREATE POLICY "Allow public read access on tokens" ON public.tokens
FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create tokens" ON public.tokens
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anyone to update tokens" ON public.tokens
FOR UPDATE USING (true);

-- Check that policies are created
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'tokens')
ORDER BY tablename, policyname; 