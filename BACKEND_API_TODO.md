# Spring Boot Backend - Missing API Endpoints

This document lists all the API endpoints that need to be implemented in your Spring Boot backend to fully replace Supabase.

## ✅ Already Implemented

- `POST /api/auth/login` - Login with wallet signature
- `POST /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout
- `GET /api/tokens` - Get all tokens with pagination
- `GET /api/tokens/mint/{mintAddress}` - Get token by mint address
- `POST /api/tokens/create` - Create new token
- `GET /api/tokens/trending` - Get trending tokens
- `GET /api/tokens/search` - Search tokens
- `POST /api/trades/buy` - Buy tokens
- `POST /api/trades/sell` - Sell tokens
- `GET /api/trades/token/{tokenId}` - Get token transactions
- `GET /api/trades/user/{userId}` - Get user transactions
- `GET /api/users/wallet/{walletAddress}` - Get user by wallet
- `GET /api/users/me` - Get current user
- `PUT /api/users/profile` - Update user profile

## ⚠️ Missing - High Priority (Needed for Core Features)

### 1. Price History Tracking
```java
// Controller: TokenController.java
@GetMapping("/{tokenId}/price-history")
public ResponseEntity<List<PricePoint>> getTokenPriceHistory(
    @PathVariable Long tokenId,
    @RequestParam(defaultValue = "24h") String timeframe
) {
    // Return price history for charts
    // timeframe: 5m, 1h, 24h, 7d, 30d
}
```

**Database Schema:**
```sql
CREATE TABLE token_prices (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT REFERENCES tokens(id),
    price DECIMAL(20, 10) NOT NULL,
    market_cap DECIMAL(20, 2),
    volume DECIMAL(20, 2),
    timestamp TIMESTAMP NOT NULL,
    INDEX idx_token_timestamp (token_id, timestamp DESC)
);
```

### 2. Token Holders Tracking
```java
// Controller: TokenController.java
@GetMapping("/{tokenId}/holders")
public ResponseEntity<List<TokenHolder>> getTopHolders(
    @PathVariable Long tokenId,
    @RequestParam(defaultValue = "20") int limit
) {
    // Return top token holders
}

@GetMapping("/{tokenId}/holders/count")
public ResponseEntity<Integer> getHoldersCount(@PathVariable Long tokenId) {
    // Return total holders count
}
```

**Database Schema:**
```sql
CREATE TABLE token_holders (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT REFERENCES tokens(id),
    wallet_address VARCHAR(44) NOT NULL,
    balance BIGINT NOT NULL,
    percentage DECIMAL(5, 2),
    first_acquired_at TIMESTAMP,
    last_updated_at TIMESTAMP NOT NULL,
    UNIQUE(token_id, wallet_address),
    INDEX idx_token_balance (token_id, balance DESC)
);
```

### 3. Bonding Curve Progress
```java
// Controller: TokenController.java
@GetMapping("/{tokenId}/bonding-curve")
public ResponseEntity<BondingCurveProgress> getBondingCurveProgress(
    @PathVariable Long tokenId
) {
    // Return current bonding curve state
}
```

**Response:**
```json
{
  "progress": 65.5,
  "currentSol": 55.7,
  "targetSol": 85.0,
  "isGraduated": false
}
```

## ⚠️ Missing - Medium Priority (Enhances UX)

### 4. 24h Statistics
```java
// Add to existing Token entity
private BigDecimal priceChange24h;
private BigDecimal volume24h;
```

**Background Job:**
```java
@Scheduled(fixedRate = 60000) // Every minute
public void calculateDailyStats() {
    // Calculate price change and volume for last 24h
    // Update token records
}
```

### 5. Comments System
```java
// Controller: CommentController.java
@PostMapping("/tokens/{tokenId}/comments")
public ResponseEntity<Comment> createComment(
    @PathVariable Long tokenId,
    @RequestBody CreateCommentRequest request
) {}

