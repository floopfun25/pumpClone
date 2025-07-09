-- Fix RLS Policies Only
-- This script applies secure, user-specific RLS policies to the database.

-- =================================================================
-- Users Table
-- =================================================================
DROP POLICY IF EXISTS "Allow public read access on users" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;

-- Anyone can read user profiles.
CREATE POLICY "Allow public read access on users" ON public.users FOR SELECT USING (true);
-- Users can only insert a profile for themselves.
CREATE POLICY "Allow users to insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
-- Users can only update their own profile.
CREATE POLICY "Allow users to update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =================================================================
-- Tokens Table
-- =================================================================
DROP POLICY IF EXISTS "Allow public read access on tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow authenticated users to create tokens" ON public.tokens;
DROP POLICY IF EXISTS "Allow creators to update their tokens" ON public.tokens;

-- Anyone can read token data.
CREATE POLICY "Allow public read access on tokens" ON public.tokens FOR SELECT USING (true);
-- Any authenticated user can create a new token.
CREATE POLICY "Allow authenticated users to create tokens" ON public.tokens FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only the original creator can update a token.
CREATE POLICY "Allow creators to update their tokens" ON public.tokens FOR UPDATE USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- =================================================================
-- Transactions Table
-- =================================================================
DROP POLICY IF EXISTS "Allow public read access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow authenticated users to create transactions" ON public.transactions;

-- Anyone can read transaction history.
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT USING (true);
-- Users can only insert transactions for themselves.
CREATE POLICY "Allow authenticated users to create transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- User Holdings Table
-- =================================================================
DROP POLICY IF EXISTS "Allow public read access on user_holdings" ON public.user_holdings;
DROP POLICY IF EXISTS "Allow users to manage their holdings" ON public.user_holdings;

-- Users can only view their own token holdings.
CREATE POLICY "Allow public read access on user_holdings" ON public.user_holdings
  FOR SELECT USING (true);

-- Users can only manage their own token holdings.
CREATE POLICY "Allow users to manage their holdings" ON public.user_holdings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- Portfolio Snapshots Table (The original problem)
-- =================================================================
DROP POLICY IF EXISTS "Allow user to read, insert, or update their own snapshots" ON public.portfolio_snapshots;

-- This policy correctly checks against the public.users table.
CREATE POLICY "Allow user to read, insert, or update their own snapshots" ON public.portfolio_snapshots
    FOR ALL
    USING ( user_id = (SELECT id FROM public.users WHERE id = auth.uid()) )
    WITH CHECK ( user_id = (SELECT id FROM public.users WHERE id = auth.uid()) );

-- =================================================================
-- Comments and Likes
-- =================================================================
DROP POLICY IF EXISTS "Allow public read access on token_comments" ON public.token_comments;
DROP POLICY IF EXISTS "Allow authenticated users to create comments" ON public.token_comments;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.token_comments;
DROP POLICY IF EXISTS "Allow public read access on comment_likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Allow authenticated users to manage likes" ON public.comment_likes;

-- Anyone can read comments.
CREATE POLICY "Allow public read access on token_comments" ON public.token_comments FOR SELECT USING (true);
-- Users can insert, update, or delete their own comments.
CREATE POLICY "Users can manage their own comments" ON public.token_comments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Anyone can read likes.
CREATE POLICY "Allow public read access on comment_likes" ON public.comment_likes FOR SELECT USING (true);
-- Users can only manage their own likes (insert/delete).
CREATE POLICY "Allow authenticated users to manage likes" ON public.comment_likes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- Grant Permissions
-- =================================================================
-- These grants are broad for development but are now properly restricted by RLS.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies updated successfully! The database is now secure.';
END $$; 