-- Add token balance cache system to existing database
-- Run this script in your Supabase SQL Editor

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

-- Create updated_at trigger function for balance cache
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

-- Create balance cache policy only if it doesn't exist
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

-- Grant permissions on the new table
GRANT ALL ON user_token_balances TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_token_balances TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Token balance caching system added successfully!';
  RAISE NOTICE '📊 Table created: user_token_balances';
  RAISE NOTICE '🔐 RLS policies configured';
  RAISE NOTICE '🚀 Balance persistence is now enabled!';
END $$;