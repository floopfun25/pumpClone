-- Secure RLS Policies for FloppFun
-- Replaces permissive policies with proper user authorization

-- Drop all existing policies (comprehensive cleanup)
-- Drop users table policies
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view public profiles" ON public.users;
DROP POLICY IF EXISTS "Users can only create their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can only update their own profile" ON public.users;

-- Drop tokens table policies
DROP POLICY IF EXISTS "Allow public read access on tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow authenticated users to create tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow creators to update their tokens" ON public.tokens;
DROP POLICY IF EXISTS "Anyone can view tokens" ON public.tokens;
DROP POLICY IF EXISTS "Authenticated users can create tokens as themselves" ON public.tokens;
DROP POLICY IF EXISTS "Creators can update their own tokens" ON public.tokens;

-- Drop transactions table policies
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated users to create transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;

-- Drop user_holdings table policies
DROP POLICY IF EXISTS "Allow public read access on user_holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Allow users to manage their holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can manage their own holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can update their own holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Users can delete their own holdings" ON public.user_holdings;

-- Drop token_comments table policies
DROP POLICY IF EXISTS "Allow public read access on token_comments" ON public.token_comments;
DROP POLICY IF EXISTS "Allow authenticated users to create comments" ON public.token_comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON public.token_comments;
DROP POLICY IF EXISTS "Authenticated users can create their own comments" ON public.token_comments;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.token_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.token_comments;

-- Drop comment_likes table policies
DROP POLICY IF EXISTS "Allow public read access on comment_likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Allow authenticated users to manage likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Anyone can view comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can manage their own likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.comment_likes;

-- Drop token_price_history table policies
DROP POLICY IF EXISTS "Allow public read access on token_price_history" ON public.token_price_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert price data" ON public.token_price_history;
DROP POLICY IF EXISTS "Anyone can view price history" ON public.token_price_history;
DROP POLICY IF EXISTS "Service role can insert price data" ON public.token_price_history;
DROP POLICY IF EXISTS "Authenticated users can insert price data" ON public.token_price_history;

-- Drop conversations table policies
DROP POLICY IF EXISTS "Allow users to view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow users to create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Drop messages table policies
DROP POLICY IF EXISTS "Allow users to view their messages" ON public.messages;
DROP POLICY IF EXISTS "Allow users to send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send their own messages" ON public.messages;

-- Drop watchlist policies
DROP POLICY IF EXISTS "Users can view their own watchlist" ON public.user_watchlist;
DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.user_watchlist;

-- SECURE USERS TABLE POLICIES
-- Users can view public profile information
CREATE POLICY "Users can view public profiles" ON public.users
  FOR SELECT USING (true);

-- Users can only insert their own profile with matching auth.uid()
CREATE POLICY "Users can only create their own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can only update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- SECURE TOKENS TABLE POLICIES
-- Anyone can view token information (public marketplace)
CREATE POLICY "Anyone can view tokens" ON public.tokens
  FOR SELECT USING (true);

-- Only authenticated users can create tokens as themselves
CREATE POLICY "Authenticated users can create tokens as themselves" ON public.tokens
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = creator_id
  );

-- Only token creators can update their own tokens
CREATE POLICY "Creators can update their own tokens" ON public.tokens
  FOR UPDATE USING (auth.uid() = creator_id);

-- SECURE TRANSACTIONS TABLE POLICIES
-- Users can view all transactions (public trading data)
CREATE POLICY "Anyone can view transactions" ON public.transactions
  FOR SELECT USING (true);

-- Users can only create transactions for themselves
CREATE POLICY "Users can create their own transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- SECURE USER HOLDINGS POLICIES
-- Users can only view their own holdings.
CREATE POLICY "Users can view their own holdings" ON public.user_holdings
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own holdings.
CREATE POLICY "Users can insert their own holdings" ON public.user_holdings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own holdings.
CREATE POLICY "Users can update their own holdings" ON public.user_holdings
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own holdings.
CREATE POLICY "Users can delete their own holdings" ON public.user_holdings
  FOR DELETE USING (auth.uid() = user_id);

-- SECURE COMMENTS POLICIES
-- Anyone can view comments (public discussion)
CREATE POLICY "Anyone can view comments" ON public.token_comments
  FOR SELECT USING (true);

-- Only authenticated users can create comments as themselves
CREATE POLICY "Authenticated users can create their own comments" ON public.token_comments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

-- Users can only update/delete their own comments
CREATE POLICY "Users can manage their own comments" ON public.token_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.token_comments
  FOR DELETE USING (auth.uid() = user_id);

-- SECURE COMMENT LIKES POLICIES
-- Anyone can view likes (public engagement data)
CREATE POLICY "Anyone can view comment likes" ON public.comment_likes
  FOR SELECT USING (true);

-- Users can only create/delete their own likes
CREATE POLICY "Users can manage their own likes" ON public.comment_likes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = user_id
  );

CREATE POLICY "Users can delete their own likes" ON public.comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- SECURE PRICE HISTORY POLICIES
-- Anyone can view price history (public market data)
CREATE POLICY "Anyone can view price history" ON public.token_price_history
  FOR SELECT USING (true);

-- Authenticated users can insert price data after a trade
CREATE POLICY "Authenticated users can insert price data" ON public.token_price_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SECURE CONVERSATIONS POLICIES
-- Users can only view conversations they participate in
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Users can create conversations with others
CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    (auth.uid() = user1_id OR auth.uid() = user2_id)
  );

-- SECURE MESSAGES POLICIES
-- Users can only view messages in their conversations
CREATE POLICY "Users can view their messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Users can only send messages as themselves
CREATE POLICY "Users can send their own messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    auth.uid() = sender_id
  );

-- SECURE WATCHLIST POLICIES (only if table exists)
DO $$
BEGIN
  -- Check if user_watchlist table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_watchlist') THEN
    -- Create watchlist policies
    EXECUTE 'CREATE POLICY "Users can view their own watchlist" ON public.user_watchlist FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can manage their own watchlist" ON public.user_watchlist FOR ALL USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)';
    RAISE NOTICE 'Watchlist table policies created successfully';
  ELSE
    RAISE NOTICE 'Watchlist table does not exist, skipping watchlist policies';
  END IF;
END $$;

-- Grant permissions with restrictions
-- Remove overly permissive grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Grant only necessary permissions
-- Anonymous users can only read public data
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.tokens TO anon;
GRANT SELECT ON public.transactions TO anon;
GRANT SELECT ON public.token_comments TO anon;
GRANT SELECT ON public.comment_likes TO anon;
GRANT SELECT ON public.token_price_history TO anon;

-- Authenticated users get CRUD on their own data (controlled by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_holdings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated;
GRANT SELECT ON public.token_price_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;

-- Grant watchlist permissions only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_watchlist') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_watchlist TO authenticated;
    RAISE NOTICE 'Watchlist table permissions granted';
  END IF;
END $$;

-- Service role retains full access for system operations
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Secure RLS policies have been implemented!';
  RAISE NOTICE 'Key security improvements:';
  RAISE NOTICE '- Users can only modify their own data';
  RAISE NOTICE '- Proper authentication checks on all operations';
  RAISE NOTICE '- Restricted permissions for anonymous users';
  RAISE NOTICE '- Service role access for system operations';
END $$; 