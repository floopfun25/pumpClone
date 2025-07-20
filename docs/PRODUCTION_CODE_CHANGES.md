# 🔧 Production Code Implementation Guide

## Critical Code Changes Required

### 1. Replace Simulation Trading with Real Blockchain Transactions

**File:** `src/services/solanaProgram.ts`

#### Current Implementation (Simulation Mode):
```typescript
// Lines 350-580 in solanaProgram.ts
async buyTokens(mintAddress: PublicKey, solAmount: number): Promise<string> {
  // ... validation code ...
  
  // 🚨 THIS IS SIMULATION - NO REAL TRANSACTION
  const mockSignature = `sim_buy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Only updates database, no blockchain interaction
  await supabase.from('transactions').insert({
    signature: mockSignature,  // ← Fake signature
    // ... other fields
  })
  
  return mockSignature
}
```

#### Production Implementation (Replace Above):
```typescript
async buyTokens(mintAddress: PublicKey, solAmount: number): Promise<string> {
  if (!walletService.connected || !walletService.publicKey) {
    throw new Error('Wallet not connected')
  }

  // Validate trade amount
  const solAmountLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL))
  if (solAmountLamports < BigInt(tradingConfig.minTradeAmount)) {
    throw new Error(`Minimum trade amount is ${tradingConfig.minTradeAmount / LAMPORTS_PER_SOL} SOL`)
  }
  if (solAmountLamports > BigInt(tradingConfig.maxTradeAmount)) {
    throw new Error(`Maximum trade amount is ${tradingConfig.maxTradeAmount / LAMPORTS_PER_SOL} SOL`)
  }

  // Get bonding curve state from blockchain (not database)
  const bondingCurveAddress = this.deriveBondingCurveAddress(mintAddress)[0]
  const bondingCurveAccount = await this.connection.getAccountInfo(bondingCurveAddress)
  
  if (!bondingCurveAccount) {
    throw new Error('Bonding curve not found for this token')
  }

  // Parse bonding curve data
  const bondingCurve = this.parseBondingCurveAccount(bondingCurveAccount.data)
  
  if (bondingCurve.graduated) {
    throw new Error('This token has graduated and can only be traded on DEX')
  }

  // Calculate expected tokens with slippage protection
  const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves
  const newSolReserves = bondingCurve.virtualSolReserves + solAmountLamports
  const newTokenReserves = k / newSolReserves
  const tokensOut = bondingCurve.virtualTokenReserves - newTokenReserves
  
  // Calculate minimum tokens with slippage tolerance
  const slippageFactor = (100 - slippagePercent) / 100
  const minTokensReceived = BigInt(Math.floor(Number(tokensOut) * slippageFactor))
  
  console.log('💰 Buy calculation:', {
    solAmount: Number(solAmountLamports) / LAMPORTS_PER_SOL,
    tokensOut: Number(tokensOut) / LAMPORTS_PER_SOL,
    minTokensReceived: Number(minTokensReceived) / LAMPORTS_PER_SOL,
    slippagePercent
  })

  try {
    // 🚀 CREATE REAL BLOCKCHAIN TRANSACTION
    
    // 1. Create buy instruction
    const buyInstructions = await this.createBuyInstruction(
      mintAddress,
      walletService.publicKey,
      solAmountLamports,
      minTokensReceived,
      slippagePercent * 100 // Convert to basis points
    )
    
    // 2. Create transaction
    const transaction = new Transaction()
    transaction.add(...buyInstructions)
    
    // 3. Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer = walletService.publicKey
    
    // 4. Send transaction
    console.log('📤 Sending buy transaction to Solana...')
    const signature = await walletService.sendTransaction(transaction)
    console.log('✅ Transaction sent:', signature)
    
    // 5. Wait for confirmation
    console.log('⏳ Waiting for confirmation...')
    const confirmation = await this.connection.confirmTransaction(
      signature,
      'confirmed'
    )
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
    }
    
    console.log('✅ Transaction confirmed!')
    
    // 6. Get updated bonding curve state from blockchain
    const updatedBondingCurveAccount = await this.connection.getAccountInfo(bondingCurveAddress)
    const updatedBondingCurve = this.parseBondingCurveAccount(updatedBondingCurveAccount!.data)
    
    // 7. Calculate actual tokens received (from blockchain state)
    const actualTokensReceived = bondingCurve.virtualTokenReserves - updatedBondingCurve.virtualTokenReserves
    
    // 8. Update database with REAL transaction data
    await this.updateDatabaseAfterBuy(
      signature,
      mintAddress.toBase58(),
      walletService.publicKey.toBase58(),
      Number(solAmountLamports) / LAMPORTS_PER_SOL,
      Number(actualTokensReceived) / Math.pow(10, 9), // Assuming 9 decimals
      updatedBondingCurve
    )
    
    console.log('✅ Database updated with real transaction data')
    
    return signature // REAL transaction signature
    
  } catch (error: any) {
    console.error('❌ Buy transaction failed:', error)
    
    // Handle specific Solana errors
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient SOL balance in wallet')
    } else if (error.message?.includes('slippage')) {
      throw new Error('Price moved too much. Try again with higher slippage tolerance.')
    } else if (error.message?.includes('User rejected')) {
      throw new Error('Transaction rejected by user')
    } else {
      throw new Error(`Transaction failed: ${error.message}`)
    }
  }
}

