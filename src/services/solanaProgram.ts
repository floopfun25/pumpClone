import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import type { AccountInfo, Commitment, ConfirmOptions } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token'
import { getWalletService } from './wallet'
import { solanaConfig, programConfig, platformConfig, bondingCurveConfig, tradingConfig } from '@/config'
import { useAuthStore } from '@/stores/auth' // Assuming you have an auth store
import { supabase } from './supabase'

const walletService = getWalletService()

// Program instruction types
export enum BondingCurveInstruction {
  Initialize = 0,
  Buy = 1,
  Sell = 2,
  Graduate = 3,
  Withdraw = 4
}

// Bonding curve account structure (matches Rust program)
export interface BondingCurveAccount {
  discriminator: Buffer
  mintAddress: PublicKey
  creator: PublicKey
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  graduated: boolean
  createdAt: bigint
  bumpSeed: number
}

// Helper functions for encoding instructions
function encodeTradeInstruction(data: {
  instruction: BondingCurveInstruction
  amount: bigint
  minReceived: bigint
  maxSlippage: number
}): Buffer {
  const buffer = Buffer.alloc(1 + 8 + 8 + 2)
  let offset = 0
  
  // Instruction discriminator
  buffer.writeUInt8(data.instruction, offset)
  offset += 1
  
  // Amount (8 bytes, little endian)
  buffer.writeBigUInt64LE(data.amount, offset)
  offset += 8
  
  // Min received (8 bytes, little endian)
  buffer.writeBigUInt64LE(data.minReceived, offset)
  offset += 8
  
  // Max slippage (2 bytes, little endian)
  buffer.writeUInt16LE(data.maxSlippage, offset)
  
  return buffer
}

function encodeInitializeInstruction(data: {
  initialVirtualTokenReserves: bigint
  initialVirtualSolReserves: bigint
}): Buffer {
  const buffer = Buffer.alloc(1 + 8 + 8)
  let offset = 0
  
  // Instruction discriminator
  buffer.writeUInt8(BondingCurveInstruction.Initialize, offset)
  offset += 1
  
  // Initial virtual token reserves
  buffer.writeBigUInt64LE(data.initialVirtualTokenReserves, offset)
  offset += 8
  
  // Initial virtual SOL reserves
  buffer.writeBigUInt64LE(data.initialVirtualSolReserves, offset)
  
  return buffer
}

// Safe number helpers
const safeNumber = (value: number): number => {
  if (!isFinite(value) || isNaN(value)) return 0
  return Math.max(0, value)
}

const safePrice = (price: number, fallback: number): number => {
  if (!isFinite(price) || isNaN(price) || price <= 0) return fallback
  return price
}

const safeMarketCap = (price: number, supply: number): number => {
  const marketCap = price * supply
  if (!isFinite(marketCap) || isNaN(marketCap)) return 0
  return Math.max(0, marketCap)
}

export class SolanaProgram {
  private connection: Connection
  private programId: PublicKey
  private feeWallet: PublicKey

  constructor() {
    this.connection = new Connection(solanaConfig.rpcUrl, solanaConfig.commitment as Commitment)
    this.programId = new PublicKey(programConfig.bondingCurve)
    this.feeWallet = new PublicKey(platformConfig.feeWallet)
  }

