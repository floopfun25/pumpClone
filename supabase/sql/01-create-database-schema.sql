-- FloppFun Database Schema
-- Run this script in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  twitter_handle TEXT,
  telegram_handle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE,
  total_volume_traded NUMERIC DEFAULT 0,
  tokens_created INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0
);

-- Create tokens table
CREATE TABLE IF NOT EXISTS public.tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mint_address TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  metadata_uri TEXT,
  creator_id UUID REFERENCES public.users(id),
  total_supply BIGINT NOT NULL DEFAULT 1000000000,
  decimals INTEGER NOT NULL DEFAULT 9,
  dev_share_percentage NUMERIC DEFAULT 0,
  dev_tokens_amount BIGINT DEFAULT 0,
  lock_duration_days INTEGER,
  locked_tokens_amount BIGINT DEFAULT 0,
  current_price NUMERIC DEFAULT 0,
  market_cap NUMERIC DEFAULT 0,
  volume_24h NUMERIC DEFAULT 0,
  holders_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'inactive')),
  graduation_threshold BIGINT DEFAULT 69000000000,
  graduated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  discord TEXT,
  last_trade_at TIMESTAMP WITH TIME ZONE,
  bonding_curve_progress NUMERIC DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  is_nsfw BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signature TEXT UNIQUE NOT NULL,
  token_id UUID REFERENCES public.tokens(id),
  user_id UUID REFERENCES public.users(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'create')),
  sol_amount BIGINT NOT NULL,
  token_amount BIGINT NOT NULL,
  price_per_token NUMERIC,
  bonding_curve_price NUMERIC,
  slippage_percentage NUMERIC,
  platform_fee BIGINT DEFAULT 0,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  block_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_holdings table
CREATE TABLE IF NOT EXISTS public.user_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  token_id UUID REFERENCES public.tokens(id),
  amount BIGINT NOT NULL DEFAULT 0,
  average_price NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token_id)
);

-- Create token_comments table
CREATE TABLE IF NOT EXISTS public.token_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID REFERENCES public.tokens(id),
  user_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES public.token_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- Create token_price_history table for charts
CREATE TABLE IF NOT EXISTS public.token_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID REFERENCES public.tokens(id),
  price NUMERIC NOT NULL,
  volume NUMERIC DEFAULT 0,
  market_cap NUMERIC DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table for DMs
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES public.users(id),
  user2_id UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

-- Create messages table for DMs
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id),
  sender_id UUID REFERENCES public.users(id),
  receiver_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tokens_creator_id ON public.tokens(creator_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON public.tokens(status);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON public.tokens(created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_market_cap ON public.tokens(market_cap);
CREATE INDEX IF NOT EXISTS idx_tokens_volume_24h ON public.tokens(volume_24h);

CREATE INDEX IF NOT EXISTS idx_transactions_token_id ON public.transactions(token_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_user_holdings_user_id ON public.user_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_holdings_token_id ON public.user_holdings(token_id);

CREATE INDEX IF NOT EXISTS idx_token_comments_token_id ON public.token_comments(token_id);
CREATE INDEX IF NOT EXISTS idx_token_comments_user_id ON public.token_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_token_price_history_token_id ON public.token_price_history(token_id);
CREATE INDEX IF NOT EXISTS idx_token_price_history_timestamp ON public.token_price_history(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON public.tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_holdings_updated_at BEFORE UPDATE ON public.user_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO public.users (id, wallet_address, username, is_verified, tokens_created)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', '11111111111111111111111111111111', 'demo_user', true, 0)
ON CONFLICT (wallet_address) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies for development
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

-- Create user token balances cache table for persistent balance storage
CREATE TABLE IF NOT EXISTS user_token_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_mint TEXT NOT NULL,
    balance DECIMAL(20,9) NOT NULL DEFAULT 0,
    decimals INTEGER NOT NULL DEFAULT 9,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_synced TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for user-token pairs
    UNIQUE(user_id, token_mint)
);

-- Create indexes for better performance on balance cache
CREATE INDEX IF NOT EXISTS idx_user_token_balances_user_id ON user_token_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_token_balances_token_mint ON user_token_balances(token_mint);
CREATE INDEX IF NOT EXISTS idx_user_token_balances_last_synced ON user_token_balances(last_synced);
CREATE INDEX IF NOT EXISTS idx_user_token_balances_is_stale ON user_token_balances(is_stale);

-- Create updated_at trigger for balance cache
CREATE OR REPLACE FUNCTION update_user_token_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_user_token_balances_updated_at' 
        AND tgrelid = 'user_token_balances'::regclass
    ) THEN
        CREATE TRIGGER update_user_token_balances_updated_at
            BEFORE UPDATE ON user_token_balances
            FOR EACH ROW
            EXECUTE PROCEDURE update_user_token_balances_updated_at();
    END IF;
END $$;

-- Enable RLS on balance cache table
ALTER TABLE user_token_balances ENABLE ROW LEVEL SECURITY;

-- Balance cache policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_token_balances' 
        AND policyname = 'Users can only access their own token balances'
    ) THEN
        CREATE POLICY "Users can only access their own token balances" 
        ON user_token_balances FOR ALL 
        USING (auth.uid() = user_id);
    END IF;
END $$;

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
  RAISE NOTICE 'FloppFun database schema created successfully!';
  RAISE NOTICE 'Tables created: users, tokens, transactions, user_holdings, token_comments, comment_likes, token_price_history, conversations, messages, user_token_balances';
  RAISE NOTICE 'All RLS policies configured for development use';
  RAISE NOTICE 'Token balance caching system enabled!';
END $$; 