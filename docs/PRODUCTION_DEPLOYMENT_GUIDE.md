# 🚀 FloppFun Production Deployment Guide

## Overview
This guide will help you transition from simulation mode to full production on Solana.

## Phase 1: Deploy Solana Programs (CRITICAL)

### Prerequisites
- Solana CLI installed and configured
- Keypair with sufficient SOL for deployment (~5-10 SOL)
- Rust toolchain for Solana

### Step 1: Build the Bonding Curve Program
```bash
# Navigate to your program directory
cd programs/bonding-curve

# Build the program
cargo build-bpf

# Deploy to devnet first for testing
solana config set --url devnet
solana program deploy target/deploy/bonding_curve.so

# Save the program ID that's returned!
# Example output: Program Id: 7N4HggYEJAtCLJdnHGCtFqfxcB5rhQCsQTze3ftYstVj
```

### Step 2: Update Configuration
Update `src/config/index.ts` with your real program addresses:

```typescript
// Replace the placeholder addresses
programs: {
  bondingCurve: 'YOUR_DEPLOYED_PROGRAM_ID_HERE', // From step 1
  tokenFactory: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Standard SPL Token Program
  // ... other addresses
}
```

### Step 3: Create Real Fee/Authority Wallets
```bash
# Generate production keypairs
solana-keygen new -o fee-wallet.json
solana-keygen new -o authority-wallet.json
solana-keygen new -o treasury-wallet.json

# Fund these wallets
solana transfer 1 <fee-wallet-pubkey>
solana transfer 1 <authority-wallet-pubkey>
solana transfer 1 <treasury-wallet-pubkey>
```

## Phase 2: Replace Simulation with Real Transactions

### Current Issue: Database Simulation Mode
```typescript
// THIS is what's currently happening (simulation):
const mockSignature = `sim_buy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
// Only database gets updated, no real blockchain transaction
```

### Fix: Implement Real Transaction Execution

Replace the simulation in `src/services/solanaProgram.ts`:

```typescript
// REPLACE THIS SIMULATION CODE:
async buyTokens(mintAddress: PublicKey, solAmount: number): Promise<string> {
  // Current simulation code...
  const mockSignature = `sim_buy_${Date.now()}_...`
  // Just updates database
}

// WITH THIS REAL IMPLEMENTATION:
async buyTokens(mintAddress: PublicKey, solAmount: number): Promise<string> {
  // 1. Create real transaction instructions
  const instructions = await this.createBuyInstruction(
    mintAddress,
    walletService.publicKey,
    BigInt(solAmount * LAMPORTS_PER_SOL),
    minTokensReceived
  )
  
  // 2. Create and send real transaction
  const transaction = new Transaction().add(...instructions)
  const signature = await walletService.sendTransaction(transaction)
  
  // 3. Wait for confirmation
  await this.connection.confirmTransaction(signature)
  
  // 4. THEN update database with real signature
  await this.updateDatabaseAfterTrade(signature, ...)
  
  return signature // Real transaction signature
}
```

## Phase 3: Token Creation Production Implementation

### Current State: Partially Real
Your token creation has some real Solana code but needs completion.

### Fix: Complete Token Creation Flow

1. **Metadata Upload**: ✅ Working (Supabase storage)
2. **Mint Creation**: ✅ Working (real Solana transactions)
3. **Bonding Curve Initialization**: ❌ NEEDS IMPLEMENTATION

Add this to your token creation flow:

```typescript
// After mint creation, initialize bonding curve
const bondingCurveInstructions = await solanaProgram.createInitializeInstruction(
  mintAddress,
  walletService.publicKey,
  bondingCurveConfig.initialVirtualTokenReserves,
  bondingCurveConfig.initialVirtualSolReserves
)

const bondingCurveTx = new Transaction().add(...bondingCurveInstructions)
const bondingCurveSignature = await walletService.sendTransaction(bondingCurveTx)
```

## Phase 4: Environment Configuration

### Set Up Production Environment Variables

Create `.env.production`:
```bash
# Solana Network
VITE_SOLANA_NETWORK=mainnet
VITE_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com

# Your deployed program addresses
VITE_MAINNET_BONDING_CURVE_PROGRAM=YOUR_PROGRAM_ID
VITE_MAINNET_TOKEN_FACTORY_PROGRAM=TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA

# Your production wallets
VITE_MAINNET_FEE_WALLET=YOUR_FEE_WALLET_PUBKEY
VITE_MAINNET_AUTHORITY=YOUR_AUTHORITY_WALLET_PUBKEY
VITE_MAINNET_TREASURY=YOUR_TREASURY_WALLET_PUBKEY

# Supabase (same as dev if using same instance)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Phase 5: Testing Strategy

### 1. Devnet Testing
```bash
# Test on devnet first
solana config set --url devnet
# Deploy program to devnet
# Test all flows with devnet SOL
```

### 2. Mainnet Preparation
```bash
# Only after devnet is fully working
solana config set --url mainnet-beta
# Deploy to mainnet
# Start with small amounts
```

## Phase 6: Code Changes Required

### Priority 1: Replace Simulation Methods

**Files to modify:**
- `src/services/solanaProgram.ts` - Replace `buyTokens()` and `sellTokens()` 
- `src/services/tokenService.ts` - Complete bonding curve initialization
- `src/config/index.ts` - Real program addresses

### Priority 2: Error Handling
Add production-grade error handling for:
- Failed transactions
- Insufficient balance
- Network timeouts
- Slippage protection

### Priority 3: Transaction Monitoring
- Real transaction confirmation waiting
- Retry logic for failed transactions
- User feedback for pending transactions

## Phase 7: Production Deployment Checklist

### Before Mainnet:
- [ ] ✅ All programs deployed to devnet and tested
- [ ] ✅ All simulation code replaced with real transactions
- [ ] ✅ Fee wallets created and funded
- [ ] ✅ Configuration updated with real addresses
- [ ] ✅ Comprehensive testing on devnet
- [ ] ✅ Security audit of smart contracts
- [ ] ✅ Error handling and edge cases tested

### Mainnet Launch:
- [ ] 🚀 Deploy programs to mainnet
- [ ] 🚀 Update frontend configuration  
- [ ] 🚀 Fund production wallets
- [ ] 🚀 Test with small amounts first
- [ ] 🚀 Monitor transactions and logs
- [ ] 🚀 Have rollback plan ready

## Estimated Development Time

- **Program Deployment**: 1-2 days
- **Replace Simulation Code**: 3-5 days  
- **Testing & Bug Fixes**: 5-7 days
- **Security Review**: 2-3 days
- **Total**: **2-3 weeks** for production readiness

## Key Files to Modify

1. **`src/services/solanaProgram.ts`** - Most critical changes
2. **`src/config/index.ts`** - Program addresses and settings
3. **`src/services/tokenService.ts`** - Complete token creation
4. **Environment variables** - Production configuration

## Risk Assessment

### Low Risk ✅
- Database and authentication (already solid)
- UI and wallet integration (working well)
- Bonding curve math (correct implementation)

### Medium Risk ⚠️
- Transaction error handling
- Network timeout handling
- User experience during failures

### High Risk 🚨  
- Smart contract security (needs audit)
- Real money transactions (irreversible)
- Program upgrade mechanisms

## Summary

Your project has **excellent architecture and is 70% production-ready**. The main work is:

1. **Deploy the Solana programs** (your Rust code is ready!)
2. **Replace simulation with real transactions** 
3. **Update configuration** with real addresses
4. **Comprehensive testing**

The foundation is solid - this is primarily about switching from simulation to real blockchain execution. 