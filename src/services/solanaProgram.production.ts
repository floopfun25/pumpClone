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
    const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
    
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

    // Create buy instruction data
    const buyData = encodeTradeInstruction({
      instruction: BondingCurveInstruction.Buy,
      amount: solAmount,
      minReceived: minTokensReceived,
      maxSlippage: slippageBps
    })

    // Add buy instruction
    instructions.push(new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Bonding curve account (writable)
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        // Token mint account (writable for minting)
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        // Buyer account (signer, pays SOL)
        { pubkey: buyer, isSigner: true, isWritable: true },
        // Buyer's token account (writable, receives tokens)
        { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
        // Platform fee wallet (receives fees)
        { pubkey: this.feeWallet, isSigner: false, isWritable: true },
        // Token program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: buyData
    }))

    return instructions
  }

  /**
   * Create sell transaction instruction
   */
  async createSellInstruction(
    mintAddress: PublicKey,
    seller: PublicKey,
    tokenAmount: bigint,
    minSolReceived: bigint,
    slippageBps: number = tradingConfig.slippageToleranceDefault * 100
  ): Promise<TransactionInstruction[]> {
    const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
    
    // Get seller's associated token account
    const sellerTokenAccount = await getAssociatedTokenAddress(mintAddress, seller)
    
    // Create sell instruction data
    const sellData = encodeTradeInstruction({
      instruction: BondingCurveInstruction.Sell,
      amount: tokenAmount,
      minReceived: minSolReceived,
      maxSlippage: slippageBps
    })

    return [new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Bonding curve account (writable)
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        // Token mint account (readable)
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        // Seller account (signer, receives SOL)
        { pubkey: seller, isSigner: true, isWritable: true },
        // Seller's token account (writable, tokens burned from here)
        { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
        // Platform fee wallet (receives fees)
        { pubkey: this.feeWallet, isSigner: false, isWritable: true },
        // Token program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: sellData
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
    if (!walletService.connected || !walletService.publicKey) {
      throw new Error('Wallet not connected')
    }

    // Validate trade amount
    const solAmountLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL))
    if (solAmountLamports < BigInt(tradingConfig.minTradeAmount)) {
      throw new Error(`Minimum trade amount is ${tradingConfig.minTradeAmount / LAMPORTS_PER_SOL} SOL`)
    }
    // Removed maxTradeAmount restriction

    // Get bonding curve state from blockchain
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
      
      // 6. Get updated bonding curve state from blockchain
      const updatedBondingCurve = await this.getBondingCurveAccount(mintAddress)
      if (!updatedBondingCurve) {
        throw new Error('Failed to get updated bonding curve state')
      }
      
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
      console.log('📊 Tokens received:', Number(actualTokensReceived) / Math.pow(10, 9))
      
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

    // Get bonding curve state from blockchain
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
      
      // 6. Get updated bonding curve state from blockchain
      const updatedBondingCurve = await this.getBondingCurveAccount(mintAddress)
      if (!updatedBondingCurve) {
        throw new Error('Failed to get updated bonding curve state')
      }
      
      // 7. Calculate actual SOL received (from blockchain state)
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
      transaction_type: 'buy',
      sol_amount: solAmount,
      token_amount: tokensReceived,
      price_per_token: newPrice,
      bonding_curve_price: newPrice,
      platform_fee: solAmount * 0.01,
      status: 'completed',
      block_time: new Date().toISOString()
    })
    
    // Store price history
    await supabase.from('token_price_history').insert({
      token_id: token.id,
      price: newPrice,
      volume: solAmount,
      market_cap: newMarketCap,
      timestamp: new Date().toISOString()
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
    const { data: existingHolding } = await supabase
      .from('user_holdings')
      .select('*')
      .eq('user_id', userId)
      .eq('token_id', token.id)
      .single()

    if (existingHolding) {
      // Update existing holding
      const currentAmount = parseFloat(existingHolding.amount)
      const newAmount = currentAmount + tokensReceived
      const newTotalInvested = (existingHolding.total_invested || 0) + solAmount
      const newAvgPrice = newTotalInvested / newAmount

      await supabase
        .from('user_holdings')
        .update({
          amount: newAmount.toString(),
          average_price: newAvgPrice,
          total_invested: newTotalInvested,
          last_updated: new Date().toISOString()
        })
        .eq('id', existingHolding.id)
    } else {
      // Create new holding
      await supabase
        .from('user_holdings')
        .insert({
          user_id: userId,
          token_id: token.id,
          amount: tokensReceived.toString(),
          average_price: newPrice,
          total_invested: solAmount
        })
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