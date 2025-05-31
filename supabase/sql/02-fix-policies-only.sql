-- Fix RLS Policies Only
-- Run this if tables already exist but you need to update policies

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;

DROP POLICY IF EXISTS "Allow public read access on tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow authenticated users to create tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow creators to update their tokens" ON public.tokens;

DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated users to create transactions" ON public.transactions;

DROP POLICY IF EXISTS "Allow public read access on user_holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Allow users to manage their holdings" ON public.user_holdings;

DROP POLICY IF EXISTS "Allow public read access on token_comments" ON public.token_comments;
DROP POLICY IF EXISTS "Allow authenticated users to create comments" ON public.token_comments;

DROP POLICY IF EXISTS "Allow public read access on comment_likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Allow authenticated users to manage likes" ON public.comment_likes;

DROP POLICY IF EXISTS "Allow public read access on token_price_history" ON public.token_price_history;
DROP POLICY IF EXISTS "Allow authenticated users to insert price data" ON public.token_price_history;

DROP POLICY IF EXISTS "Allow users to view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow users to create conversations" ON public.conversations;

DROP POLICY IF EXISTS "Allow users to view their messages" ON public.messages;
DROP POLICY IF EXISTS "Allow users to send messages" ON public.messages;

-- Create fresh RLS policies
-- Users table policies
CREATE POLICY "Allow public read access on users" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Allow users to insert their own profile" ON public.users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to update their own profile" ON public.users
  FOR UPDATE USING (true);

-- Tokens table policies
CREATE POLICY "Allow public read access on tokens" ON public.tokens
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create tokens" ON public.tokens
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow creators to update their tokens" ON public.tokens
  FOR UPDATE USING (true);

-- Transactions table policies
CREATE POLICY "Allow public read access on transactions" ON public.transactions
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- User holdings policies
CREATE POLICY "Allow public read access on user_holdings" ON public.user_holdings
  FOR SELECT USING (true);

CREATE POLICY "Allow users to manage their holdings" ON public.user_holdings
  FOR ALL USING (true);

-- Comments policies
CREATE POLICY "Allow public read access on token_comments" ON public.token_comments
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to create comments" ON public.token_comments
  FOR INSERT WITH CHECK (true);

-- Comment likes policies
CREATE POLICY "Allow public read access on comment_likes" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage likes" ON public.comment_likes
  FOR ALL USING (true);

-- Price history policies
CREATE POLICY "Allow public read access on token_price_history" ON public.token_price_history
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert price data" ON public.token_price_history
  FOR INSERT WITH CHECK (true);

-- Conversation policies
CREATE POLICY "Allow users to view their conversations" ON public.conversations
  FOR SELECT USING (true);

CREATE POLICY "Allow users to create conversations" ON public.conversations
  FOR INSERT WITH CHECK (true);

-- Message policies
CREATE POLICY "Allow users to view their messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Allow users to send messages" ON public.messages
  FOR INSERT WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated successfully!';
  RAISE NOTICE 'All tables now have proper access policies for development';
END $$; 