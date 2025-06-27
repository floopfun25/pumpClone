import { PublicKey } from '@solana/web3.js'
import { bondingCurveConfig, tokenDefaults } from '@/config'
import { SupabaseService } from './supabase'

// Bonding curve types
export interface BondingCurveState {
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  complete: boolean
}

export interface TradeResult {
  tokensOut: bigint
  solOut: bigint
  priceImpact: number
  newPrice: number
  fees: bigint
  // Enhanced fields for new implementation
  tokensReceived?: number
  solSpent?: number
  newSupply?: number
  platformFee?: number
}

export interface BondingCurveProgress {
  progress: number // 0-100
  solRequired: number
  tokensRemaining: bigint
  graduated: boolean
}

export interface BondingCurveConfig {
  initialPrice: number
  targetPrice: number
  maxSupply: number
  currentSupply: number
  reserveRatio: number
}

export interface PriceCalculation {
  price: number
  marketCap: number
  priceImpact: number
  slippage: number
}

export interface EnhancedTradeResult {
  newPrice: number
  newSupply: number
  tokensReceived: number
  solSpent: number
  priceImpact: number
  platformFee: number
}

// Constants based on pump.fun's implementation
const INITIAL_VIRTUAL_TOKEN_RESERVES = BigInt(bondingCurveConfig.initialVirtualTokenReserves)
const INITIAL_VIRTUAL_SOL_RESERVES = BigInt(bondingCurveConfig.initialVirtualSolReserves)
const INITIAL_REAL_SOL_RESERVES = BigInt(bondingCurveConfig.initialRealSolReserves)

// Platform fee in basis points (100 = 1%)
const PLATFORM_FEE_BPS = 100
const BASIS_POINTS = 10000

// Total tokens for bonding curve (80% of total supply)
const BONDING_CURVE_TOKENS = BigInt(tokenDefaults.totalSupply * 0.8)

// Graduation threshold ($69K in USD market cap)
const GRADUATION_THRESHOLD_USD = 69_000 // $69K market cap

// Graduation mechanics
const GRADUATION_LIQUIDITY_USD = 12_000 // $12K liquidity to Raydium
const CREATOR_REWARD_SOL = 0.5 // 0.5 SOL to creator
const PLATFORM_FEE_SOL = 6.0 // 6 SOL platform fee

export class BondingCurveService {
  // Enhanced bonding curve parameters for pump.fun style
  private static readonly INITIAL_VIRTUAL_SOL_RESERVES = 30 // 30 SOL
  private static readonly INITIAL_VIRTUAL_TOKEN_RESERVES = 1073000000 // ~1.073B tokens
  private static readonly INITIAL_REAL_TOKEN_RESERVES = 793100000 // ~793M tokens
  private static readonly TARGET_SOL_RAISED = 85 // 85 SOL to graduate
  private static readonly PLATFORM_FEE = 0.01 // 1% platform fee

  /**
   * Calculate the current token price based on reserves (original method)
   */
  static calculatePrice(state: BondingCurveState): number {
    if (state.virtualTokenReserves <= 0n || state.virtualSolReserves <= 0n) {
      return 0
    }

    // Price = SOL reserves / Token reserves
    const solReserves = Number(state.virtualSolReserves) / 1e9 // Convert lamports to SOL
    const tokenReserves = Number(state.virtualTokenReserves) / 1e6 // Convert to token decimals

    return solReserves / tokenReserves
  }

  /**
   * Calculate price using virtual reserves (enhanced method)
   */
  static calculatePriceFromReserves(virtualSolReserves: number, virtualTokenReserves: number): number {
    if (virtualTokenReserves <= 0) return 0
    return virtualSolReserves / virtualTokenReserves
  }

  /**
   * Calculate market cap based on current price and total supply (in USD)
   */
  static calculateMarketCap(state: BondingCurveState, solPriceUSD: number = 169): number {
    const tokenPrice = this.calculatePrice(state)
    // Use the full total supply - it's already stored as the actual number of tokens
    const totalSupply = Number(state.tokenTotalSupply)
    
    const marketCapSOL = tokenPrice * totalSupply
    return marketCapSOL * solPriceUSD // Market cap in USD
  }

  /**
   * Calculate bonding curve progress (0-100%)
   */
  static calculateProgress(state: BondingCurveState): BondingCurveProgress {
    const tokensRemaining = state.realTokenReserves
    const totalTokens = BONDING_CURVE_TOKENS
    const tokensSold = totalTokens - tokensRemaining

    const progress = Math.min(100, (Number(tokensSold) / Number(totalTokens)) * 100)
    
    // Calculate SOL required for graduation
    const solRequired = this.calculateSolForTokens(state, tokensRemaining)
    
    return {
      progress,
      solRequired,
      tokensRemaining,
      graduated: state.complete || progress >= 100
    }
  }

