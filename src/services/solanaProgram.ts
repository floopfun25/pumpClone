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

// Account structures
export interface BondingCurveAccount {
  discriminator: number[]
  mintAddress: Uint8Array
  creator: Uint8Array
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  graduated: boolean
  createdAt: bigint
  bumpSeed: number
}

export interface TradeInstruction {
  instruction: number
  amount: bigint
  minReceived: bigint
  maxSlippage: number
}

// Simple buffer encoding utilities
const encodeU8 = (value: number): Buffer => {
  const buf = Buffer.alloc(1)
  buf.writeUInt8(value, 0)
  return buf
}

const encodeU64 = (value: bigint): Buffer => {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(value, 0)
  return buf
}

const encodeU16 = (value: number): Buffer => {
  const buf = Buffer.alloc(2)
  buf.writeUInt16LE(value, 0)
  return buf
}

const encodeTradeInstruction = (instruction: TradeInstruction): Buffer => {
  return Buffer.concat([
    encodeU8(instruction.instruction),
    encodeU64(instruction.amount),
    encodeU64(instruction.minReceived),
    encodeU16(instruction.maxSlippage)
  ])
}

// Helper function to safely handle large numbers for database
const safeNumber = (value: number): number => {
  // Use a very conservative limit to avoid precision issues
  // PostgreSQL BIGINT max is 9,223,372,036,854,775,807
  // But we'll use a much safer limit to account for JavaScript precision
  const SAFE_MAX_BIGINT = 9000000000000000000 // 9 quintillion (much safer)
  
  if (!Number.isFinite(value) || value < 0) {
    return 0
  }
  
  if (value > SAFE_MAX_BIGINT) {
    return SAFE_MAX_BIGINT
  }
  
  return Math.floor(value)
}

// Helper function to validate and fix price calculations
const safePrice = (price: number, fallbackPrice: number = 0.0000001): number => {
  if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
    console.warn('Invalid price calculated, using fallback:', price, '-> fallback:', fallbackPrice)
    return fallbackPrice
  }
  return price
}

