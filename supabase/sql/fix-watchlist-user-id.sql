-- Fix watchlist table to use Supabase auth user IDs
-- This resolves the 406 Not Acceptable error

-- Step 1: Drop the foreign key constraint that references the custom users table
ALTER TABLE public.user_watchlist 
DROP CONSTRAINT IF EXISTS user_watchlist_user_id_fkey;

-- Step 2: Update the user_id column to use auth.users UUID type (it should already be UUID)
-- This ensures compatibility with auth.uid()

-- Step 3: Update RLS policies to use auth.uid() properly
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.user_watchlist;
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.user_watchlist;
DROP POLICY IF EXISTS "allow_all_select" ON public.user_watchlist;
DROP POLICY IF EXISTS "allow_all_insert" ON public.user_watchlist;
DROP POLICY IF EXISTS "allow_all_update" ON public.user_watchlist;
DROP POLICY IF EXISTS "allow_all_delete" ON public.user_watchlist;

-- Create proper RLS policies that use auth.uid()
CREATE POLICY "Users can view their own watchlist" ON public.user_watchlist
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own watchlist" ON public.user_watchlist
  FOR ALL USING (user_id = auth.uid());

-- Step 4: Grant proper permissions
GRANT ALL ON public.user_watchlist TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 5: Verify the setup
SELECT 'Watchlist table configuration updated successfully!' as status;

-- Show current policies for verification
SELECT 'Current policies:' as info;
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_watchlist'; 