  /**
   * Calculate tokens received for SOL input (buy) - original method
   */
  static calculateBuy(state: BondingCurveState, solIn: bigint): TradeResult {
    if (solIn <= 0n) {
      throw new Error('SOL input must be positive')
    }

    if (state.complete) {
      throw new Error('Bonding curve is complete')
    }

    // Calculate platform fee
    const fees = (solIn * BigInt(PLATFORM_FEE_BPS)) / BigInt(BASIS_POINTS)
    const solAfterFees = solIn - fees

    // Constant product: k = virtualSolReserves * virtualTokenReserves
    const k = state.virtualSolReserves * state.virtualTokenReserves

    // New SOL reserves after adding input
    const newVirtualSolReserves = state.virtualSolReserves + solAfterFees

    // Calculate new token reserves: newTokenReserves = k / newSolReserves
    const newVirtualTokenReserves = k / newVirtualSolReserves

    // Tokens to output
    const tokensOut = state.virtualTokenReserves - newVirtualTokenReserves

    // Check if we have enough real tokens
    if (tokensOut > state.realTokenReserves) {
      throw new Error('Insufficient token reserves')
    }

    // Calculate price impact
    const oldPrice = this.calculatePrice(state)
    const newState: BondingCurveState = {
      ...state,
      virtualSolReserves: newVirtualSolReserves,
      virtualTokenReserves: newVirtualTokenReserves,
      realTokenReserves: state.realTokenReserves - tokensOut,
      realSolReserves: state.realSolReserves + solAfterFees
    }
    const newPrice = this.calculatePrice(newState)
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100

    return {
      tokensOut,
      solOut: 0n,
      priceImpact,
      newPrice,
      fees,
      tokensReceived: Number(tokensOut) / 1e6,
      solSpent: Number(solIn) / 1e9,
      platformFee: Number(fees) / 1e9
    }
  }

  /**
   * Enhanced buy trade calculation
   */
  static calculateBuyTrade(
    solAmount: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    realTokenReserves: number
  ): EnhancedTradeResult {
    // Apply platform fee
    const platformFee = solAmount * this.PLATFORM_FEE
    const effectiveSolAmount = solAmount - platformFee

    // Calculate tokens received using constant product formula
    const tokensReceived = (virtualTokenReserves * effectiveSolAmount) / (virtualSolReserves + effectiveSolAmount)

    // Update reserves
    const newVirtualSolReserves = virtualSolReserves + effectiveSolAmount
    const newVirtualTokenReserves = virtualTokenReserves - tokensReceived
    const newRealTokenReserves = realTokenReserves - tokensReceived

    // Calculate new price
    const oldPrice = this.calculatePriceFromReserves(virtualSolReserves, virtualTokenReserves)
    const newPrice = this.calculatePriceFromReserves(newVirtualSolReserves, newVirtualTokenReserves)

    // Calculate price impact
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100

    return {
      newPrice,
      newSupply: this.INITIAL_REAL_TOKEN_RESERVES - newRealTokenReserves,
      tokensReceived,
      solSpent: solAmount,
      priceImpact,
      platformFee
    }
  }

  /**
   * Calculate SOL received for token input (sell) - original method
   */
  static calculateSell(state: BondingCurveState, tokensIn: bigint): TradeResult {
    if (tokensIn <= 0n) {
      throw new Error('Token input must be positive')
    }

    if (state.complete) {
      throw new Error('Bonding curve is complete')
    }

    // Constant product: k = virtualSolReserves * virtualTokenReserves
    const k = state.virtualSolReserves * state.virtualTokenReserves

    // New token reserves after adding tokens
    const newVirtualTokenReserves = state.virtualTokenReserves + tokensIn

    // Calculate new SOL reserves: newSolReserves = k / newTokenReserves
    const newVirtualSolReserves = k / newVirtualTokenReserves

    // SOL to output (before fees)
    const solOut = state.virtualSolReserves - newVirtualSolReserves

    // Check if we have enough real SOL
    if (solOut > state.realSolReserves) {
      throw new Error('Insufficient SOL reserves')
    }

    // Calculate platform fee
    const fees = (solOut * BigInt(PLATFORM_FEE_BPS)) / BigInt(BASIS_POINTS)
    const solAfterFees = solOut - fees

    // Calculate price impact
    const oldPrice = this.calculatePrice(state)
    const newState: BondingCurveState = {
      ...state,
      virtualSolReserves: newVirtualSolReserves,
      virtualTokenReserves: newVirtualTokenReserves,
      realTokenReserves: state.realTokenReserves + tokensIn,
      realSolReserves: state.realSolReserves - solOut
    }
    const newPrice = this.calculatePrice(newState)
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100

    return {
      tokensOut: 0n,
      solOut: solAfterFees,
      priceImpact,
      newPrice,
      fees,
      tokensReceived: -Number(tokensIn) / 1e6,
      solSpent: -Number(solAfterFees) / 1e9,
      platformFee: Number(fees) / 1e9
    }
  }

