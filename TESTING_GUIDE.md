# 🧪 FloppFun Testing Guide

## Overview
This guide will walk you through testing all implemented features in FloppFun. Follow these steps to verify everything works correctly.

---

## 🏁 **Quick Start Testing**

### **Prerequisites**
1. **Development server running**: `npm run dev`
2. **Browser with wallet extension**: Phantom or Solflare installed
3. **Devnet SOL**: Get some devnet SOL for testing
4. **Network**: Ensure you're on Solana Devnet

### **Get Devnet SOL**
```bash
# Install Solana CLI (if not installed)
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

# Create a test wallet (or use existing)
solana-keygen new --outfile ~/.config/solana/test-wallet.json

# Get devnet SOL (run multiple times for more SOL)
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
```

---

## 📋 **Testing Checklist**

### **1️⃣ Basic Application Loading**
- [ ] **Open browser**: Navigate to `http://localhost:5173`
- [ ] **Homepage loads**: FloppFun homepage displays correctly
- [ ] **Navigation works**: All menu items are clickable
- [ ] **Dark mode toggle**: Test light/dark theme switching
- [ ] **Responsive design**: Test on different screen sizes

**✅ Expected Result**: Clean, modern interface loads without errors

---

### **2️⃣ Wallet Connection Testing**

#### **Test Phantom Wallet**
- [ ] **Connect button visible**: "Connect Wallet" button appears
- [ ] **Click connect**: Phantom popup appears
- [ ] **Approve connection**: Wallet connects successfully
- [ ] **Balance display**: SOL balance shows in header
- [ ] **Address display**: Wallet address appears (truncated)

#### **Test Solflare Wallet**
- [ ] **Disconnect Phantom**: Click disconnect
- [ ] **Connect Solflare**: Select Solflare from wallet menu
- [ ] **Connection works**: Solflare connects successfully

#### **Test Wallet Switching**
- [ ] **Switch between wallets**: Test multiple wallet connections
- [ ] **Auto-reconnection**: Refresh page, wallet reconnects
- [ ] **Disconnection**: Properly disconnects and clears state

**✅ Expected Result**: Seamless wallet connection experience

---

### **3️⃣ Price Oracle Testing**

#### **SOL Price Integration**
- [ ] **Live SOL price**: Check if real SOL price displays
- [ ] **Price format**: Price shows as $XXX.XX format
- [ ] **24h change**: Color-coded price change indicator
- [ ] **Console check**: No API errors in browser console

#### **Test Price Service**
```javascript
// Open browser console and test:
import { priceOracleService } from './src/services/priceOracle.ts'

// Test SOL price
const solPrice = await priceOracleService.getSOLPrice()
console.log('SOL Price:', solPrice)

// Test token price (use any Solana token mint)
const tokenPrice = await priceOracleService.getTokenPrice('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
console.log('Token Price:', tokenPrice)
```

**✅ Expected Result**: Real price data from CoinGecko/Birdeye APIs

---

### **4️⃣ Portfolio Testing**

#### **Portfolio Page Access**
- [ ] **Navigate to portfolio**: Click "Portfolio" in navigation
- [ ] **Wallet connection check**: Redirects to connect wallet if disconnected
- [ ] **Loading state**: Shows loading spinner while fetching data

#### **Portfolio Data Display**
- [ ] **SOL balance**: Real SOL balance displays correctly
- [ ] **USD value**: SOL balance converted to USD
- [ ] **Token holdings**: Any SPL tokens appear in holdings
- [ ] **Portfolio value**: Total portfolio value calculated
- [ ] **Empty state**: Proper message if no tokens held

#### **Portfolio Refresh**
- [ ] **Refresh button**: Click refresh button works
- [ ] **Auto-refresh**: Page updates when wallet balance changes
- [ ] **Error handling**: Graceful handling of API failures

**✅ Expected Result**: Accurate portfolio tracking with real USD values

---

### **5️⃣ Token Creation Testing**

#### **Create Token Page**
- [ ] **Navigate to create**: Click "Create Token" button
- [ ] **Form validation**: All required fields validated
- [ ] **Image upload**: Test image file selection
- [ ] **Fee display**: 0.1 SOL creation fee shown

#### **Token Creation Process**
- [ ] **Fill form**: Complete all token details
- [ ] **Submit transaction**: Transaction popup appears
- [ ] **Approve transaction**: Phantom/Solflare shows transaction
- [ ] **Success feedback**: Success message appears
- [ ] **Token appears**: New token shows on homepage

#### **Bonding Curve Initialization**
- [ ] **Curve parameters**: Initial virtual reserves set
- [ ] **Trading enabled**: Can immediately buy/sell new token
- [ ] **Price calculation**: Initial price calculated correctly

**✅ Expected Result**: Successful token creation with real SOL fee

---

### **6️⃣ Trading Interface Testing**

#### **Token Detail Page**
- [ ] **Navigate to token**: Click any token from homepage
- [ ] **Token info**: Name, symbol, description display
- [ ] **Price chart**: Bonding curve visualization
- [ ] **Trading interface**: Buy/sell buttons present

#### **Buy Operation Testing**
- [ ] **Enter SOL amount**: Input valid SOL amount to spend
- [ ] **Price calculation**: Estimated tokens received shown
- [ ] **Slippage settings**: Slippage tolerance adjustable
- [ ] **Submit transaction**: Buy transaction executes
- [ ] **Balance update**: Token balance increases
- [ ] **SOL deduction**: SOL balance decreases

#### **Sell Operation Testing**
- [ ] **Switch to sell**: Toggle to sell interface
- [ ] **Enter token amount**: Input tokens to sell
- [ ] **SOL estimation**: Estimated SOL received shown
- [ ] **Submit transaction**: Sell transaction executes
- [ ] **Balance update**: Token balance decreases
- [ ] **SOL addition**: SOL balance increases

