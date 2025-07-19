-- Fix portfolio_snapshots RLS policy
-- The current policy is too complex and failing with 403 errors
-- This simplifies it to direct auth.uid() checking

-- Drop the existing complex policy
DROP POLICY IF EXISTS "Allow user to read, insert, or update their own snapshots" ON public.portfolio_snapshots;

-- Create a simple, direct policy that uses auth.uid()
CREATE POLICY "Users can manage their own portfolio snapshots" ON public.portfolio_snapshots
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Ensure proper permissions are granted
GRANT ALL ON public.portfolio_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_snapshots TO authenticated;

-- Verify the table has RLS enabled
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Check the policy was created correctly
SELECT 'Portfolio snapshots RLS policy fixed!' as status;
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'portfolio_snapshots' AND schemaname = 'public'; 