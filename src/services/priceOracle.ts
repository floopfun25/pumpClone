import { PublicKey } from '@solana/web3.js'
import { apiHealthMonitor } from './apiHealthMonitor'

export interface PriceData {
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  marketCap?: number
  volume24h?: number
  lastUpdated: number
}

export interface TokenPriceData {
  mint: string
  symbol: string
  name: string
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  marketCap?: number
  volume24h?: number
  lastUpdated: number
}

class PriceOracleService {
  private priceCache = new Map<string, PriceData>()
  private readonly CACHE_DURATION = 30000 // 30 seconds
  private readonly COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3'
  private readonly BIRDEYE_BASE_URL = 'https://public-api.birdeye.so/defi'

  // Get SOL price from CoinGecko
  async getSOLPrice(): Promise<PriceData> {
    const cacheKey = 'SOL'
    const cachedPrice = this.priceCache.get(cacheKey)
    
    if (cachedPrice && Date.now() - cachedPrice.lastUpdated < this.CACHE_DURATION) {
      return cachedPrice
    }

    try {
      const response = await fetch(
        `${this.COINGECKO_BASE_URL}/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const solData = data.solana
      
      const priceData: PriceData = {
        price: solData.usd || 0,
        priceChange24h: solData.usd_24h_change || 0,
        priceChangePercent24h: solData.usd_24h_change || 0,
        marketCap: solData.usd_market_cap,
        volume24h: solData.usd_24h_vol,
        lastUpdated: Date.now()
      }
      
      this.priceCache.set(cacheKey, priceData)
      return priceData
      
    } catch (error) {
      console.error('Failed to fetch SOL price:', error)
      
      // Return cached data if available, otherwise fallback
      const fallbackPrice: PriceData = {
        price: 100, // Fallback SOL price
        priceChange24h: 0,
        priceChangePercent24h: 0,
        lastUpdated: Date.now()
      }
      
      return cachedPrice || fallbackPrice
    }
  }

  // Get token price from Birdeye API (supports SPL tokens)
  async getTokenPrice(mintAddress: string): Promise<TokenPriceData | null> {
    const cacheKey = `token_${mintAddress}`
    const cachedPrice = this.priceCache.get(cacheKey)
    
    if (cachedPrice && Date.now() - cachedPrice.lastUpdated < this.CACHE_DURATION) {
      return {
        mint: mintAddress,
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        ...cachedPrice
      }
    }

    try {
      // Get API key from environment
      const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY
      
      if (!apiKey || apiKey === 'demo' || apiKey === 'your_birdeye_api_key_here') {
        // No valid API key, try Jupiter API as alternative
        const jupiterPrice = await this.getTokenPriceFromJupiter(mintAddress)
        if (jupiterPrice) {
          return jupiterPrice
        }
        throw new Error('No valid Birdeye API key configured and Jupiter API failed')
      }
      
      // Try Birdeye API first
      const response = await fetch(
        `${this.BIRDEYE_BASE_URL}/price?address=${mintAddress}`,
        {
          headers: {
            'X-API-KEY': apiKey
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          apiHealthMonitor.recordSuccess('birdeye')
          
          const priceData: PriceData = {
            price: data.data.value || 0,
            priceChange24h: data.data.priceChange24h || 0,
            priceChangePercent24h: ((data.data.priceChange24h || 0) / (data.data.value || 1)) * 100,
            lastUpdated: Date.now()
          }
          
          this.priceCache.set(cacheKey, priceData)
          
          return {
            mint: mintAddress,
            symbol: data.data.symbol || 'UNKNOWN',
            name: data.data.name || 'Unknown Token',
            ...priceData
          }
        }
      } else if (response.status === 401) {
        apiHealthMonitor.recordFailure('birdeye', 'Authentication failed')
        apiHealthMonitor.recordFallback('birdeye', 'mock_price', 'Authentication failed', mintAddress)
      } else {
        apiHealthMonitor.recordFailure('birdeye', `HTTP ${response.status}`)
        apiHealthMonitor.recordFallback('birdeye', 'mock_price', `HTTP ${response.status}`, mintAddress)
      }

      // Generate price using bonding curve data or fallback
      const bondingCurvePrice = await this.generateBondingCurvePrice(mintAddress)
      this.priceCache.set(cacheKey, bondingCurvePrice)
      
      return {
        mint: mintAddress,
        symbol: 'NEW',
        name: 'New Token',
        ...bondingCurvePrice
      }
      
    } catch (error) {
      // Generate price using bonding curve data or fallback
      const bondingCurvePrice = await this.generateBondingCurvePrice(mintAddress)
      this.priceCache.set(cacheKey, bondingCurvePrice)
      
      return {
        mint: mintAddress,
        symbol: 'NEW',
        name: 'New Token',
        ...bondingCurvePrice
      }
    }
  }

  // Generate price based on bonding curve data for platform tokens
  private async generateBondingCurvePrice(mintAddress: string): Promise<PriceData> {
    try {
      // First try to get from database (our platform tokens)
      const { supabase } = await import('./supabase')
      const { data: token, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .single()

      if (!error && token) {
        // Use real bonding curve price from database
        const tokenPrice = token.current_price || 0.0000001
        
        // Get 24h price change from price history if available
        let priceChange24h = 0
        try {
          const { data: priceHistory } = await supabase
            .from('token_price_history')
            .select('price')
            .eq('token_id', token.id)
            .order('timestamp', { ascending: false })
            .limit(48) // Last 48 hours of data

          if (priceHistory && priceHistory.length >= 2) {
            const latestPrice = priceHistory[0]?.price || tokenPrice
            const oldPrice = priceHistory[priceHistory.length - 1]?.price || tokenPrice
            priceChange24h = oldPrice > 0 ? ((latestPrice - oldPrice) / oldPrice) * 100 : 0
          }
        } catch (priceHistoryError) {
          // Ignore price history errors
        }

        return {
          price: tokenPrice,
          priceChange24h,
          priceChangePercent24h: priceChange24h,
          marketCap: token.market_cap || 0,
          volume24h: token.volume_24h || 0,
          lastUpdated: Date.now()
        }
      }
    } catch (error) {
      console.warn('Failed to get bonding curve price:', error)
    }

    // Fallback to deterministic mock price for unknown tokens
    return this.generateMockPrice(mintAddress)
  }

  // Generate mock price for unknown tokens (fallback)
  private generateMockPrice(mintAddress: string): PriceData {
    // Record that we're using mock data
    apiHealthMonitor.recordFallback('price_oracle', 'mock_price', 'Unknown token - using deterministic mock price', mintAddress)
    
    // Generate deterministic but random-looking prices based on mint address
    const hash = this.hashString(mintAddress)
    const basePrice = (hash % 1000) / 1000000 // Price between 0.000001 and 0.001
    const priceChange = ((hash % 200) - 100) / 10 // Change between -10% and +10%
    
    return {
      price: basePrice,
      priceChange24h: priceChange,
      priceChangePercent24h: priceChange,
      lastUpdated: Date.now()
    }
  }

  // Simple hash function for deterministic mock prices
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  // Alternative: Get token price from Jupiter API (free, no API key required)
  private async getTokenPriceFromJupiter(mintAddress: string): Promise<TokenPriceData | null> {
    try {
      // Use Jupiter Price API v2 - correct endpoint
      const response = await fetch(`https://lite-api.jup.ag/price/v2?ids=${mintAddress}`)
      
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Jupiter v2 response format: { data: { [mintAddress]: { price: "123.45" } } }
      if (data.data && data.data[mintAddress]) {
        apiHealthMonitor.recordSuccess('jupiter')
        
        const tokenData = data.data[mintAddress]
        const price = parseFloat(tokenData.price) || 0
        
        const priceData: PriceData = {
          price: price,
          priceChange24h: 0, // Jupiter doesn't provide 24h change
          priceChangePercent24h: 0,
          lastUpdated: Date.now()
        }
        
        this.priceCache.set(`token_${mintAddress}`, priceData)
        
        // Try to get token metadata from Jupiter Token API
        let symbol = 'UNKNOWN'
        let name = 'Unknown Token'
        
        try {
          const tokenMetaResponse = await fetch(`https://tokens.jup.ag/token/${mintAddress}`)
          if (tokenMetaResponse.ok) {
            const tokenMeta = await tokenMetaResponse.json()
            symbol = tokenMeta.symbol || symbol
            name = tokenMeta.name || name
            apiHealthMonitor.recordSuccess('token_metadata')
          } else {
            apiHealthMonitor.recordFailure('token_metadata', `HTTP ${tokenMetaResponse.status}`)
          }
        } catch (metaError) {
          apiHealthMonitor.recordFailure('token_metadata', metaError instanceof Error ? metaError.message : 'Unknown error')
        }
        
        return {
          mint: mintAddress,
          symbol: symbol,
          name: name,
          ...priceData
        }
      } else {
        apiHealthMonitor.recordFailure('jupiter', 'No data returned for token')
      }
      
      return null
    } catch (error) {
      console.warn('Jupiter API failed:', error)
      return null
    }
  }

  // Calculate portfolio value
  async calculatePortfolioValue(holdings: { mint: string; balance: number; decimals: number }[]): Promise<{
    totalValue: number
    solValue: number
    tokenValues: { mint: string; value: number; price: number }[]
  }> {
    try {
      const [solPrice, ...tokenPrices] = await Promise.all([
        this.getSOLPrice(),
        ...holdings.filter(h => h.mint !== 'SOL').map(h => this.getTokenPrice(h.mint))
      ])

      let totalValue = 0
      let solValue = 0
      const tokenValues: { mint: string; value: number; price: number }[] = []

      // Calculate SOL value
      const solHolding = holdings.find(h => h.mint === 'SOL')
      if (solHolding) {
        solValue = (solHolding.balance / Math.pow(10, solHolding.decimals)) * solPrice.price
        totalValue += solValue
      }

      // Calculate token values
      let tokenIndex = 0
      for (const holding of holdings.filter(h => h.mint !== 'SOL')) {
        const tokenPrice = tokenPrices[tokenIndex]
        if (tokenPrice) {
          const tokenBalance = holding.balance / Math.pow(10, holding.decimals)
          const tokenValue = tokenBalance * tokenPrice.price
          
          tokenValues.push({
            mint: holding.mint,
            value: tokenValue,
            price: tokenPrice.price
          })
          
          totalValue += tokenValue
        }
        tokenIndex++
      }

      return {
        totalValue,
        solValue,
        tokenValues
      }
      
    } catch (error) {
      console.error('Failed to calculate portfolio value:', error)
      return {
        totalValue: 0,
        solValue: 0,
        tokenValues: []
      }
    }
  }

  // Get multiple token prices in batch
  async getBatchTokenPrices(mintAddresses: string[]): Promise<TokenPriceData[]> {
    try {
      const prices = await Promise.all(
        mintAddresses.map(mint => this.getTokenPrice(mint))
      )
      
      return prices.filter(price => price !== null) as TokenPriceData[]
    } catch (error) {
      console.error('Failed to fetch batch token prices:', error)
      return []
    }
  }

  // Get trending tokens (mock implementation)
  async getTrendingTokens(limit = 10): Promise<TokenPriceData[]> {
    // This would integrate with real APIs like DexScreener, Birdeye, etc.
    // For now, return mock trending tokens
    const mockTrendingMints = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // Ether
    ]

    return Promise.all(
      mockTrendingMints.slice(0, limit).map(async (mint, index) => {
        const price = await this.getTokenPrice(mint)
        return price || {
          mint,
          symbol: `TRD${index + 1}`,
          name: `Trending Token ${index + 1}`,
          price: Math.random() * 0.001,
          priceChange24h: (Math.random() - 0.5) * 0.2,
          priceChangePercent24h: (Math.random() - 0.5) * 20,
          lastUpdated: Date.now()
        }
      })
    )
  }

