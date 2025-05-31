# FloppFun Phase 1 - Production Deployment Guide

## 🚀 Phase 1 Overview

Phase 1 focuses on making FloppFun production-ready with advanced charting, real-time price data, and enhanced infrastructure.

### ✅ Phase 1 Features Implemented

1. **Enhanced Environment Configuration**
   - Auto-detection of mainnet/devnet based on environment
   - Comprehensive RPC endpoint management
   - API key management for price data services
   - Production-ready configuration system

2. **Advanced Price Oracle System**
   - Real-time price feeds from CoinGecko and Birdeye
   - WebSocket-style price subscriptions
   - Comprehensive market data (price, volume, market cap, holders)
   - Price alerts and historical data tracking
   - Portfolio tracking and trending tokens

3. **Advanced Chart System**
   - TradingView-style price charts
   - Multiple timeframes (1H, 4H, 24H, 7D, 30D)
   - Real-time price updates
   - Interactive tooltips and controls
   - Volume indicators and market statistics
   - SVG-based rendering for performance

4. **Production Infrastructure**
   - Enhanced Supabase integration
   - Real-time market data storage
   - Optimized database queries
   - Error handling and fallback systems

## 🔧 Environment Setup

### 1. Environment Variables

Copy the `.env` file and configure for your environment:

```bash
# Production Environment
VITE_SOLANA_NETWORK=mainnet-beta

# Mainnet RPC (Use premium RPC for production)
VITE_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com
# Recommended premium providers:
# VITE_MAINNET_RPC_URL=https://solana-api.projectserum.com
# VITE_MAINNET_RPC_URL=https://rpc.ankr.com/solana

# Program Addresses (Update with your deployed programs)
VITE_MAINNET_BONDING_CURVE_PROGRAM=YOUR_PROGRAM_ID
VITE_MAINNET_TOKEN_FACTORY_PROGRAM=YOUR_PROGRAM_ID
VITE_MAINNET_FEE_COLLECTOR=YOUR_FEE_COLLECTOR

# Platform Wallets
VITE_MAINNET_FEE_WALLET=YOUR_FEE_WALLET
VITE_MAINNET_AUTHORITY=YOUR_AUTHORITY_WALLET
VITE_MAINNET_TREASURY=YOUR_TREASURY_WALLET

# API Keys
VITE_COINGECKO_API_KEY=your_coingecko_api_key
VITE_BIRDEYE_API_KEY=your_birdeye_api_key
```

### 2. Database Setup

Ensure your Supabase database has the required tables:

```sql
-- Token price history table for charts
CREATE TABLE token_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID REFERENCES tokens(id),
  price DECIMAL NOT NULL,
  volume DECIMAL DEFAULT 0,
  market_cap DECIMAL DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_token_price_history_token_timestamp 
ON token_price_history(token_id, timestamp DESC);

-- Real-time subscriptions
ALTER TABLE token_price_history ENABLE ROW LEVEL SECURITY;
```

## 🚀 Deployment Steps

### 1. Pre-deployment Checklist

- [ ] Update environment variables for production
- [ ] Deploy Solana programs to mainnet
- [ ] Configure premium RPC endpoints
- [ ] Set up API keys for price data services
- [ ] Configure database tables and indexes
- [ ] Test all functionality on devnet first

### 2. Build for Production

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### 3. Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# Or use CLI:
vercel env add VITE_SOLANA_NETWORK
vercel env add VITE_MAINNET_RPC_URL
# ... add all environment variables
```

### 4. Deploy to Netlify

```bash
# Build the project
npm run build

# Deploy dist folder to Netlify
# Or connect GitHub repository for automatic deployments
```

### 5. Deploy to GitHub Pages

The project includes GitHub Actions workflow for automatic deployment:

```yaml
# .github/workflows/deploy.yml is already configured
# Just push to main branch for automatic deployment
git push origin main
```

## 📊 Monitoring and Analytics

### 1. Performance Monitoring

- Monitor RPC endpoint response times
- Track price oracle API usage and rate limits
- Monitor Supabase database performance
- Set up alerts for critical errors

### 2. User Analytics

- Track chart interactions and timeframe usage
- Monitor trading volume and user engagement
- Analyze token creation and graduation rates

### 3. Financial Monitoring

- Track platform fees and revenue
- Monitor SOL price fluctuations
- Track token graduation success rates

## 🔒 Security Considerations

### 1. API Key Security

- Store API keys securely in environment variables
- Use rate limiting to prevent abuse
- Monitor API usage for unusual patterns

### 2. RPC Security

- Use premium RPC endpoints for production
- Implement request rate limiting
- Monitor for suspicious transaction patterns

### 3. Database Security

- Enable Row Level Security (RLS) on all tables
- Implement proper user authentication
- Regular security audits and updates

## 🐛 Troubleshooting

### Common Issues

1. **Chart not loading**
   - Check if token has price history data
   - Verify API keys are configured correctly
   - Check browser console for errors

2. **Price data not updating**
   - Verify Birdeye/CoinGecko API keys
   - Check rate limiting status
   - Ensure WebSocket connections are working

3. **Slow performance**
   - Optimize database queries
   - Use premium RPC endpoints
   - Enable caching for price data

### Debug Mode

Enable debug logging:

```bash
VITE_DEBUG=true
```

## 📈 Performance Optimization

### 1. Chart Performance

- SVG rendering for smooth animations
- Efficient data structures for large datasets
- Lazy loading for historical data
- Optimized re-rendering on updates

### 2. Price Data Optimization

- 30-second caching for price data
- Batch API requests where possible
- WebSocket connections for real-time updates
- Fallback mechanisms for API failures

### 3. Database Optimization

- Proper indexing on frequently queried columns
- Connection pooling for high traffic
- Query optimization for chart data
- Regular maintenance and cleanup

## 🔄 Maintenance

### Regular Tasks

1. **Weekly**
   - Monitor API usage and costs
   - Check error logs and fix issues
   - Update price data cache if needed

2. **Monthly**
   - Review and optimize database performance
   - Update dependencies and security patches
   - Analyze user feedback and feature requests

3. **Quarterly**
   - Security audit and penetration testing
   - Performance optimization review
   - Infrastructure cost optimization

## 📞 Support

For technical support and questions:

- Check the troubleshooting section above
- Review error logs in browser console
- Contact development team with specific error messages
- Provide environment details and reproduction steps

---

**Phase 1 Status**: ✅ **COMPLETE**

Next: [Phase 2 - Advanced Trading Features](./phase2-advanced-trading.md) 