# Birdeye API Integration Setup Guide

This guide will help you integrate real token price data using the Birdeye Data Services (BDS) API.

## Overview

Currently, the application uses mock data for token prices. To get real-time price data for Solana tokens, you need to set up a Birdeye API key.

## Step 1: Create Birdeye Data Services Account

1. **Sign up for BDS**: Go to [https://bds.birdeye.so/auth/sign-up](https://bds.birdeye.so/auth/sign-up)
2. **Fill out the form**: Enter your email, password, and other required information
3. **Verify your email**: Check your email for verification link and click it
4. **Complete account setup**: Follow any additional setup steps

## Step 2: Get Your API Key

1. **Login to BDS**: Go to [https://bds.birdeye.so/auth/sign-in](https://bds.birdeye.so/auth/sign-in)
2. **Access Dashboard**: You should see your main dashboard
3. **Go to Security Tab**: Look for a "Security" section or tab in the navigation
4. **Generate API Key**: 
   - Click "Generate API Key" or similar button
   - You may need to configure permissions (select all for full access)
   - Add a name/description for the key (e.g., "PumpClone Development")
5. **Copy the Key**: Once generated, copy the API key immediately and store it securely

## Step 3: Configure Environment Variables

1. **Create Environment File**: In your project root, create a file named `.env.local`:

```bash
# Birdeye Data Services API Key
VITE_BIRDEYE_API_KEY=your_actual_api_key_here

# Development Environment
NODE_ENV=development
```

2. **Replace the placeholder**: Replace `your_actual_api_key_here` with your actual API key from step 2

3. **Save the file**: Make sure the file is saved as `.env.local` (not `.env.local.txt`)

## Step 4: Restart Development Server

```bash
# Stop your current dev server (Ctrl+C)
# Then restart it
npm run dev
# or
yarn dev
```

## Step 5: Verify Integration

1. **Open the application** in your browser
2. **Go to any token page**
3. **Check the browser console** (F12 → Console tab)
4. **Look for success indicators**:
   - No more "401 Unauthorized" errors
   - Real price data should be displayed
   - Charts should show actual market data

## Pricing Information

### Free Tier
Birdeye typically offers a free tier with:
- Limited API calls per month
- Basic price data access
- Standard rate limits

### Paid Plans
For production applications, you may need:
- Higher rate limits
- More data points
- Advanced features
- Better support

Check [Birdeye's pricing page](https://docs.birdeye.so/docs/pricing) for current plans.

## API Features Available

With a valid API key, you'll get access to:

### ✅ Real Token Prices
- Live SOL token prices
- 24h price changes
- Market cap data
- Volume information

### ✅ Historical Data
- Price history for charts
- OHLCV candle data
- Multiple timeframes

### ✅ Token Information
- Token names and symbols
- Contract addresses
- Trading pairs

## Troubleshooting

### Still Getting 401 Errors?
1. **Check API key**: Make sure it's copied correctly with no extra spaces
2. **Verify file name**: Ensure your file is `.env.local` not `.env`
3. **Restart server**: Stop and restart your development server
4. **Check account**: Make sure your Birdeye account is active

### API Key Not Working?
1. **Check permissions**: Ensure your API key has the right permissions
2. **Verify expiration**: Some API keys may have expiration dates
3. **Contact support**: Reach out to Birdeye support if issues persist

### Environment Variable Not Loading?
1. **Check file location**: `.env.local` should be in your project root
2. **Verify prefix**: Make sure you're using `VITE_` prefix
3. **Check syntax**: No spaces around the `=` sign
4. **Case sensitive**: Variable names are case-sensitive

## Example `.env.local` File

```bash
# Birdeye API Configuration
VITE_BIRDEYE_API_KEY=bds_1234567890abcdef1234567890abcdef

# Optional: Other environment variables
NODE_ENV=development
VITE_APP_NAME=PumpClone
```

## Security Notes

- **Never commit API keys**: The `.env.local` file is git-ignored for security
- **Use environment-specific keys**: Different keys for development/production
- **Rotate keys regularly**: Generate new keys periodically for security
- **Monitor usage**: Keep an eye on your API usage to avoid unexpected charges

## Alternative APIs

If Birdeye doesn't work for you, consider these alternatives:

1. **Jupiter API**: For Solana token prices and swaps
2. **CoinGecko API**: For general cryptocurrency prices
3. **DexScreener API**: For DEX-specific price data
4. **Moralis API**: For Web3 data including token prices

## Support

If you need help:
1. **Birdeye Documentation**: [https://docs.birdeye.so](https://docs.birdeye.so)
2. **Birdeye Support**: Contact through their dashboard
3. **Community**: Check Discord or Telegram for community support

---

**Note**: This setup enables real price data. Without it, the application will continue to work with simulated/mock data, which is perfect for development and testing. 