  // Clear price cache
  clearCache(): void {
    this.priceCache.clear()
  }

  // Get cached price without API call
  getCachedPrice(mintAddress: string): PriceData | null {
    const cacheKey = mintAddress === 'SOL' ? 'SOL' : `token_${mintAddress}`
    const cached = this.priceCache.get(cacheKey)
    
    if (cached && Date.now() - cached.lastUpdated < this.CACHE_DURATION) {
      return cached
    }
    
    return null
  }

  // Subscribe to real-time price updates (WebSocket simulation)
  subscribe(mintAddress: string, callback: (priceData: PriceData) => void): () => void {
    const interval = setInterval(async () => {
      try {
        const priceData = mintAddress === 'SOL' 
          ? await this.getSOLPrice()
          : await this.getTokenPrice(mintAddress)
        
        if (priceData) {
          callback(priceData)
        }
      } catch (error) {
        console.error('Error in price subscription:', error)
      }
    }, 10000) // Update every 10 seconds
    
    // Return unsubscribe function
    return () => clearInterval(interval)
  }
}

// Create singleton instance
export const priceOracleService = new PriceOracleService()

// Helper functions
export function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toFixed(2)}`
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`
  } else if (price >= 0.000001) {
    return `$${price.toFixed(8)}`
  } else if (price > 0) {
    // For very small prices, show up to 12 decimal places to avoid scientific notation
    return `$${price.toFixed(12)}`
  } else {
    return `$0.00`
  }
}

export function formatPriceChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`
  } else if (marketCap >= 1e3) {
    return `$${(marketCap / 1e3).toFixed(2)}K`
  } else {
    return `$${marketCap.toFixed(2)}`
  }
}

export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(2)}B`
  } else if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`
  } else if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`
  } else {
    return volume.toFixed(2)
  }
} 