  /**
   * Enhanced sell trade calculation
   */
  static calculateSellTrade(
    tokenAmount: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    realTokenReserves: number
  ): EnhancedTradeResult {
    // Calculate SOL received using constant product formula
    const solReceived = (virtualSolReserves * tokenAmount) / (virtualTokenReserves + tokenAmount)

    // Apply platform fee
    const platformFee = solReceived * this.PLATFORM_FEE
    const effectiveSolReceived = solReceived - platformFee

    // Update reserves
    const newVirtualSolReserves = virtualSolReserves - solReceived
    const newVirtualTokenReserves = virtualTokenReserves + tokenAmount
    const newRealTokenReserves = realTokenReserves + tokenAmount

    // Calculate new price
    const oldPrice = this.calculatePriceFromReserves(virtualSolReserves, virtualTokenReserves)
    const newPrice = this.calculatePriceFromReserves(newVirtualSolReserves, newVirtualTokenReserves)

    // Calculate price impact (negative for sells)
    const priceImpact = ((newPrice - oldPrice) / oldPrice) * 100

    return {
      newPrice,
      newSupply: this.INITIAL_REAL_TOKEN_RESERVES - newRealTokenReserves,
      tokensReceived: -tokenAmount, // Negative because selling
      solSpent: -effectiveSolReceived, // Negative because receiving
      priceImpact,
      platformFee
    }
  }

  /**
   * Get current bonding curve state for a token
   */
  static async getTokenBondingCurveState(tokenId: string): Promise<{
    virtualSolReserves: number
    virtualTokenReserves: number
    realTokenReserves: number
    currentPrice: number
    marketCap: number
    progress: number
    isGraduated: boolean
  }> {
    try {
      const token = await SupabaseService.getTokenById(tokenId)
      if (!token) {
        throw new Error('Token not found')
      }

      // Get total SOL raised from transactions
      const transactions = await SupabaseService.getTokenTransactions(tokenId, 1000)
      const totalSolRaised = transactions
        .filter(tx => tx.transaction_type === 'buy')
        .reduce((sum, tx) => sum + (tx.sol_amount || 0), 0) // Already in SOL, no conversion needed

      // Calculate current reserves
      const virtualSolReserves = this.INITIAL_VIRTUAL_SOL_RESERVES + totalSolRaised
      const tokensSold = transactions
        .reduce((sum, tx) => {
          if (tx.transaction_type === 'buy') {
            return sum + (tx.token_amount || 0) / 1e9 // Convert from lamports to tokens
          } else if (tx.transaction_type === 'sell') {
            return sum - (tx.token_amount || 0) / 1e9 // Convert from lamports to tokens
          }
          return sum
        }, 0)

      const virtualTokenReserves = this.INITIAL_VIRTUAL_TOKEN_RESERVES - tokensSold
      const realTokenReserves = this.INITIAL_REAL_TOKEN_RESERVES - tokensSold

      // Calculate current price
      const currentPrice = this.calculatePriceFromReserves(virtualSolReserves, virtualTokenReserves)

      // Calculate market cap (circulating supply * price)
      const circulatingSupply = tokensSold
      const marketCap = circulatingSupply * currentPrice

      // Calculate graduation progress
      const progress = Math.min((totalSolRaised / this.TARGET_SOL_RAISED) * 100, 100)
      const isGraduated = totalSolRaised >= this.TARGET_SOL_RAISED

      return {
        virtualSolReserves,
        virtualTokenReserves,
        realTokenReserves,
        currentPrice,
        marketCap,
        progress,
        isGraduated
      }
    } catch (error) {
      console.error('Error getting bonding curve state:', error)
      // Return default initial state
      return {
        virtualSolReserves: this.INITIAL_VIRTUAL_SOL_RESERVES,
        virtualTokenReserves: this.INITIAL_VIRTUAL_TOKEN_RESERVES,
        realTokenReserves: this.INITIAL_REAL_TOKEN_RESERVES,
        currentPrice: this.calculatePriceFromReserves(this.INITIAL_VIRTUAL_SOL_RESERVES, this.INITIAL_VIRTUAL_TOKEN_RESERVES),
        marketCap: 0,
        progress: 0,
        isGraduated: false
      }
    }
  }

