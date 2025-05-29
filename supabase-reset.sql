-- FloppFun Database Reset & Setup
-- Run this in your Supabase SQL Editor to completely reset the database

-- Drop existing policies (if they exist)
DROP POLICY IF EXISTS "Allow public read access on users" ON users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;
DROP POLICY IF EXISTS "Allow public read access on tokens" ON tokens;
DROP POLICY IF EXISTS "Allow authenticated users to create tokens" ON tokens;
DROP POLICY IF EXISTS "Allow creators to update their tokens" ON tokens;
DROP POLICY IF EXISTS "Allow public read access on transactions" ON transactions;
DROP POLICY IF EXISTS "Allow authenticated users to create transactions" ON transactions;
DROP POLICY IF EXISTS "Allow users to read their holdings" ON user_holdings;
DROP POLICY IF EXISTS "Allow users to manage their holdings" ON user_holdings;
DROP POLICY IF EXISTS "Allow public read access on comments" ON comments;
DROP POLICY IF EXISTS "Allow authenticated users to create comments" ON comments;
DROP POLICY IF EXISTS "Allow users to update their own comments" ON comments;

-- Drop existing tables (if they exist)
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS user_holdings CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing functions (if they exist)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Now run the full setup
-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  twitter_handle TEXT,
  telegram_handle TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE,
  total_volume_traded BIGINT DEFAULT 0,
  tokens_created INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0
);

-- Create tokens table
CREATE TABLE tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mint_address TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  metadata_uri TEXT,
  creator_id UUID REFERENCES users(id),
  total_supply BIGINT NOT NULL DEFAULT 1000000000,
  decimals INTEGER DEFAULT 9,
  dev_share_percentage DECIMAL(5,2) DEFAULT 0.0,
  dev_tokens_amount BIGINT DEFAULT 0,
  lock_duration_days INTEGER,
  locked_tokens_amount BIGINT DEFAULT 0,
  current_price DECIMAL(20,10) DEFAULT 0,
  market_cap BIGINT DEFAULT 0,
  volume_24h BIGINT DEFAULT 0,
  holders_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'paused')),
  graduation_threshold BIGINT DEFAULT 69000000000,
  graduated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  website TEXT,
  twitter TEXT,
  telegram TEXT,
  discord TEXT,
  last_trade_at TIMESTAMP WITH TIME ZONE,
  bonding_curve_progress DECIMAL(5,2) DEFAULT 0.0,
  tags TEXT[] DEFAULT '{}',
  is_nsfw BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE
);

-- Create transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature TEXT UNIQUE NOT NULL,
  token_id UUID REFERENCES tokens(id),
  user_id UUID REFERENCES users(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'create')),
  sol_amount BIGINT NOT NULL,
  token_amount BIGINT NOT NULL,
  price_per_token DECIMAL(20,10),
  bonding_curve_price DECIMAL(20,10),
  slippage_percentage DECIMAL(5,2),
  platform_fee BIGINT DEFAULT 0,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  block_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_holdings table
CREATE TABLE user_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token_id UUID REFERENCES tokens(id),
  amount BIGINT NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(20,10),
  total_invested BIGINT DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token_id)
);

-- Create comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES tokens(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  parent_id UUID REFERENCES comments(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for better performance
CREATE INDEX idx_tokens_creator_id ON tokens(creator_id);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_tokens_created_at ON tokens(created_at);
CREATE INDEX idx_tokens_market_cap ON tokens(market_cap);
CREATE INDEX idx_tokens_volume_24h ON tokens(volume_24h);
CREATE INDEX idx_transactions_token_id ON transactions(token_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_user_holdings_user_id ON user_holdings(user_id);
CREATE INDEX idx_user_holdings_token_id ON user_holdings(token_id);
CREATE INDEX idx_comments_token_id ON comments(token_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access on users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow users to insert their own profile" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update their own profile" ON users FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on tokens" ON tokens FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to create tokens" ON tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow creators to update their tokens" ON tokens FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to create transactions" ON transactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to read their holdings" ON user_holdings FOR SELECT USING (true);
CREATE POLICY "Allow users to manage their holdings" ON user_holdings FOR ALL USING (true);

CREATE POLICY "Allow public read access on comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to create comments" ON comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to update their own comments" ON comments FOR UPDATE USING (true);

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON tokens 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_holdings_updated_at BEFORE UPDATE ON user_holdings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 