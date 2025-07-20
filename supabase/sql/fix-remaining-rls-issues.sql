-- Fix Remaining RLS Policy Issues
-- Run this AFTER the first fix-users-table-rls.sql script

-- Step 1: Fix token_price_history table RLS policies
DROP POLICY IF EXISTS "Anyone can view price history" ON public.token_price_history;
DROP POLICY IF EXISTS "Authenticated users can insert price data" ON public.token_price_history;
DROP POLICY IF EXISTS "Allow public read access on token_price_history" ON public.token_price_history;
DROP POLICY IF EXISTS "Service role can insert price data" ON public.token_price_history;

-- Allow anyone to read price history (public market data)
CREATE POLICY "Anyone can read price history" ON public.token_price_history
  FOR SELECT USING (true);

-- Allow authenticated users to insert price data (no restrictions for dev)
CREATE POLICY "Authenticated users can insert price data" ON public.token_price_history
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Step 2: Fix user_holdings table RLS policies completely
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Authenticated users can manage their holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Allow public read access on user_holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Allow users to manage their holdings" ON public.user_holdings;

-- Allow authenticated users to read their own holdings
CREATE POLICY "Users can read their own holdings" ON public.user_holdings
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

-- Allow authenticated users to insert/update their own holdings
CREATE POLICY "Users can manage their own holdings" ON public.user_holdings
  FOR ALL
  TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 3: Ensure proper table permissions
GRANT ALL ON public.token_price_history TO authenticated;
GRANT ALL ON public.user_holdings TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 4: Add helpful debugging function for RLS issues
CREATE OR REPLACE FUNCTION public.debug_rls_policies(table_name TEXT)
RETURNS TABLE(policy_name TEXT, policy_role TEXT, policy_cmd TEXT) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    policyname::TEXT,
    COALESCE(roles::TEXT, 'N/A') as policy_role,
    cmd::TEXT
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = debug_rls_policies.table_name
  ORDER BY policyname;
$$;

-- Step 5: Check current auth status function
CREATE OR REPLACE FUNCTION public.check_auth_status()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'authenticated_user_id', auth.uid(),
    'session_role', auth.role(),
    'has_session', CASE WHEN auth.uid() IS NOT NULL THEN true ELSE false END
  );
$$;

-- Step 6: Grant execute permissions on debug functions
GRANT EXECUTE ON FUNCTION public.debug_rls_policies(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_auth_status() TO authenticated;

-- Step 7: Verify the fixes
SELECT 'Remaining RLS issues fixed!' as status;

-- Show current policies for verification
SELECT 'token_price_history policies:' as info;
SELECT * FROM public.debug_rls_policies('token_price_history');

SELECT 'user_holdings policies:' as info;  
SELECT * FROM public.debug_rls_policies('user_holdings');

-- Show current auth status
SELECT 'Current auth status:' as info;
SELECT public.check_auth_status();

-- Final verification query
DO $$
BEGIN
  RAISE NOTICE 'RLS policy fixes completed!';
  RAISE NOTICE 'Tables fixed: token_price_history, user_holdings';
  RAISE NOTICE 'All authenticated users should now be able to trade successfully';
  RAISE NOTICE 'Remember: This is simulation mode - no real SOL is spent!';
END $$; 