import { PublicKey } from '@solana/web3.js'
import { bondingCurveConfig, tokenDefaults } from '@/config'

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
}

export interface BondingCurveProgress {
  progress: number // 0-100
  solRequired: number
  tokensRemaining: bigint
  graduated: boolean
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

class BondingCurveService {
  /**
   * Calculate the current token price based on reserves
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
   * Calculate market cap based on current price and total supply (in USD)
   */
  static calculateMarketCap(state: BondingCurveState, solPriceUSD: number = 169): number {
    const tokenPrice = this.calculatePrice(state)
    const totalSupply = Number(state.tokenTotalSupply) / 1e6
    
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
   * Calculate tokens received for SOL input (buy)
   * Uses constant product formula: x * y = k
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
      fees
    }
  }

  /**
   * Calculate SOL received for token input (sell)
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
      fees
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
   * Get graduation information
   */
  static getGraduationInfo(state: BondingCurveState, solPriceUSD: number = 169): {
    currentMarketCap: number
    graduationMarketCap: number
    graduationLiquidity: number
    creatorReward: number
    platformFee: number
    readyToGraduate: boolean
  } {
    const currentMarketCap = this.calculateMarketCap(state, solPriceUSD)
    
    return {
      currentMarketCap,
      graduationMarketCap: GRADUATION_THRESHOLD_USD,
      graduationLiquidity: GRADUATION_LIQUIDITY_USD,
      creatorReward: CREATOR_REWARD_SOL,
      platformFee: PLATFORM_FEE_SOL,
      readyToGraduate: currentMarketCap >= GRADUATION_THRESHOLD_USD
    }
  }

  /**
   * Simulate trade to get preview without executing
   */
  static previewTrade(
    state: BondingCurveState,
    isBuy: boolean,
    amount: bigint
  ): TradeResult {
    try {
      if (isBuy) {
        return this.calculateBuy(state, amount)
      } else {
        return this.calculateSell(state, amount)
      }
    } catch (error) {
      throw new Error(`Trade simulation failed: ${(error as Error).message}`)
    }
  }

  /**
   * Get price chart data points for visualization
   */
  static getPriceChartData(
    state: BondingCurveState,
    points: number = 100
  ): Array<{ sol: number; price: number; marketCap: number }> {
    const data: Array<{ sol: number; price: number; marketCap: number }> = []
    
    // Calculate price at different SOL levels
    const maxSol = Number(GRADUATION_THRESHOLD_USD) / 1e9
    const solStep = maxSol / points

    for (let i = 0; i <= points; i++) {
      const solAmount = i * solStep
      const solLamports = BigInt(Math.floor(solAmount * 1e9))
      
      try {
        // Simulate state with this much SOL
        const simulatedState: BondingCurveState = {
          ...state,
          realSolReserves: solLamports,
          virtualSolReserves: INITIAL_VIRTUAL_SOL_RESERVES + solLamports
        }

        const price = this.calculatePrice(simulatedState)
        const marketCap = this.calculateMarketCap(simulatedState)

        data.push({
          sol: solAmount,
          price,
          marketCap
        })
      } catch (error) {
        // Skip invalid data points
        continue
      }
    }

    return data
  }
}

export { BondingCurveService }

// Utility functions for UI
export function formatTokenAmount(amount: bigint, decimals: number = 6): string {
  return (Number(amount) / Math.pow(10, decimals)).toLocaleString()
}

export function formatSolAmount(lamports: bigint): string {
  return (Number(lamports) / 1e9).toFixed(4)
}

export function formatPrice(price: number): string {
  if (price < 0.000001) {
    return price.toExponential(3)
  }
  return price.toFixed(8)
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1000000) {
    return `$${(marketCap / 1000000).toFixed(2)}M`
  } else if (marketCap >= 1000) {
    return `$${(marketCap / 1000).toFixed(1)}K`
  } else {
    return `$${marketCap.toFixed(0)}`
  }
} 