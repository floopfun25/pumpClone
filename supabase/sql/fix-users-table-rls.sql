-- Fix Users Table RLS Policies for Trading
-- Run this in your Supabase SQL Editor to resolve the 406 error

-- Step 1: Ensure users table has RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing conflicting policies on users table
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view public profiles" ON public.users;
DROP POLICY IF EXISTS "Users can only create their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only update their own profile" ON public.users;

-- Step 3: Create proper RLS policies for users table
-- Allow anyone to read user profiles (for public display)
CREATE POLICY "Anyone can read user profiles" ON public.users
  FOR SELECT USING (true);

-- Allow authenticated users to read their own record by ID (CRITICAL for trading)
CREATE POLICY "Authenticated users can read their own record" ON public.users
  FOR SELECT 
  TO authenticated
  USING (id = auth.uid());

-- Allow authenticated users to insert their own profile
CREATE POLICY "Users can create their own profile" ON public.users
  FOR INSERT 
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Allow authenticated users to update their own profile  
CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE 
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Step 4: Create a function to auto-create user records for authenticated users
CREATE OR REPLACE FUNCTION public.ensure_user_exists()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record public.users;
    wallet_addr TEXT;
BEGIN
    -- Get the authenticated user's ID
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;
    
    -- Check if user record exists
    SELECT * INTO user_record 
    FROM public.users 
    WHERE id = auth.uid();
    
    -- If user doesn't exist, we need to get their wallet address from another source
    -- For now, we'll create a placeholder record
    IF user_record.id IS NULL THEN
        -- Try to get wallet address from session metadata
        wallet_addr := COALESCE(
            (auth.jwt() ->> 'wallet_address'),
            'pending_' || auth.uid()::text
        );
        
        -- Insert new user record
        INSERT INTO public.users (
            id,
            wallet_address,
            username,
            created_at
        ) VALUES (
            auth.uid(),
            wallet_addr,
            'user_' || substr(auth.uid()::text, 1, 8),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            updated_at = NOW()
        RETURNING * INTO user_record;
        
        RAISE NOTICE 'Created new user record for: %', auth.uid();
    END IF;
    
    RETURN user_record.id;
END;
$$;

-- Step 5: Create a function to safely get or create user by wallet
CREATE OR REPLACE FUNCTION public.get_or_create_user_by_wallet(wallet_address TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record public.users;
    new_user_id UUID;
BEGIN
    -- Check if user exists by wallet address
    SELECT * INTO user_record 
    FROM public.users 
    WHERE users.wallet_address = get_or_create_user_by_wallet.wallet_address;
    
    IF user_record.id IS NOT NULL THEN
        -- Update the ID to match the authenticated session if needed
        IF auth.uid() IS NOT NULL AND user_record.id != auth.uid() THEN
            UPDATE public.users 
            SET id = auth.uid(),
                updated_at = NOW()
            WHERE users.wallet_address = get_or_create_user_by_wallet.wallet_address;
            
            RETURN auth.uid();
        END IF;
        
        RETURN user_record.id;
    ELSE
        -- Create new user with session ID if authenticated, or generate new ID
        new_user_id := COALESCE(auth.uid(), gen_random_uuid());
        
        INSERT INTO public.users (
            id,
            wallet_address,
            username,
            created_at
        ) VALUES (
            new_user_id,
            get_or_create_user_by_wallet.wallet_address,
            'user_' || substr(get_or_create_user_by_wallet.wallet_address, 1, 8),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            wallet_address = get_or_create_user_by_wallet.wallet_address,
            updated_at = NOW()
        RETURNING id INTO new_user_id;
        
        RETURN new_user_id;
    END IF;
END;
$$;

-- Step 6: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.ensure_user_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_by_wallet(TEXT) TO authenticated;
GRANT ALL ON public.users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 7: Fix transactions and user_holdings policies to use the session user ID
-- Drop and recreate transactions policies
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated users to create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;

CREATE POLICY "Anyone can view transactions" ON public.transactions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create transactions" ON public.transactions
  FOR INSERT 
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix user_holdings policies  
DROP POLICY IF EXISTS "Allow public read access on user_holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Allow users to manage their holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can manage their own holdings" ON public.user_holdings;

CREATE POLICY "Users can view their own holdings" ON public.user_holdings
  FOR SELECT 
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can manage their holdings" ON public.user_holdings
  FOR ALL
  TO authenticated 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Step 8: Fix token_price_history policies
DROP POLICY IF EXISTS "Allow public read access on token_price_history" ON public.token_price_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert price data" ON public.token_price_history;
DROP POLICY IF EXISTS "Anyone can view price history" ON public.token_price_history;
DROP POLICY IF EXISTS "Service role can insert price data" ON public.token_price_history;

CREATE POLICY "Anyone can view price history" ON public.token_price_history
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert price data" ON public.token_price_history
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Step 9: Display current policies for verification
SELECT 'RLS policies fixed successfully!' as status;

SELECT 
    schemaname,
    tablename, 
    policyname,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'transactions', 'user_holdings', 'token_price_history')
ORDER BY tablename, policyname;

-- Step 10: Test the fix by attempting to get/create a user record
SELECT 'Testing user access...' as test_status;
DO $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        RAISE NOTICE 'Current authenticated user ID: %', auth.uid();
        PERFORM public.ensure_user_exists();
        RAISE NOTICE 'User record verified/created successfully';
    ELSE
        RAISE NOTICE 'No authenticated user - policies will work when user is authenticated';
    END IF;
END $$; 