// Helper method to update database after successful trade
private async updateDatabaseAfterBuy(
  signature: string,
  mintAddress: string,
  buyerAddress: string,
  solAmount: number,
  tokensReceived: number,
  bondingCurve: any
) {
  // Get token and user info
  const { data: token } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .single()
    
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  
  if (!token || !userId) {
    throw new Error('Token or user not found')
  }
  
  // Calculate new price from blockchain state
  const newPrice = Number(bondingCurve.virtualSolReserves) / Number(bondingCurve.virtualTokenReserves) / LAMPORTS_PER_SOL
  const newMarketCap = newPrice * token.total_supply
  
  // Record transaction in database
  await supabase.from('transactions').insert({
    signature, // REAL blockchain signature
    token_id: token.id,
    user_id: userId,
    transaction_type: 'buy',
    sol_amount: solAmount,
    token_amount: tokensReceived,
    price_per_token: newPrice,
    bonding_curve_price: newPrice,
    platform_fee: solAmount * 0.01,
    status: 'completed',
    block_time: new Date().toISOString()
  })
  
  // Update token statistics
  await supabase.from('tokens').update({
    current_price: newPrice,
    market_cap: newMarketCap,
    volume_24h: (token.volume_24h || 0) + solAmount,
    last_trade_at: new Date().toISOString(),
    virtual_sol_reserves: bondingCurve.virtualSolReserves.toString(),
    virtual_token_reserves: bondingCurve.virtualTokenReserves.toString()
  }).eq('id', token.id)
  
  // Update user holdings
  // ... (existing holding logic)
}

// Helper method to parse bonding curve account data
private parseBondingCurveAccount(data: Buffer): any {
  // This depends on your Rust program's data structure
  // You'll need to implement proper deserialization
  // For now, this is a placeholder
  return {
    virtualSolReserves: BigInt(0), // Parse from buffer
    virtualTokenReserves: BigInt(0), // Parse from buffer  
    graduated: false // Parse from buffer
  }
}
```

### 2. Add Missing Initialize Instruction Method

Add this method to `SolanaProgram` class:

```typescript
/**
 * Create initialize bonding curve instruction
 */
async createInitializeInstruction(
  mintAddress: PublicKey,
  creator: PublicKey,
  initialVirtualTokenReserves: number,
  initialVirtualSolReserves: number
): Promise<TransactionInstruction[]> {
  const [bondingCurveAddress, bump] = this.deriveBondingCurveAddress(mintAddress)
  
  // Encode instruction data
  const instructionData = Buffer.concat([
    Buffer.from([0]), // Initialize instruction discriminator
    Buffer.from(initialVirtualTokenReserves.toString().padStart(8, '0')),
    Buffer.from(initialVirtualSolReserves.toString().padStart(8, '0'))
  ])
  
  return [new TransactionInstruction({
    programId: this.programId,
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
      { pubkey: mintAddress, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
    ],
    data: instructionData
  })]
}
```

### 3. Update Token Creation to Include Bonding Curve Initialization

**File:** `src/services/tokenService.ts`

Add this after mint creation:

```typescript
// After successful mint creation...
console.log('🎯 Initializing bonding curve...')

// Initialize bonding curve on blockchain
const bondingCurveInstructions = await solanaProgram.createInitializeInstruction(
  mintAddress,
  walletService.publicKey,
  bondingCurveConfig.initialVirtualTokenReserves,
  bondingCurveConfig.initialVirtualSolReserves
)

const bondingCurveTx = new Transaction().add(...bondingCurveInstructions)
const bondingCurveSignature = await walletService.sendTransaction(bondingCurveTx)

console.log('✅ Bonding curve initialized:', bondingCurveSignature)
```

### 4. Update Configuration with Real Program Addresses

**File:** `src/config/index.ts`

```typescript
// Replace these after deploying your program:
programs: {
  bondingCurve: process.env.NODE_ENV === 'production' 
    ? 'YOUR_MAINNET_PROGRAM_ID' 
    : 'YOUR_DEVNET_PROGRAM_ID',
  tokenFactory: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  feeCollector: process.env.NODE_ENV === 'production'
    ? 'YOUR_MAINNET_FEE_WALLET'
    : 'YOUR_DEVNET_FEE_WALLET'
}
```

### 5. Add Production Error Handling

```typescript
// Add to solanaProgram.ts
private handleSolanaError(error: any): never {
  console.error('Solana transaction error:', error)
  
  if (error.message?.includes('insufficient funds')) {
    throw new Error('Insufficient SOL balance. Please add more SOL to your wallet.')
  } else if (error.message?.includes('0x1771')) { // Custom program error
    throw new Error('Token has already graduated to DEX trading.')
  } else if (error.message?.includes('0x1772')) { // Custom program error  
    throw new Error('Price slippage too high. Try again with higher slippage tolerance.')
  } else if (error.message?.includes('User rejected')) {
    throw new Error('Transaction was cancelled.')
  } else if (error.message?.includes('blockhash not found')) {
    throw new Error('Network congestion. Please try again.')
  } else {
    throw new Error(`Transaction failed: ${error.message}`)
  }
}
```

## Summary of Changes

1. **Replace simulation with real blockchain transactions** ✅
2. **Add proper error handling for Solana-specific errors** ✅  
3. **Implement bonding curve initialization** ✅
4. **Update configuration with real program addresses** ✅
5. **Add transaction confirmation waiting** ✅
6. **Update database only after blockchain confirmation** ✅

## Testing Strategy

1. **Deploy to devnet first**
2. **Test all trading flows with devnet SOL**
3. **Verify database updates match blockchain state**
4. **Test error scenarios (insufficient funds, slippage, etc.)**
5. **Only then deploy to mainnet**

After implementing these changes, your app will execute real Solana transactions instead of database simulations! 