-- SQL Migrations for FloppFun Backend
-- These tables will be auto-created by Hibernate, but this file serves as reference

-- =====================================================
-- 1. TOKEN PRICE HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS token_prices (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    price DECIMAL(20, 10) NOT NULL,
    market_cap DECIMAL(20, 2),
    volume DECIMAL(20, 2),
    timestamp TIMESTAMP NOT NULL,
    CONSTRAINT idx_token_timestamp_unique UNIQUE (token_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_token_timestamp ON token_prices(token_id, timestamp DESC);

-- =====================================================
-- 2. TOKEN HOLDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS token_holders (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL,
    balance BIGINT NOT NULL,
    percentage DECIMAL(5, 2),
    first_acquired_at TIMESTAMP,
    last_updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_token_holder UNIQUE(token_id, wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_token_balance ON token_holders(token_id, balance DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tokens ON token_holders(wallet_address);

-- =====================================================
-- 3. COMMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_created ON comments(token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_comments ON comments(user_id, created_at DESC);

-- =====================================================
-- 4. COMMENT LIKES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_comment_like UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes ON comment_likes(comment_id);

-- =====================================================
-- 5. WATCHLIST TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_watchlist_entry UNIQUE(user_id, token_id)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist ON watchlist(user_id, created_at DESC);

-- =====================================================
-- 6. ADD COLUMNS TO EXISTING TOKENS TABLE
-- =====================================================
-- Add 24h statistics columns to tokens table
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS price_change_24h DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS volume_24h DECIMAL(20, 2) DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS holders_count INT DEFAULT 0;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('token_prices', 'token_holders', 'comments', 'comment_likes', 'watchlist');

-- Check token_prices structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'token_prices';
