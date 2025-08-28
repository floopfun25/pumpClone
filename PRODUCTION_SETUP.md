# FloppFun Production Setup Guide

## 🚨 CRITICAL: Required for Production

This guide outlines the essential steps to make FloppFun production-ready.

## 1. IPFS Configuration (REQUIRED)

**Current Issue**: IPFS uploads will fail without proper configuration, preventing token creation.

**Solution**: Configure either Pinata or Web3.Storage credentials:

### Option A: Pinata (Recommended)
1. Sign up at https://pinata.cloud
2. Generate API credentials
3. Add to your `.env` file:
```env
VITE_PINATA_API_KEY=your_pinata_api_key_here
VITE_PINATA_SECRET_KEY=your_pinata_secret_key_here
```

### Option B: Web3.Storage
1. Sign up at https://web3.storage
2. Generate API token
3. Add to your `.env` file:
```env
VITE_WEB3_STORAGE_TOKEN=your_web3_storage_token_here
```

## 2. Solana Network Configuration

For production deployment:

```env
# Switch to mainnet
VITE_SOLANA_NETWORK=mainnet

# Use reliable RPC endpoint
VITE_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com
# Or use a paid RPC service like Quicknode, Helius, etc.
```

## 3. Program Deployment

Deploy your bonding curve program to mainnet:

```bash
# Build the program
anchor build

# Deploy to mainnet (requires mainnet keypair with SOL)
anchor deploy --provider.cluster mainnet
```

Update your `.env` with the deployed program ID:
```env
VITE_MAINNET_BONDING_CURVE_PROGRAM=your_deployed_program_id_here
```

## 4. Platform Wallet Configuration

Set up secure platform wallets for mainnet:

```env
# IMPORTANT: Use secure, unique wallets for production
VITE_MAINNET_FEE_WALLET=your_secure_fee_wallet_here
VITE_MAINNET_AUTHORITY=your_secure_authority_wallet_here  
VITE_MAINNET_TREASURY=your_secure_treasury_wallet_here
```

## 5. Price Oracle Integration

The current implementation uses a fallback SOL price. For production:

1. Integrate with Jupiter Price API
2. Add fallback to Coingecko/Coinpaprika
3. Update the market cap calculation to use real-time SOL prices

## 6. Database Configuration

Ensure your Supabase database has:
- Proper indexes for performance
- Row Level Security properly configured
- Backup strategy implemented

## 7. Security Checklist

- [ ] IPFS credentials configured
- [ ] Secure platform wallets generated
- [ ] Program deployed and verified
- [ ] RLS policies tested
- [ ] Rate limiting implemented
- [ ] SSL/TLS configured
- [ ] Domain configured
- [ ] Monitoring setup

## 8. Testing Checklist

Before going live:
- [ ] Create test token on mainnet with small amount
- [ ] Verify IPFS metadata loads correctly
- [ ] Test buy/sell transactions
- [ ] Verify database integration
- [ ] Test wallet connection
- [ ] Verify bonding curve math
- [ ] Check fee collection

## Current Status

✅ **Working on mainnet:**
- Token creation (with IPFS configured)
- Bonding curve program
- Database integration
- Wallet connection
- Buy/sell transactions

⚠️ **Requires configuration:**
- IPFS credentials (critical)
- Production RPC endpoint
- Secure platform wallets
- Real-time price feeds

## Support

If you need help with production deployment, please refer to:
- Solana documentation: https://docs.solana.com
- Anchor documentation: https://www.anchor-lang.com
- Pinata documentation: https://docs.pinata.cloud