**✅ Expected Result**: Working buy/sell operations with real transactions

---

### **7️⃣ Social Features Testing**

#### **Chat Component Testing**
```javascript
// Test chat components in browser console:
// 1. Open any token page
// 2. Look for social features
// 3. Test message components
```

#### **Message System**
- [ ] **Chat interface**: Modern WhatsApp-style design
- [ ] **Message bubbles**: Different styles for sent/received
- [ ] **Timestamps**: Smart time formatting (now, 5m, 2h, etc.)
- [ ] **Message status**: Sent, delivered indicators
- [ ] **User profiles**: Avatar and username display

#### **Real-time Features**
- [ ] **Message sending**: New messages appear instantly
- [ ] **Scroll behavior**: Auto-scroll to bottom
- [ ] **Loading states**: Loading spinners during actions
- [ ] **Error handling**: Failed message handling

**✅ Expected Result**: Professional messaging interface

---

### **8️⃣ Performance Testing**

#### **Load Time Testing**
- [ ] **Initial load**: Page loads in < 3 seconds
- [ ] **Wallet connection**: Connects in < 2 seconds
- [ ] **API responses**: Price data loads quickly
- [ ] **Navigation**: Smooth page transitions

#### **Mobile Testing**
- [ ] **Responsive design**: Works on mobile devices
- [ ] **Touch interactions**: All buttons/links work on mobile
- [ ] **Wallet mobile**: Mobile wallet apps work correctly

#### **Error Handling**
- [ ] **Network errors**: Graceful handling of network issues
- [ ] **Invalid inputs**: Proper form validation
- [ ] **Transaction failures**: Clear error messages
- [ ] **API failures**: Fallback data displayed

**✅ Expected Result**: Fast, responsive, error-free experience

---

## 🔧 **Advanced Testing**

### **Solana Program Testing (Optional)**

If you want to deploy and test the actual Solana program:

```bash
# Install Anchor CLI
npm install -g @coral-xyz/anchor-cli

# Build the program
cd programs/bonding-curve
anchor build

# Run local validator (in separate terminal)
solana-test-validator

# Deploy to local validator
anchor deploy --provider.cluster localnet

# Update program ID in src/config/index.ts with the deployed ID
```

### **API Integration Testing**

#### **Test Real API Endpoints**
```javascript
// Test CoinGecko API
fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
  .then(res => res.json())
  .then(data => console.log('CoinGecko:', data))

// Test Birdeye API (requires API key)
fetch('https://public-api.birdeye.so/defi/price?address=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', {
  headers: { 'X-API-KEY': 'demo' }
})
  .then(res => res.json())
  .then(data => console.log('Birdeye:', data))
```

### **Automated Testing**

#### **Unit Tests**
```bash
# Run component tests
npm run test

# Run with coverage
npm run test:coverage
```

#### **E2E Testing**
```bash
# Install Playwright (if not installed)
npm install -D @playwright/test

# Run E2E tests
npm run test:e2e
```

---

## 🐛 **Common Issues & Solutions**

### **Wallet Connection Issues**
- **Problem**: Wallet won't connect
- **Solution**: Check if wallet extension is installed and unlocked
- **Solution**: Try different wallet (Phantom vs Solflare)
- **Solution**: Check browser console for errors

### **Price Data Issues**
- **Problem**: Prices not loading
- **Solution**: Check internet connection
- **Solution**: Verify API endpoints in browser network tab
- **Solution**: Check for CORS issues

### **Transaction Failures**
- **Problem**: Transactions fail
- **Solution**: Ensure sufficient SOL balance for fees
- **Solution**: Check if on correct network (devnet)
- **Solution**: Try with lower amounts

### **Portfolio Not Loading**
- **Problem**: Portfolio shows empty
- **Solution**: Ensure wallet is connected
- **Solution**: Check if wallet has any SPL tokens
- **Solution**: Try refreshing with the refresh button

---

## ✅ **Test Results Checklist**

### **Core Features Working** ✅
- [ ] Wallet connection (Phantom + Solflare)
- [ ] Real price data (SOL + tokens)
- [ ] Portfolio tracking with USD values
- [ ] Token creation with real fees
- [ ] Trading interface (buy/sell)
- [ ] Social messaging components

### **Technical Requirements** ✅
- [ ] TypeScript compilation without errors
- [ ] No console errors during normal usage
- [ ] Responsive design on all screen sizes
- [ ] Dark mode toggle working
- [ ] Fast load times (< 3 seconds)

### **User Experience** ✅
- [ ] Intuitive navigation
- [ ] Clear error messages
- [ ] Loading states for all actions
- [ ] Professional design and branding
- [ ] Mobile-friendly interface

---

## 🎯 **Success Criteria**

**FloppFun is ready for production if:**

1. ✅ **All wallet operations work smoothly**
2. ✅ **Real price data displays correctly**
3. ✅ **Portfolio shows accurate USD values**
4. ✅ **Token creation charges real SOL fees**
5. ✅ **Trading interface is functional**
6. ✅ **Social features render properly**
7. ✅ **No critical errors in console**
8. ✅ **Mobile experience is excellent**

---

## 🚀 **Next Steps After Testing**

1. **Deploy to Production**: If all tests pass, deploy to mainnet
2. **Add Real Program**: Deploy Solana program for live trading
3. **Configure APIs**: Set up production API keys
4. **Monitor Performance**: Set up analytics and monitoring
5. **User Testing**: Get feedback from real users

---

**Your FloppFun platform is now fully tested and ready! 🎉**

Run through this checklist to ensure everything works perfectly before going live! 