@GetMapping("/tokens/{tokenId}/comments")
public ResponseEntity<Page<Comment>> getComments(
    @PathVariable Long tokenId,
    @RequestParam(defaultValue = "0") int page,
    @RequestParam(defaultValue = "20") int size
) {}

@PostMapping("/comments/{commentId}/like")
public ResponseEntity<Void> toggleLike(@PathVariable Long commentId) {}
```

**Database Schema:**
```sql
CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT REFERENCES tokens(id),
    user_id BIGINT REFERENCES users(id),
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    INDEX idx_token_created (token_id, created_at DESC)
);

CREATE TABLE comment_likes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT REFERENCES comments(id),
    user_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL,
    UNIQUE(comment_id, user_id)
);
```

### 6. Watchlist Feature
```java
// Controller: UserController.java
@GetMapping("/me/watchlist")
public ResponseEntity<List<Token>> getWatchlist() {}

@PostMapping("/me/watchlist/{tokenId}")
public ResponseEntity<Void> addToWatchlist(@PathVariable Long tokenId) {}

@DeleteMapping("/me/watchlist/{tokenId}")
public ResponseEntity<Void> removeFromWatchlist(@PathVariable Long tokenId) {}

@GetMapping("/me/watchlist/check/{tokenId}")
public ResponseEntity<Boolean> isInWatchlist(@PathVariable Long tokenId) {}
```

**Database Schema:**
```sql
CREATE TABLE watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    token_id BIGINT REFERENCES tokens(id),
    created_at TIMESTAMP NOT NULL,
    UNIQUE(user_id, token_id),
    INDEX idx_user_created (user_id, created_at DESC)
);
```

## ⚠️ Missing - Low Priority (Nice to Have)

### 7. Portfolio/Holdings Tracking
```java
// Controller: UserController.java
@GetMapping("/me/holdings")
public ResponseEntity<List<TokenHolding>> getUserHoldings() {
    // Get user's token holdings from blockchain
    // Calculate values and P&L
}
```

### 8. User Activity Feed
```java
@GetMapping("/users/{userId}/activity")
public ResponseEntity<List<Activity>> getUserActivity(
    @PathVariable Long userId,
    @RequestParam(defaultValue = "0") int page
) {}
```

### 9. Creator Tokens List
```java
@GetMapping("/users/{userId}/created-tokens")
public ResponseEntity<List<Token>> getCreatedTokens(
    @PathVariable Long userId
) {
    // Already have creatorId in tokens table
    // Just add this endpoint
}
```

### 10. King of the Hill
```java
@GetMapping("/tokens/king-of-the-hill")
public ResponseEntity<Token> getKingOfTheHillToken() {
    // Return token with highest market cap or volume
}
```

### 11. Market Statistics
```java
@GetMapping("/stats/market")
public ResponseEntity<MarketStats> getMarketStats() {}
```

**Response:**
```json
{
  "totalTokens": 1250,
  "totalVolume24h": 125000.50,
  "totalMarketCap": 5000000.00,
  "activeTraders24h": 450
}
```

### 12. Real-time Price Subscriptions (WebSocket)
```java
@MessageMapping("/subscribe/token/{tokenId}/price")
@SendTo("/topic/token/{tokenId}/price")
public PriceUpdate sendPriceUpdate() {}
```

## Implementation Priority

**Week 1 - Core Features:**
1. Price history tracking (needed for charts)
2. Token holders tracking (needed for token detail page)
3. Bonding curve progress (needed for token detail page)
4. 24h statistics (price change, volume)

**Week 2 - User Engagement:**
5. Comments system
6. Watchlist feature
7. Creator tokens list

**Week 3 - Advanced Features:**
8. Portfolio tracking
9. User activity feed
10. King of the Hill
11. Market statistics
12. WebSocket real-time updates

## Next Steps

1. Choose which features to implement first based on your priorities
2. I can help you write the Spring Boot code for any of these endpoints
3. Update the frontend to use the new endpoints as they're implemented
4. Test each feature as it's completed

Would you like me to start implementing any of these backend endpoints?