  /**
   * Update token price after trade
   */
  static async updateTokenPriceAfterTrade(
    tokenId: string,
    tradeResult: EnhancedTradeResult,
    transactionId: string
  ): Promise<void> {
    try {
      // Get current bonding curve state
      const state = await this.getTokenBondingCurveState(tokenId)

      // Update token in database
      await SupabaseService.updateToken(tokenId, {
        current_price: tradeResult.newPrice,
        market_cap: state.marketCap,
        bonding_curve_progress: state.progress,
        last_trade_at: new Date().toISOString()
      })

      // Store price history for charts
      await SupabaseService.storeTokenPriceData(tokenId, {
        price: tradeResult.newPrice,
        volume: Math.abs(tradeResult.solSpent),
        marketCap: state.marketCap,
        timestamp: new Date().toISOString()
      })

      console.log(`Updated token ${tokenId} price to ${tradeResult.newPrice} SOL`)
    } catch (error) {
      console.error('Error updating token price after trade:', error)
    }
  }

  /**
   * Calculate SOL required to purchase specific amount of tokens
   */
  static calculateSolForTokens(state: BondingCurveState, tokensWanted: bigint): number {
    if (tokensWanted <= 0n) return 0

    // Constant product: k = virtualSolReserves * virtualTokenReserves
    const k = state.virtualSolReserves * state.virtualTokenReserves

    // New token reserves after removing tokens
    const newVirtualTokenReserves = state.virtualTokenReserves - tokensWanted

    if (newVirtualTokenReserves <= 0n) {
      throw new Error('Not enough tokens available')
    }

    // Calculate required SOL reserves: newSolReserves = k / newTokenReserves
    const newVirtualSolReserves = k / newVirtualTokenReserves

    // SOL required (before fees)
    const solRequired = newVirtualSolReserves - state.virtualSolReserves

    // Add platform fee
    const solWithFees = (solRequired * BigInt(BASIS_POINTS)) / BigInt(BASIS_POINTS - PLATFORM_FEE_BPS)

    return Number(solWithFees) / 1e9 // Convert to SOL
  }

  /**
   * Create initial bonding curve state for new token
   */
  static createInitialState(tokenMint: PublicKey): BondingCurveState {
    return {
      virtualTokenReserves: INITIAL_VIRTUAL_TOKEN_RESERVES,
      virtualSolReserves: INITIAL_VIRTUAL_SOL_RESERVES,
      realTokenReserves: BONDING_CURVE_TOKENS,
      realSolReserves: INITIAL_REAL_SOL_RESERVES,
      tokenTotalSupply: BigInt(tokenDefaults.totalSupply),
      complete: false
    }
  }

  /**
   * Check if token should graduate based on $69K USD market cap
   */
  static shouldGraduate(state: BondingCurveState, solPriceUSD: number = 169): boolean {
    const marketCapUSD = this.calculateMarketCap(state, solPriceUSD)
    return marketCapUSD >= GRADUATION_THRESHOLD_USD
  }

  /**
   * Calculate slippage for a trade
   */
  static calculateSlippage(
    tradeAmount: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    isBuy: boolean
  ): number {
    if (isBuy) {
      const impact = tradeAmount / (virtualSolReserves + tradeAmount)
      return impact * 100
    } else {
      const impact = tradeAmount / (virtualTokenReserves + tradeAmount)
      return impact * 100
    }
  }

  /**
   * Get minimum tokens out for buy with slippage protection
   */
  static getMinimumTokensOut(
    solAmount: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    slippageTolerance: number
  ): number {
    const tradeResult = this.calculateBuyTrade(
      solAmount,
      virtualSolReserves,
      virtualTokenReserves,
      this.INITIAL_REAL_TOKEN_RESERVES
    )
    
    return tradeResult.tokensReceived * (1 - slippageTolerance / 100)
  }

  /**
   * Get minimum SOL out for sell with slippage protection
   */
  static getMinimumSolOut(
    tokenAmount: number,
    virtualSolReserves: number,
    virtualTokenReserves: number,
    slippageTolerance: number
  ): number {
    const tradeResult = this.calculateSellTrade(
      tokenAmount,
      virtualSolReserves,
      virtualTokenReserves,
      this.INITIAL_REAL_TOKEN_RESERVES
    )
    
    return Math.abs(tradeResult.solSpent) * (1 - slippageTolerance / 100)
  }
}

// Utility functions
export function formatTokenAmount(amount: bigint, decimals: number = 6): string {
  return (Number(amount) / Math.pow(10, decimals)).toFixed(6)
}

export function formatSolAmount(lamports: bigint): string {
  return (Number(lamports) / 1e9).toFixed(4)
}

export function formatPrice(price: number): string {
  if (price < 0.000001) {
    return price.toExponential(2)
  }
  return price.toFixed(8)
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`
  } else if (marketCap >= 1e3) {
    return `$${(marketCap / 1e3).toFixed(2)}K`
  }
  return `$${marketCap.toFixed(2)}`
} 