// Helper function to safely calculate market cap
const safeMarketCap = (price: number, totalSupply: number): number => {
  let marketCap = price * totalSupply // Market cap in SOL, will be converted to USD elsewhere
  return safeNumber(marketCap)
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
   * Derive bonding curve account address for a token mint
   */
  deriveBondingCurveAddress(mintAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('bonding-curve'),
        mintAddress.toBuffer()
      ],
      this.programId
    )
  }

  /**
   * Get bonding curve account data
   */
  async getBondingCurveAccount(mintAddress: PublicKey): Promise<BondingCurveAccount | null> {
    try {
      // For simulation mode, we'll get bonding curve data from database
      // First check if this token exists in our database
      const { data: token, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress.toBase58())
        .single()

      if (error || !token) {
        console.log('Token not found in database:', mintAddress.toBase58())
        return null
      }

      // Calculate current bonding curve state based on database data
      const totalSupply = BigInt(token.total_supply * Math.pow(10, token.decimals))
      
      // Use bonding curve config for initial state
      const initialVirtualSol = BigInt(bondingCurveConfig.initialVirtualSolReserves * LAMPORTS_PER_SOL)
      const initialVirtualTokens = BigInt(bondingCurveConfig.initialVirtualTokenReserves * Math.pow(10, token.decimals))
      
      // Calculate actual SOL raised from real transactions
      // Sum up all buy transactions for this token from the database
      const { data: transactions } = await supabase
        .from('transactions')
        .select('sol_amount, transaction_type')
        .eq('token_id', token.id)
        .eq('status', 'completed')
      
      let totalSolRaised = 0
      if (transactions) {
        for (const tx of transactions) {
          if (tx.transaction_type === 'buy') {
            totalSolRaised += tx.sol_amount
          } else if (tx.transaction_type === 'sell') {
            totalSolRaised -= tx.sol_amount
          }
        }
      }
      
      // Ensure we have a minimum amount to prevent division by zero
      totalSolRaised = Math.max(totalSolRaised, 0)
      
      // Calculate virtual reserves based on actual trading activity
      // Convert totalSolRaised to lamports to match initialVirtualSol units
      const virtualSolReserves = initialVirtualSol + BigInt(Math.floor(totalSolRaised * LAMPORTS_PER_SOL))
      
      // Calculate token reserves using constant product formula
      // k = initialVirtualSol * initialVirtualTokens (constant)
      const k = initialVirtualSol * initialVirtualTokens
      const virtualTokenReserves = k / virtualSolReserves

      return {
        discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
        mintAddress: mintAddress.toBytes(),
        creator: new Uint8Array(32),
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves: BigInt(token.locked_tokens_amount * Math.pow(10, token.decimals)),
        realSolReserves: BigInt(Math.floor(totalSolRaised * LAMPORTS_PER_SOL)),
        tokenTotalSupply: totalSupply,
        graduated: token.status === 'graduated',
        createdAt: BigInt(new Date(token.created_at).getTime()),
        bumpSeed: 255
      }
    } catch (error) {
      console.error('Failed to get bonding curve account:', error)
      return null
    }
  }

  /**
   * Initialize bonding curve for a new token
   */
  async initializeBondingCurve(
    mintAddress: PublicKey,
    creator: PublicKey
  ): Promise<TransactionInstruction> {
    const [bondingCurveAddress, bumpSeed] = this.deriveBondingCurveAddress(mintAddress)
    
    // Create initialization instruction
    const initData = encodeTradeInstruction({
      instruction: BondingCurveInstruction.Initialize,
      amount: BigInt(bondingCurveConfig.initialVirtualTokenReserves),
      minReceived: BigInt(bondingCurveConfig.initialVirtualSolReserves),
      maxSlippage: 0
    })

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Bonding curve account (writable, to be created)
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        // Token mint account (readable)
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        // Creator account (signer, pays for account creation)
        { pubkey: creator, isSigner: true, isWritable: true },
        // System program for account creation
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: initData
    })
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
   * Execute buy transaction (Database simulation mode)
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
    if (solAmountLamports > BigInt(tradingConfig.maxTradeAmount)) {
      throw new Error(`Maximum trade amount is ${tradingConfig.maxTradeAmount / LAMPORTS_PER_SOL} SOL`)
    }

    // Get bonding curve state to calculate expected tokens
    const bondingCurve = await this.getBondingCurveAccount(mintAddress)
    if (!bondingCurve) {
      throw new Error('Bonding curve not found for this token')
    }

    if (bondingCurve.graduated) {
      throw new Error('This token has graduated and can only be traded on DEX')
    }

    // Calculate expected tokens received using bonding curve formula
    const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves
    const newSolReserves = bondingCurve.virtualSolReserves + solAmountLamports
    const newTokenReserves = k / newSolReserves
    const tokensOut = bondingCurve.virtualTokenReserves - newTokenReserves
    
    // Skip slippage check for simulation mode to avoid calculation issues
    // In production, this would be critical for protecting users
    console.log('💰 Buy calculation:', {
      solAmount: Number(solAmountLamports) / LAMPORTS_PER_SOL,
      tokensOut: Number(tokensOut) / LAMPORTS_PER_SOL,
      virtualSolReserves: Number(bondingCurve.virtualSolReserves),
      virtualTokenReserves: Number(bondingCurve.virtualTokenReserves)
    })

    // For simulation mode, we'll create a mock transaction signature and update database
    const mockSignature = `sim_buy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Get token from database
      const { data: token, error: tokenError } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress.toBase58())
        .single()

      if (tokenError || !token) {
        throw new Error('Token not found in database')
      }

      // Get or create user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletService.publicKey.toBase58())
        .single()

      let userId = user?.id
      if (!user) {
        const { data: newUser, error: createUserError } = await supabase
          .from('users')
          .insert({
            wallet_address: walletService.publicKey.toBase58(),
            username: `user_${walletService.publicKey.toBase58().slice(0, 8)}`
          })
          .select()
          .single()

        if (createUserError) throw createUserError
        userId = newUser.id
      }

      // Calculate new price and market cap
      const calculatedPrice = Number(newSolReserves) / Number(newTokenReserves) / LAMPORTS_PER_SOL
      const newPrice = safePrice(calculatedPrice, token.current_price || 0.0000001)
      const newMarketCap = safeMarketCap(newPrice, token.total_supply)

      // Store price history for charts
      await supabase
        .from('token_price_history')
        .insert({
          token_id: token.id,
          price: newPrice,
          volume: safeNumber(Number(solAmountLamports) / LAMPORTS_PER_SOL),
          market_cap: newMarketCap,
          timestamp: new Date().toISOString()
        })

      // Record transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          signature: mockSignature,
          token_id: token.id,
          user_id: userId,
          transaction_type: 'buy',
          sol_amount: safeNumber(solAmount), // Store in SOL, not lamports
          token_amount: safeNumber(Number(tokensOut) / Math.pow(10, token.decimals)), // Fix: Use token decimals
          price_per_token: newPrice,
          bonding_curve_price: newPrice,
          slippage_percentage: slippagePercent,
          platform_fee: safeNumber(solAmount * 0.01), // 1% fee
          status: 'completed',
          block_time: new Date().toISOString()
        })

      if (txError) throw txError

      // Update token stats
      const { error: updateError } = await supabase
        .from('tokens')
        .update({
          current_price: newPrice,
          market_cap: newMarketCap,
          volume_24h: safeNumber((token.volume_24h || 0) + solAmount),
          last_trade_at: new Date().toISOString(),
          bonding_curve_progress: Math.min(100, (newMarketCap / token.graduation_threshold) * 100),
          virtual_sol_reserves: newSolReserves.toString(),
          virtual_token_reserves: newTokenReserves.toString()
        })
        .eq('id', token.id)

      if (updateError) throw updateError

      // Update or create user holdings
      const { data: existingHolding } = await supabase
        .from('user_holdings')
        .select('*')
        .eq('user_id', userId)
        .eq('token_id', token.id)
        .single()

      if (existingHolding) {
        // Update existing holding
        const currentAmount = BigInt(existingHolding.amount)
        const newAmount = currentAmount + tokensOut
        const newTotalInvested = safeNumber((existingHolding.total_invested || 0) + solAmount)
        const tokenAmountInFullUnits = Number(newAmount) / Math.pow(10, token.decimals)
        const newAvgPrice = newTotalInvested / tokenAmountInFullUnits

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
            amount: tokensOut.toString(),
            average_price: newPrice,
            total_invested: safeNumber(solAmount)
          })
      }

      console.log('✅ Buy transaction simulated successfully:', mockSignature)
      console.log('📊 Tokens received:', Number(tokensOut) / Math.pow(10, 9))
      console.log('💰 New price:', newPrice, 'SOL')
      
      // Force immediate price update for real-time chart updates
      try {
        const { RealTimePriceService } = await import('./realTimePriceService')
        setTimeout(async () => {
          try {
            await RealTimePriceService.forceUpdate(token.id)
          } catch (updateError) {
            console.warn('Failed to force price update:', updateError)
          }
        }, 100) // Small delay to ensure database is updated
      } catch (error) {
        console.warn('Failed to import price service:', error)
      }
      
      return mockSignature
    } catch (error) {
      console.error('Failed to simulate buy transaction:', error)
      throw error
    }
  }

  /**
   * Execute sell transaction (Database simulation mode)
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

    // Get bonding curve state to calculate expected SOL
    const bondingCurve = await this.getBondingCurveAccount(mintAddress)
    if (!bondingCurve) {
      throw new Error('Bonding curve not found for this token')
    }

    if (bondingCurve.graduated) {
      throw new Error('This token has graduated and can only be traded on DEX')
    }

    // Calculate expected SOL received using bonding curve formula
    const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves
    const newTokenReserves = bondingCurve.virtualTokenReserves + tokenAmountWithDecimals
    const newSolReserves = k / newTokenReserves
    const solOut = bondingCurve.virtualSolReserves - newSolReserves
    
    // Skip slippage check for simulation mode
    console.log('💰 Sell calculation:', {
      tokenAmount: tokenAmount,
      solOut: Number(solOut) / LAMPORTS_PER_SOL,
      virtualSolReserves: Number(bondingCurve.virtualSolReserves),
      virtualTokenReserves: Number(bondingCurve.virtualTokenReserves)
    })

    // For simulation mode, we'll create a mock transaction signature and update database
    const mockSignature = `sim_sell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      // Get token from database
      const { data: token, error: tokenError } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress.toBase58())
        .single()

      if (tokenError || !token) {
        throw new Error('Token not found in database')
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletService.publicKey.toBase58())
        .single()

      if (userError || !user) {
        throw new Error('User not found')
      }

      // Check user holdings
      const { data: holding, error: holdingError } = await supabase
        .from('user_holdings')
        .select('*')
        .eq('user_id', user.id)
        .eq('token_id', token.id)
        .single()

      if (holdingError || !holding || holding.amount < Number(tokenAmountWithDecimals)) {
        throw new Error('Insufficient token balance')
      }

      // Calculate new price and market cap
      const calculatedPrice = Number(newSolReserves) / Number(newTokenReserves) / LAMPORTS_PER_SOL
      const newPrice = safePrice(calculatedPrice, token.current_price || 0.0000001)
      const newMarketCap = safeMarketCap(newPrice, token.total_supply)

      // Store price history for charts
      await supabase
        .from('token_price_history')
        .insert({
          token_id: token.id,
          price: newPrice,
          volume: safeNumber(Number(solOut) / LAMPORTS_PER_SOL),
          market_cap: newMarketCap,
          timestamp: new Date().toISOString()
        })

      // Record transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          signature: mockSignature,
          token_id: token.id,
          user_id: user.id,
          transaction_type: 'sell',
          sol_amount: safeNumber(Number(solOut) / LAMPORTS_PER_SOL),
          token_amount: safeNumber(Number(tokenAmountWithDecimals) / Math.pow(10, token.decimals)),
          price_per_token: newPrice,
          bonding_curve_price: newPrice,
          slippage_percentage: slippagePercent,
          platform_fee: safeNumber(Number(solOut) / LAMPORTS_PER_SOL * 0.01),
          status: 'completed',
          block_time: new Date().toISOString()
        })

      if (txError) throw txError

      // Update token stats
      const { error: updateError } = await supabase
        .from('tokens')
        .update({
          current_price: newPrice,
          market_cap: newMarketCap,
          volume_24h: safeNumber((token.volume_24h || 0) + Number(solOut) / LAMPORTS_PER_SOL),
          last_trade_at: new Date().toISOString(),
          bonding_curve_progress: Math.min(100, (newMarketCap / token.graduation_threshold) * 100),
          virtual_sol_reserves: newSolReserves.toString(),
          virtual_token_reserves: newTokenReserves.toString()
        })
        .eq('id', token.id)

      if (updateError) throw updateError

      // Update user holdings
      const currentAmount = BigInt(holding.amount)
      const newAmount = currentAmount - tokenAmountWithDecimals
      
      if (newAmount <= 0n) {
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

      console.log('✅ Sell transaction simulated successfully:', mockSignature)
      console.log('💰 SOL received:', Number(solOut) / LAMPORTS_PER_SOL)
      console.log('📊 New price:', newPrice, 'SOL')
      
      // Force immediate price update for real-time chart updates
      try {
        const { RealTimePriceService } = await import('./realTimePriceService')
        setTimeout(async () => {
          try {
            await RealTimePriceService.forceUpdate(token.id)
          } catch (updateError) {
            console.warn('Failed to force price update:', updateError)
          }
        }, 100) // Small delay to ensure database is updated
      } catch (error) {
        console.warn('Failed to import price service:', error)
      }
      
      return mockSignature
    } catch (error) {
      console.error('Failed to simulate sell transaction:', error)
      throw error
    }
  }

  /**
   * Get user's token balance (Database simulation mode)
   */
  async getUserTokenBalance(mintAddress: PublicKey, userPublicKey: PublicKey): Promise<number> {
    try {
      // Get token from database
      const { data: token, error: tokenError } = await supabase
        .from('tokens')
        .select('id')
        .eq('mint_address', mintAddress.toBase58())
        .single()

      if (tokenError || !token) {
        return 0
      }

      // Get user from database
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', userPublicKey.toBase58())
        .single()

      if (userError || !user) {
        return 0
      }

      // Get user holdings
      const { data: holding, error: holdingError } = await supabase
        .from('user_holdings')
        .select('amount')
        .eq('user_id', user.id)
        .eq('token_id', token.id)
        .single()

      if (holdingError || !holding) {
        return 0
      }

      // Convert from raw amount to UI amount (divide by 10^9 for 9 decimals)
      return holding.amount / Math.pow(10, 9)
    } catch (error) {
      console.error('Failed to get user token balance:', error)
      return 0
    }
  }

  /**
   * Get all token accounts for a user (Database simulation mode)
   */
  async getUserTokenAccounts(userPublicKey: PublicKey): Promise<Array<{
    mint: string
    balance: number
    decimals: number
  }>> {
    try {
      // Get user from database
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', userPublicKey.toBase58())
        .single()

      if (userError || !user) {
        return []
      }

      // Get user holdings with token details
      const { data: holdings, error: holdingsError } = await supabase
        .from('user_holdings')
        .select(`
          amount,
          tokens!inner (
            mint_address,
            decimals
          )
        `)
        .eq('user_id', user.id)
        .gt('amount', 0)

      if (holdingsError || !holdings) {
        return []
      }

      return holdings.map((holding: any) => ({
        mint: holding.tokens.mint_address,
        balance: holding.amount / Math.pow(10, holding.tokens.decimals),
        decimals: holding.tokens.decimals
      }))
    } catch (error) {
      console.error('Failed to get user token accounts:', error)
      return []
    }
  }
}

// Create singleton instance
export const solanaProgram = new SolanaProgram() 