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
   * Verify current user state and session consistency
   * Helps debug authentication and database sync issues
   */
  private async verifyUserState(): Promise<{
    sessionUser: any | null,
    databaseUser: any | null,
    walletAddress: string | null,
    consistent: boolean,
    issues: string[]
  }> {
    const issues: string[] = []
    console.log('🔍 [USER VERIFICATION] Starting user state verification...')
    
    // Get current session
    const { data: { session } } = await supabase.auth.getSession()
    const sessionUser = session?.user
    console.log('👤 [USER VERIFICATION] Session user:', {
      exists: !!sessionUser,
      id: sessionUser?.id,
      metadata: sessionUser?.user_metadata
    })
    
    // Get current wallet
    const walletAddress = walletService.publicKey?.toBase58() || null
    console.log('👛 [USER VERIFICATION] Wallet address:', walletAddress)
    
    // Try to find user in database by session ID
    let databaseUser = null
    if (sessionUser) {
      const { data: sessionDbUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionUser.id)
        .single()
      databaseUser = sessionDbUser
      console.log('👤 [USER VERIFICATION] Session user in DB:', {
        found: !!sessionDbUser,
        id: sessionDbUser?.id,
        wallet: sessionDbUser?.wallet_address
      })
    }
    
    // Try to find user by wallet address
    let walletUser = null
    if (walletAddress) {
      const { data: fetchedWalletUser } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()
      walletUser = fetchedWalletUser
      console.log('👛 [USER VERIFICATION] Wallet user in DB:', {
        found: !!walletUser,
        id: walletUser?.id,
        wallet: walletUser?.wallet_address
      })
    }
    
    // Check consistency
    if (!sessionUser) {
      issues.push('No active session')
    }
    
    if (!walletAddress) {
      issues.push('No connected wallet')
    }
    
    if (sessionUser && !databaseUser) {
      issues.push('Session user not found in database')
    }
    
    if (walletAddress && !walletUser) {
      issues.push('Wallet address not found in database')
    }
    
    if (sessionUser && walletUser && sessionUser.id !== walletUser.id) {
      issues.push('Session user ID does not match wallet user ID')
    }
    
    if (sessionUser && walletAddress) {
      const sessionWallet = sessionUser.user_metadata?.wallet_address
      if (sessionWallet !== walletAddress) {
        issues.push('Session wallet metadata does not match connected wallet')
      }
    }
    
    const consistent = issues.length === 0
    
    console.log('🔍 [USER VERIFICATION] Verification complete:', {
      consistent,
      issues,
      sessionUserId: sessionUser?.id,
      databaseUserId: databaseUser?.id,
      walletUserId: walletUser?.id,
      walletAddress
    })
    
    return {
      sessionUser,
      databaseUser: databaseUser || walletUser,
      walletAddress,
      consistent,
      issues
    }
  }

  /**
   * Fix user state inconsistency by properly migrating existing wallet user to session ID
   */
  private async fixUserStateInconsistency(userState: {
    sessionUser: any | null,
    databaseUser: any | null,
    walletAddress: string | null,
    consistent: boolean,
    issues: string[]
  }): Promise<{ success: boolean; error?: string; resolvedUserId?: string }> {
    try {
      console.log('🔧 [USER FIX] Starting user state fix...')
      
      if (!userState.sessionUser || !userState.walletAddress) {
        return { success: false, error: 'Cannot fix: session user or wallet address missing' }
      }

      const sessionUserId = userState.sessionUser.id
      const walletAddress = userState.walletAddress
      
      console.log('🔧 [USER FIX] Session user ID:', sessionUserId)
      console.log('🔧 [USER FIX] Wallet address:', walletAddress)
      
      // Check if session user already exists in database
      const { data: sessionUserRecord, error: sessionCheckError } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionUserId)
        .single()
      
      console.log('🔍 [USER FIX] Session user in database:', {
        found: !!sessionUserRecord,
        error: sessionCheckError?.message
      })
      
      if (sessionUserRecord) {
        console.log('✅ [USER FIX] Session user already exists in database')
        return { 
          success: true, 
          resolvedUserId: sessionUserId,
          error: undefined 
        }
      }
      
      // Get existing wallet user data
      const { data: existingWalletUser } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()
      
      console.log('🔍 [USER FIX] Existing wallet user:', {
        found: !!existingWalletUser,
        id: existingWalletUser?.id
      })
      
      if (existingWalletUser && existingWalletUser.id !== sessionUserId) {
        console.log('🔄 [USER FIX] Migrating existing wallet user to session ID...')
        console.log('🔄 [USER FIX] From:', existingWalletUser.id, '→ To:', sessionUserId)

        // The correct approach is to UPDATE the existing user's ID to the new session ID.
        // This avoids the "duplicate key" error and is much more efficient.
        const { error: updateError } = await supabase
          .from('users')
          .update({ id: sessionUserId })
          .eq('wallet_address', walletAddress)

        if (updateError) {
          console.error('❌ [USER FIX] Failed to update user ID:', updateError)
          // Attempt to handle the case where the session user ID might already exist
          // even though our initial check failed. This can happen in rare race conditions.
          if (updateError.code === '23505') { // Unique violation
             console.warn('⚠️ [USER FIX] Possible race condition: Session user ID may now exist. Re-querying.')
             const { data: raceUser } = await supabase.from('users').select('id').eq('id', sessionUserId).single();
             if (raceUser) {
                console.log('✅ [USER FIX] Race condition confirmed and handled. User now has correct session ID.')
                return { success: true, resolvedUserId: sessionUserId };
             }
          }
          return { success: false, error: `Failed to update user ID: ${updateError.message}` }
        }

        console.log('✅ [USER FIX] Successfully migrated user to session ID')
      } else if (!existingWalletUser) {
        // No existing user - create new one with session ID
        console.log('🆕 [USER FIX] Creating new user record with session ID...')
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: sessionUserId,
            wallet_address: walletAddress,
            username: `user_${walletAddress.slice(0, 6)}`,
            created_at: new Date().toISOString()
          })
        
        if (createError) {
          console.error('❌ [USER FIX] Failed to create new user:', createError)
          return { success: false, error: `Failed to create user: ${createError.message}` }
        }
        
        console.log('✅ [USER FIX] Created new user record successfully')
      }
      
      return { 
        success: true, 
        resolvedUserId: sessionUserId,
        error: undefined 
      }
      
    } catch (error: any) {
      console.error('❌ [USER FIX] Fix failed:', error)
      return { 
        success: false, 
        error: error?.message || 'Unknown error during user fix' 
      }
    }
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
    
    // Fix user state inconsistency if needed and get resolved user ID
    const userState = await this.verifyUserState()
    let actualUserId: string
    
    if (!userState.consistent) {
      console.log('🔧 [BUY] User state inconsistent - attempting to fix...')
      const fixResult = await this.fixUserStateInconsistency(userState)
      if (fixResult.success && fixResult.resolvedUserId) {
        console.log('✅ [BUY] User state fixed! Using resolved user ID:', fixResult.resolvedUserId)
        actualUserId = fixResult.resolvedUserId
      } else {
        console.error('❌ [BUY] Failed to fix user state:', fixResult.error)
        throw new Error(`Cannot proceed with transaction: ${fixResult.error}`)
      }
    } else if (userState.sessionUser?.id) {
      // Use session user ID if everything is consistent
      console.log('✅ [BUY] User state consistent, using session user ID:', userState.sessionUser.id)
      actualUserId = userState.sessionUser.id
    } else {
      throw new Error('Cannot determine user ID for transaction')
    }

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

    // Get bonding curve state from database (since we're using standard SPL tokens)
    const bondingCurve = await this.getBondingCurveFromDatabase(mintAddress.toBase58())
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
      
      // 7. Update database with REAL transaction data
      await this.updateDatabaseAfterBuy(
        signature,
        mintAddress.toBase58(),
        walletService.publicKey.toBase58(),
        Number(solAmountLamports) / LAMPORTS_PER_SOL,
        Number(tokensReceived) / Math.pow(10, 9), // Convert to token units
        bondingCurve, // Use original bonding curve state
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

    // Get bonding curve state from database (since we're using standard SPL tokens)
    const bondingCurve = await this.getBondingCurveFromDatabase(mintAddress.toBase58())
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
      
      // 6. Get updated bonding curve state from database
      const updatedBondingCurve = await this.getBondingCurveFromDatabase(mintAddress.toBase58())
      if (!updatedBondingCurve) {
        throw new Error('Failed to get updated bonding curve state')
      }
      
      // 7. Calculate actual SOL received (from database state)
      const actualSolReceived = updatedBondingCurve.virtualSolReserves - bondingCurve.virtualSolReserves
      
      // 8. Update database with REAL transaction data
      await this.updateDatabaseAfterSell(
        signature,
        mintAddress.toBase58(),
        walletService.publicKey.toBase58(),
        Number(tokenAmountWithDecimals) / Math.pow(10, 9),
        Number(actualSolReceived) / LAMPORTS_PER_SOL,
        updatedBondingCurve
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
    console.log('🔄 Starting database update after buy transaction')
    console.log('📊 Transaction details:', {
      signature,
      mintAddress,
      buyerAddress,
      solAmount,
      tokensReceived
    })

    // Get token and user info
    const { data: token } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint_address', mintAddress)
      .single()
      
    console.log('🎯 Token data retrieved:', token ? `${token.name} (${token.symbol})` : 'Not found')
    
    const { data: { session } } = await supabase.auth.getSession()
    
    console.log('👤 Using resolved user ID:', actualUserId)
    console.log('🔗 Session user metadata:', session?.user?.user_metadata)
    
    if (!token) {
      throw new Error('Token not found')
    }
    
    // The actualUserId has already been verified to exist in database
    console.log('✅ User ID already verified to exist in database')
    
    // Calculate new price from blockchain state
    const newPrice = Number(bondingCurve.virtualSolReserves) / Number(bondingCurve.virtualTokenReserves) / LAMPORTS_PER_SOL
    const newMarketCap = newPrice * token.total_supply
    
    console.log('💰 Price calculation:', {
      newPrice,
      newMarketCap,
      virtualSolReserves: Number(bondingCurve.virtualSolReserves),
      virtualTokenReserves: Number(bondingCurve.virtualTokenReserves)
    })

    // Record transaction in database (with error handling)
    try {
      // Use the passed user ID for all database operations
      console.log('✅ Using resolved user ID for all database operations:', actualUserId)

      const txData = {
        signature, // REAL blockchain signature
        token_id: token.id,
        user_id: actualUserId,
        transaction_type: 'buy',
        sol_amount: Math.round(solAmount * LAMPORTS_PER_SOL), // Convert to lamports as BIGINT
        token_amount: Math.round(tokensReceived * Math.pow(10, 9)), // Convert to token lamports (9 decimals)
        price_per_token: newPrice,
        platform_fee: Math.round(solAmount * 0.01 * LAMPORTS_PER_SOL),
        status: 'pending',
        block_time: new Date().toISOString()
      }
      
      console.log('💾 Saving transaction data:', {
        sol_amount: txData.sol_amount,
        token_amount: txData.token_amount,
        platform_fee: txData.platform_fee,
        user_id: txData.user_id
      })
      
      const { error } = await supabase.from('transactions').insert(txData)
      if (error) throw error
      console.log('✅ Transaction saved to database')
    } catch (error: any) {
      console.error('❌ TRANSACTION SAVE FAILED - ACTUAL ERROR:', error)
      console.error('❌ Error message:', error?.message || 'Unknown')
      console.error('❌ Error details:', error?.details || 'No details')
      console.error('❌ Error hint:', error?.hint || 'No hint')
      console.error('❌ Data that was being saved:', {
        signature,
        token_id: token.id,
        user_id: actualUserId,
        transaction_type: 'buy',
        sol_amount: Math.round(solAmount * LAMPORTS_PER_SOL),
        token_amount: Math.round(tokensReceived * Math.pow(10, 9)),
        platform_fee: Math.round(solAmount * 0.01 * LAMPORTS_PER_SOL)
      })
      // Continue - this doesn't block trading
    }
    
    // Store price history (with error handling)
    try {
      const priceData = {
        token_id: token.id,
        price: newPrice,
        volume: solAmount, // This should be a decimal for price history
        market_cap: Math.round(newMarketCap),
        timestamp: new Date().toISOString()
      }
      
      console.log('💾 Saving price history:', priceData)
      const { error } = await supabase.from('token_price_history').insert(priceData)
      if (error) throw error
      console.log('✅ Price history saved successfully')
    } catch (error: any) {
      console.error('❌ Price history save failed:', error)
      console.log('📊 Price history data:', {
        token_id: token.id,
        price: newPrice,
        volume: solAmount,
        market_cap: Math.round(newMarketCap),
        timestamp: new Date().toISOString()
      })
      // Continue - this doesn't block trading
    }
    
    // Update token statistics (with proper data types for database)
    try {
      // FIX: Convert volume to lamports (bigint) to match database schema
      const currentVolumeLamports = BigInt(token.volume_24h || '0')
      const newVolumeLamports = currentVolumeLamports + BigInt(Math.round(solAmount * LAMPORTS_PER_SOL))
      
      const tokenUpdateData = {
        current_price: newPrice,
        market_cap: Math.round(newMarketCap), // Convert to integer for BIGINT field
        volume_24h: newVolumeLamports.toString(), // Convert to string for bigint field
        last_trade_at: new Date().toISOString()
      }
      
      console.log('💾 Updating token stats:', {
        ...tokenUpdateData,
        volume_24h_explanation: `${currentVolumeLamports} + ${Math.round(solAmount * LAMPORTS_PER_SOL)} = ${newVolumeLamports}`
      })
      
      const { error } = await supabase.from('tokens').update(tokenUpdateData).eq('id', token.id)
      if (error) throw error
      console.log('✅ Token stats updated successfully')
    } catch (error: any) {
      console.error('❌ TOKEN UPDATE FAILED - ACTUAL ERROR:', error)
      console.error('❌ Error message:', error?.message || 'Unknown')
      console.error('❌ Error details:', error?.details || 'No details')
      console.error('❌ Error hint:', error?.hint || 'No hint')
      console.error('❌ Current token volume_24h:', token.volume_24h)
      console.error('❌ SOL amount being added:', solAmount)
      console.error('❌ Lamports being added:', Math.round(solAmount * LAMPORTS_PER_SOL))
      // Continue - this doesn't block trading
    }
    
    // Update user holdings (simplified since user state is now consistent)
    try {
      // Use the passed user ID (already verified to exist in database)
      console.log('👤 Using resolved user ID for holdings update:', actualUserId)
      
      const currentWalletAddress = walletService.publicKey?.toBase58() || 'unknown'
      console.log('🔍 Current wallet address:', currentWalletAddress)
      
      console.log('🔍 Searching for existing user holdings...')
      // Try to get existing holding
      const { data: existingHolding, error: selectError } = await supabase
        .from('user_holdings')
        .select('*')
        .eq('user_id', actualUserId)
        .eq('token_id', token.id)
        .single()
      
      console.log('📊 Holdings query result:', {
        found: !!existingHolding,
        error: selectError?.message,
        errorCode: selectError?.code
      })
      
      // Note: .single() returns error if no rows found, but that's expected for new users
      if (selectError && selectError.code !== 'PGRST116') {
        console.error('❌ Unexpected holdings query error:', selectError)
        throw selectError
      }

      const tokenAmountLamports = Math.round(tokensReceived * Math.pow(10, 9)) // Convert to token lamports

      if (existingHolding) {
        // Update existing holding
        const currentAmount = parseInt(existingHolding.amount || '0')
        const newAmount = currentAmount + tokenAmountLamports

        console.log('💾 Updating existing user holding:', {
          holdingId: existingHolding.id,
          currentAmount,
          tokensReceived,
          tokenAmountLamports,
          newAmount
        })

        const { error: updateError } = await supabase
          .from('user_holdings')
          .update({
            amount: newAmount.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingHolding.id)
        
        if (updateError) {
          console.error('❌ Holdings update failed:', updateError)
          throw updateError
        }
        console.log('✅ Existing holding updated successfully')
      } else {
        // Create new holding
        console.log('💾 Creating new user holding:', {
          userId: actualUserId,
          tokenId: token.id,
          amount: tokenAmountLamports,
          walletAddress: currentWalletAddress
        })

        const { error: insertError } = await supabase
          .from('user_holdings')
          .insert({
            user_id: actualUserId,
            token_id: token.id,
            amount: tokenAmountLamports.toString()
          })
        
        if (insertError) {
          console.error('❌ Holdings insert failed:', insertError)
          console.error('❌ RLS Policy debugging info:')
          console.error('  - User ID being inserted:', actualUserId)
          console.error('  - Token ID being inserted:', token.id)
          console.error('  - Current user ID:', actualUserId)
          console.error('  - Session metadata:', session?.user?.user_metadata)
          throw insertError
        }
        console.log('✅ New holding created successfully')
      }
      console.log('✅ User holdings updated successfully')
    } catch (error: any) {
      console.error('❌ USER HOLDINGS UPDATE FAILED - ACTUAL ERROR:', error)
      console.error('❌ Error message:', error?.message || 'Unknown')
      console.error('❌ Error details:', error?.details || 'No details')
      console.error('❌ Error hint:', error?.hint || 'No hint')
      console.error('❌ Error code:', error?.code || 'No code')
      console.error('❌ User ID:', actualUserId)
      console.error('❌ Token ID:', token.id)
      console.error('❌ Token amount (lamports):', Math.round(tokensReceived * Math.pow(10, 9)))
              console.error('❌ User ID:', actualUserId)
      console.error('❌ Current wallet:', walletService.publicKey?.toBase58())
      // Continue - trading still works even if database fails
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
      transaction_type: 'sell',
      sol_amount: solReceived,
      token_amount: tokensSold,
      price_per_token: newPrice,
      bonding_curve_price: newPrice,
      platform_fee: solReceived * 0.01,
      status: 'completed',
      block_time: new Date().toISOString()
    })
    
    // Store price history
    await supabase.from('token_price_history').insert({
      token_id: token.id,
      price: newPrice,
      volume: solReceived,
      market_cap: newMarketCap,
      timestamp: new Date().toISOString()
    })
    
    // Update token statistics
    await supabase.from('tokens').update({
      current_price: newPrice,
      market_cap: newMarketCap,
      volume_24h: (token.volume_24h || 0) + solReceived,
      last_trade_at: new Date().toISOString(),
      virtual_sol_reserves: bondingCurve.virtualSolReserves.toString(),
      virtual_token_reserves: bondingCurve.virtualTokenReserves.toString()
    }).eq('id', token.id)
    
    // Update user holdings
    const { data: holding } = await supabase
      .from('user_holdings')
      .select('*')
      .eq('user_id', userId)
      .eq('token_id', token.id)
      .single()

    if (holding) {
      const currentAmount = parseFloat(holding.amount)
      const newAmount = currentAmount - tokensSold
      
      if (newAmount <= 0) {
        // Delete holding if no tokens left
        await supabase
          .from('user_holdings')
          .delete()
          .eq('id', holding.id)
      } else {
        // Update holding amount
        await supabase
          .from('user_holdings')
          .update({
            amount: newAmount.toString(),
            last_updated: new Date().toISOString()
          })
          .eq('id', holding.id)
      }
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