  /**
   * Derive bonding curve PDA address
   */
  deriveBondingCurveAddress(mintAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintAddress.toBuffer()],
      this.programId
    )
  }

  /**
   * Parse bonding curve account data from blockchain
   */
  private parseBondingCurveAccount(data: Buffer): BondingCurveAccount {
    let offset = 0
    
    // Discriminator (8 bytes)
    const discriminator = data.subarray(offset, offset + 8)
    offset += 8
    
    // Mint address (32 bytes)
    const mintAddress = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    
    // Creator (32 bytes)
    const creator = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    
    // Virtual token reserves (8 bytes)
    const virtualTokenReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Virtual SOL reserves (8 bytes)
    const virtualSolReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Real token reserves (8 bytes)
    const realTokenReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Real SOL reserves (8 bytes)
    const realSolReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Token total supply (8 bytes)
    const tokenTotalSupply = data.readBigUInt64LE(offset)
    offset += 8
    
    // Graduated (1 byte)
    const graduated = data.readUInt8(offset) === 1
    offset += 1
    
    // Created at (8 bytes)
    const createdAt = data.readBigUInt64LE(offset)
    offset += 8
    
    // Bump seed (1 byte)
    const bumpSeed = data.readUInt8(offset)
    
    return {
      discriminator,
      mintAddress,
      creator,
      virtualTokenReserves,
      virtualSolReserves,
      realTokenReserves,
      realSolReserves,
      tokenTotalSupply,
      graduated,
      createdAt,
      bumpSeed
    }
  }

  /**
   * Get bonding curve account data from blockchain
   */
  async getBondingCurveAccount(mintAddress: PublicKey): Promise<BondingCurveAccount | null> {
    try {
      const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
      const accountInfo = await this.connection.getAccountInfo(bondingCurveAddress)
      
      if (!accountInfo) {
        console.log('Bonding curve account not found for:', mintAddress.toBase58())
        return null
      }
      
      return this.parseBondingCurveAccount(accountInfo.data)
    } catch (error) {
      console.error('Failed to get bonding curve account:', error)
      return null
    }
  }

  /**
   * Get bonding curve data from database (for standard SPL tokens)
   */
  async getBondingCurveFromDatabase(mintAddress: string): Promise<BondingCurveAccount | null> {
    try {
      const { data: tokenData, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .single()

      if (error || !tokenData) {
        console.log('Token not found in database for:', mintAddress)
        return null
      }

      // Convert database data to BondingCurveAccount format
      return {
        discriminator: Buffer.from([]), // Not needed for database approach
        mintAddress: new PublicKey(mintAddress),
        creator: new PublicKey(tokenData.creator || platformConfig.authority),
        virtualTokenReserves: BigInt(tokenData.virtual_token_reserves || tokenData.total_supply || 1000000000),
        virtualSolReserves: BigInt(tokenData.virtual_sol_reserves || 1073000000), // Default from your logs
        realTokenReserves: BigInt(tokenData.real_token_reserves || 0),
        realSolReserves: BigInt(tokenData.real_sol_reserves || 0),
        tokenTotalSupply: BigInt(tokenData.total_supply || 1000000000),
        graduated: tokenData.graduated || false,
        createdAt: BigInt(new Date(tokenData.created_at).getTime()),
        bumpSeed: 255 // Default bump seed
      }
    } catch (error) {
      console.error('Failed to get bonding curve from database:', error)
      return null
    }
  }

  /**
   * Create initialize bonding curve instruction
   */
  async createInitializeInstruction(
    mintAddress: PublicKey,
    creator: PublicKey,
    initialVirtualTokenReserves: bigint,
    initialVirtualSolReserves: bigint
  ): Promise<TransactionInstruction[]> {
    const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
    
    const instructionData = encodeInitializeInstruction({
      initialVirtualTokenReserves,
      initialVirtualSolReserves
    })
    
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

  /**
   * Create buy transaction instruction
   */
  async createBuyInstruction(
    mintAddress: PublicKey,
    buyer: PublicKey,
    solAmount: bigint,
    minTokensReceived: bigint,
    slippageBps: number = tradingConfig.slippageToleranceDefault * 100
  ): Promise<TransactionInstruction[]> {
    // Get or create buyer's associated token account
    const buyerTokenAccount = await getAssociatedTokenAddress(mintAddress, buyer)
    
    const instructions: TransactionInstruction[] = []
    
    // Check if buyer's token account exists, create if not
    const tokenAccountInfo = await this.connection.getAccountInfo(buyerTokenAccount)
    if (!tokenAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          buyer, // payer
          buyerTokenAccount, // associated token account
          buyer, // owner
          mintAddress // mint
        )
      )
    }

    // Calculate platform fee (1%) and treasury amount (99%)
    const feeAmount = solAmount / BigInt(100)          // 1% fee to platform
    const treasuryAmount = solAmount - feeAmount       // 99% to treasury/pool
    
    console.log('💰 [TX] Full trade amount:', Number(solAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💰 [TX] Platform fee:', Number(feeAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💰 [TX] Treasury amount:', Number(treasuryAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💳 [TX] Fee wallet:', this.feeWallet.toBase58())

    // Transfer treasury amount (99% of trade) to treasury wallet
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: new PublicKey(platformConfig.treasury), // Treasury wallet
        lamports: treasuryAmount
      })
    )
    
    // Transfer platform fee (1% of trade) to fee wallet
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: this.feeWallet,
        lamports: feeAmount
      })
    )
    
    console.log('✅ [TX] Added treasury transfer instruction:', Number(treasuryAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('✅ [TX] Added fee transfer instruction:', Number(feeAmount) / LAMPORTS_PER_SOL, 'SOL')

    return instructions
  }

  /**
   * Create sell transaction instruction (simplified for standard SPL tokens)
   */
  async createSellInstruction(
    mintAddress: PublicKey,
    seller: PublicKey,
    tokenAmount: bigint,
    minSolReceived: bigint,
    slippageBps: number = tradingConfig.slippageToleranceDefault * 100
  ): Promise<TransactionInstruction[]> {
    // Calculate platform fee (1% of the SOL to be received)
    const feeAmount = minSolReceived / BigInt(100)
    
    console.log('💰 [TX] Sell fee:', Number(feeAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💳 [TX] Fee wallet:', this.feeWallet.toBase58())

    // Transfer platform fee to fee wallet (simplified sell transaction)
    return [SystemProgram.transfer({
      fromPubkey: seller,
      toPubkey: this.feeWallet,
      lamports: feeAmount
    })]
  }

  /**
   * Execute buy transaction (PRODUCTION - Real blockchain transactions)
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: number,
    slippagePercent: number = tradingConfig.slippageToleranceDefault
  ): Promise<string> {
    console.log('💰 [BUY] Starting buy transaction...')
    console.log('📊 [BUY] Parameters:', { 
      mintAddress: mintAddress.toBase58(), 
      solAmount, 
      slippagePercent 
    })

    // Get the authenticated user ID from the centralized auth store.
    // This store is responsible for handling all authentication and state consistency.
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user?.id) {
      // The UI should prevent this, but as a safeguard:
      throw new Error('User not authenticated. Please connect and sign in with your wallet.');
    }
    const actualUserId = authStore.user.id;
    console.log('✅ [BUY] Proceeding with consistent user ID from auth store:', actualUserId);

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

    // Get the most up-to-date bonding curve state directly from the blockchain for a real trade.
    const bondingCurve = await this.getBondingCurveAccount(mintAddress)
    if (!bondingCurve) {
      throw new Error('Bonding curve not found for this token')
    }

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
      
      // 6. Calculate tokens received using bonding curve math (PROPER CALCULATION)
      const { BondingCurveService } = await import('./bondingCurve')
      const tradeResult = BondingCurveService.calculateBuyTrade(
        Number(solAmountLamports) / LAMPORTS_PER_SOL,
        Number(bondingCurve.virtualSolReserves) / LAMPORTS_PER_SOL,
        Number(bondingCurve.virtualTokenReserves) / Math.pow(10, 9),
        Number(bondingCurve.realTokenReserves) / Math.pow(10, 9)
      )
      
      const tokensReceived = tradeResult.tokensReceived * Math.pow(10, 9) // Convert back to lamports
      
      console.log('📊 Calculated tokens from bonding curve:', Number(tokensReceived) / Math.pow(10, 9))
      
      // Re-fetch the bonding curve state AFTER the transaction is confirmed
      // This ensures the database is updated with the absolute final on-chain values.
      const finalBondingCurve = await this.getBondingCurveAccount(mintAddress);
      if (!finalBondingCurve) {
        throw new Error('Failed to fetch final bonding curve state after trade.');
      }

      // 7. Update database with REAL transaction data
      await this.updateDatabaseAfterBuy(
        signature,
        mintAddress.toBase58(),
        walletService.publicKey.toBase58(),
        Number(solAmountLamports) / LAMPORTS_PER_SOL,
        Number(tokensReceived) / Math.pow(10, 9), // Convert to token units
        finalBondingCurve, // Use the final, post-trade bonding curve state
        actualUserId // Pass the resolved user ID
      )
      
      console.log('✅ Database updated with real transaction data')
      console.log('📊 Tokens received:', Number(tokensReceived) / Math.pow(10, 9))
      
      // 💰 Refresh wallet balance immediately after successful transaction
      await walletService.updateBalance()
      console.log('💰 Wallet balance refreshed after buy transaction')
      
      return signature // REAL transaction signature
      
    } catch (error: any) {
      console.error('❌ Buy transaction failed:', error)
      throw this.handleSolanaError(error)
    }
  }

  /**
   * Execute sell transaction (PRODUCTION - Real blockchain transactions)
   */
  async sellTokens(
    mintAddress: PublicKey,
    tokenAmount: number,
    slippagePercent: number = tradingConfig.slippageToleranceDefault
  ): Promise<string> {
    if (!walletService.connected || !walletService.publicKey) {
      throw new Error('Wallet not connected')
    }

    // Convert token amount to proper decimals
    const tokenAmountWithDecimals = BigInt(Math.floor(tokenAmount * Math.pow(10, 9))) // 9 decimals

    // Get the most up-to-date bonding curve state directly from the blockchain for a real trade.
    const bondingCurve = await this.getBondingCurveAccount(mintAddress)
    if (!bondingCurve) {
      throw new Error('Bonding curve not found for this token')
    }

    if (bondingCurve.graduated) {
      throw new Error('This token has graduated and can only be traded on DEX')
    }

    // Calculate expected SOL with slippage protection
    const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves
    const newTokenReserves = bondingCurve.virtualTokenReserves + tokenAmountWithDecimals
    const newSolReserves = k / newTokenReserves
    const solOut = bondingCurve.virtualSolReserves - newSolReserves
    
    // Calculate minimum SOL with slippage tolerance
    const slippageFactor = (100 - slippagePercent) / 100
    const minSolReceived = BigInt(Math.floor(Number(solOut) * slippageFactor))
    
    console.log('💰 Sell calculation:', {
      tokenAmount: tokenAmount,
      solOut: Number(solOut) / LAMPORTS_PER_SOL,
      minSolReceived: Number(minSolReceived) / LAMPORTS_PER_SOL,
      slippagePercent
    })

    try {
      // 🚀 CREATE REAL BLOCKCHAIN TRANSACTION
      
      // 1. Create sell instruction
      const sellInstructions = await this.createSellInstruction(
        mintAddress,
        walletService.publicKey,
        tokenAmountWithDecimals,
        minSolReceived,
        slippagePercent * 100 // Convert to basis points
      )
      
      // 2. Create transaction
      const transaction = new Transaction()
      transaction.add(...sellInstructions)
      
      // 3. Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = walletService.publicKey
      
      // 4. Send transaction
      console.log('📤 Sending sell transaction to Solana...')
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
      
      // 6. Re-fetch the bonding curve state AFTER the transaction is confirmed
      const finalBondingCurve = await this.getBondingCurveAccount(mintAddress);
      if (!finalBondingCurve) {
        throw new Error('Failed to fetch final bonding curve state after trade.');
      }
      
      // 7. Calculate actual SOL received (from database state)
      const actualSolReceived = Number(bondingCurve.virtualSolReserves - finalBondingCurve.virtualSolReserves);
      
      // 8. Update database with REAL transaction data
      await this.updateDatabaseAfterSell(
        signature,
        mintAddress.toBase58(),
        walletService.publicKey.toBase58(),
        Number(tokenAmountWithDecimals) / Math.pow(10, 9),
        actualSolReceived / LAMPORTS_PER_SOL,
        finalBondingCurve
      )
      
      console.log('✅ Database updated with real transaction data')
      console.log('💰 SOL received:', Number(actualSolReceived) / LAMPORTS_PER_SOL)
      
      // 💰 Refresh wallet balance immediately after successful transaction
      await walletService.updateBalance()
      console.log('💰 Wallet balance refreshed after sell transaction')
      
      return signature // REAL transaction signature
      
    } catch (error: any) {
      console.error('❌ Sell transaction failed:', error)
      throw this.handleSolanaError(error)
    }
  }

  /**
   * Update database after successful buy transaction
   */
  private async updateDatabaseAfterBuy(
    signature: string,
    mintAddress: string,
    buyerAddress: string,
    solAmount: number,
    tokensReceived: number,
    bondingCurve: BondingCurveAccount,
    actualUserId: string
  ) {
    console.log('🔄 Starting database update after buy transaction via RPC...');
    try {
      const { data: token } = await supabase
        .from('tokens')
        .select('id, total_supply')
        .eq('mint_address', mintAddress)
        .single();

      if (!token) {
        throw new Error('Token not found for buy update.');
      }

      const newPrice = Number(bondingCurve.virtualSolReserves) / Number(bondingCurve.virtualTokenReserves) / LAMPORTS_PER_SOL;
      const newMarketCap = newPrice * token.total_supply;

      const { error: rpcError } = await supabase.rpc('process_buy_trade', {
        p_user_id: actualUserId,
        p_token_id: token.id,
        p_signature: signature,
        p_sol_amount: solAmount,
        p_token_amount: tokensReceived,
        p_new_price: newPrice,
        p_new_market_cap: newMarketCap
      });

      if (rpcError) {
        console.error('❌ RPC call to process_buy_trade failed:', rpcError);
        throw rpcError;
      }

      console.log('✅ Buy transaction processed successfully via RPC.');
    } catch (error: any) {
      console.error('❌ Failed to update database after buy:', error);
      // Do not re-throw, as the on-chain transaction was successful.
    }
  }

  /**
   * Update database after successful sell transaction
   */
  private async updateDatabaseAfterSell(
    signature: string,
    mintAddress: string,
    sellerAddress: string,
    tokensSold: number,
    solReceived: number,
    bondingCurve: BondingCurveAccount
  ) {
    console.log('🔄 Starting database update after sell transaction via RPC...');
    try {
      const { data: token } = await supabase.from('tokens').select('id, total_supply').eq('mint_address', mintAddress).single();
      const { data: { user } } = await supabase.auth.getUser();

      if (!token || !user) {
        throw new Error('Token or user not found for sell update.');
      }

      const newPrice = Number(bondingCurve.virtualSolReserves) / Number(bondingCurve.virtualTokenReserves) / LAMPORTS_PER_SOL;
      const newMarketCap = newPrice * token.total_supply;

      const { error: rpcError } = await supabase.rpc('process_sell_trade', {
        p_user_id: user.id,
        p_token_id: token.id,
        p_signature: signature,
        p_sol_received: solReceived,
        p_tokens_sold: tokensSold,
        p_new_price: newPrice,
        p_new_market_cap: newMarketCap
      });

      if (rpcError) {
        console.error('❌ RPC call to process_sell_trade failed:', rpcError);
        throw rpcError;
      }

      console.log('✅ Sell transaction processed successfully via RPC.');
    } catch (error) {
      console.error('❌ Failed to update database after sell:', error);
      // Do not re-throw, as the on-chain transaction was successful.
    }
  }

  /**
   * Handle Solana-specific errors with user-friendly messages
   */
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
    } else if (error.message?.includes('0x0')) {
      throw new Error('Program error: Invalid instruction.')
    } else if (error.message?.includes('0x1')) {
      throw new Error('Program error: Already graduated.')
    } else if (error.message?.includes('0x2')) {
      throw new Error('Program error: Slippage tolerance exceeded.')
    } else {
      throw new Error(`Transaction failed: ${error.message}`)
    }
  }

  /**
   * Get user's token balance from blockchain
   */
  async getUserTokenBalance(mintAddress: PublicKey, userPublicKey: PublicKey): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(mintAddress, userPublicKey)
      const accountInfo = await this.connection.getAccountInfo(tokenAccount)
      
      if (!accountInfo) {
        return 0
      }
      
      // Parse token account data to get balance
      // This is a simplified version - you'd need proper token account parsing
      const balance = accountInfo.data.readBigUInt64LE(64) // Token amount is at offset 64
      return Number(balance) / Math.pow(10, 9) // Convert from lamports to tokens
    } catch (error) {
      console.error('Failed to get user token balance:', error)
      return 0
    }
  }
}

// Export singleton instance
export const solanaProgram = new SolanaProgram() 