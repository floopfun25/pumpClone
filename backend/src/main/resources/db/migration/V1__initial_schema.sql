-- FloppFun Initial Database Schema
-- This migration creates all tables for the pump.fun clone

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    twitter_handle VARCHAR(100),
    telegram_handle VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
    id BIGSERIAL PRIMARY KEY,
    mint_address VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    metadata_uri VARCHAR(500),
    creator_id BIGINT NOT NULL,
    total_supply BIGINT NOT NULL DEFAULT 1000000000000000,
    decimals INTEGER NOT NULL DEFAULT 6,
    current_price_sol BIGINT NOT NULL DEFAULT 0,
    market_cap_sol BIGINT NOT NULL DEFAULT 0,
    virtual_sol_reserves BIGINT NOT NULL DEFAULT 30000000000,
    virtual_token_reserves BIGINT NOT NULL DEFAULT 1073000000000000,
    real_sol_reserves BIGINT NOT NULL DEFAULT 0,
    real_token_reserves BIGINT NOT NULL DEFAULT 0,
    bonding_curve_progress DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_graduated BOOLEAN NOT NULL DEFAULT false,
    graduated_at TIMESTAMP,
    raydium_pool_address VARCHAR(255),
    total_transactions BIGINT NOT NULL DEFAULT 0,
    holder_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE INDEX idx_tokens_mint ON tokens(mint_address);
CREATE INDEX idx_tokens_creator ON tokens(creator_id);
CREATE INDEX idx_tokens_graduated ON tokens(is_graduated);
CREATE INDEX idx_tokens_created_at ON tokens(created_at DESC);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    signature VARCHAR(255) UNIQUE NOT NULL,
    token_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    transaction_type VARCHAR(20) NOT NULL, -- 'BUY' or 'SELL'
    sol_amount BIGINT NOT NULL,
    token_amount BIGINT NOT NULL,
    price_per_token BIGINT NOT NULL,
    total_value_sol BIGINT NOT NULL,
    blockchain_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_transactions_signature ON transactions(signature);
CREATE INDEX idx_transactions_token ON transactions(token_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- User holdings table
CREATE TABLE IF NOT EXISTS user_holdings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_id BIGINT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    average_buy_price BIGINT NOT NULL DEFAULT 0,
    total_invested_sol BIGINT NOT NULL DEFAULT 0,
    realized_profit_sol BIGINT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    UNIQUE(user_id, token_id)
);

CREATE INDEX idx_user_holdings_user ON user_holdings(user_id);
CREATE INDEX idx_user_holdings_token ON user_holdings(token_id);

-- Token holders table (for holder count tracking)
CREATE TABLE IF NOT EXISTS token_holders (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    percentage DECIMAL(10,6) NOT NULL DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    UNIQUE(token_id, wallet_address)
);

CREATE INDEX idx_token_holders_token ON token_holders(token_id);
CREATE INDEX idx_token_holders_wallet ON token_holders(wallet_address);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    likes_count INTEGER NOT NULL DEFAULT 0,
    parent_comment_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
);

CREATE INDEX idx_comments_token ON comments(token_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user ON comment_likes(user_id);

-- Token comments table (alternative comment structure)
CREATE TABLE IF NOT EXISTS token_comments (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_token_comments_token ON token_comments(token_id);
CREATE INDEX idx_token_comments_user ON token_comments(user_id);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlists (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    UNIQUE(user_id, token_id)
);

CREATE INDEX idx_watchlists_user ON watchlists(user_id);
CREATE INDEX idx_watchlists_token ON watchlists(token_id);

-- Price history table
CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL,
    price_sol BIGINT NOT NULL,
    market_cap_sol BIGINT NOT NULL,
    volume_24h_sol BIGINT NOT NULL DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id)
);

CREATE INDEX idx_price_history_token ON price_history(token_id);
CREATE INDEX idx_price_history_timestamp ON price_history(timestamp DESC);

-- Token price table (for caching current prices)
CREATE TABLE IF NOT EXISTS token_prices (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT NOT NULL,
    price_sol BIGINT NOT NULL,
    price_usd DECIMAL(20,8),
    market_cap_sol BIGINT NOT NULL,
    volume_24h BIGINT NOT NULL DEFAULT 0,
    price_change_24h DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    UNIQUE(token_id)
);

CREATE INDEX idx_token_prices_token ON token_prices(token_id);

-- Portfolio snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    total_value_sol BIGINT NOT NULL,
    total_invested_sol BIGINT NOT NULL,
    total_profit_sol BIGINT NOT NULL,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_portfolio_snapshots_user ON portfolio_snapshots(user_id);
CREATE INDEX idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date DESC);
