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

/**
 * Jupiter-First Price Oracle Service for Solana Ecosystem
 * 
 * Primary Strategy:
 * 1. Jupiter API (Solana-native, best for SPL tokens)
 * 2. CoinGecko (fallback for general crypto data)  
 * 3. Cached prices (if APIs fail)
 * 4. Mock data (development mode with API issues)
 * 
 * Jupiter advantages:
 * - Solana-native pricing from real DEX data
 * - Better SPL token coverage
 * - No rate limiting issues
 * - Free API, no authentication needed
 */
class PriceOracleService {
  private priceCache = new Map<string, PriceData>()
  private readonly CACHE_DURATION = 900000 // 15 minutes (extended to reduce API calls)
  private lastRequestTime = 0
  private readonly MIN_REQUEST_INTERVAL = 6000 // 6 seconds between requests
  private readonly COINGECKO_BASE_URL = import.meta.env.DEV ? '/api/coingecko' : (import.meta.env.VITE_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3')
  private readonly COINPAPRIKA_BASE_URL = import.meta.env.DEV ? '/api/coinpaprika' : (import.meta.env.VITE_COINPAPRIKA_API_URL || 'https://api.coinpaprika.com/v1')
  private readonly BIRDEYE_BASE_URL = import.meta.env.DEV ? '/api/birdeye' : (import.meta.env.VITE_BIRDEYE_API_URL || 'https://public-api.birdeye.so/defi')
  private readonly JUPITER_BASE_URL = import.meta.env.DEV ? '/api/jupiter' : (import.meta.env.VITE_JUPITER_API_URL || 'https://price.jup.ag/v6')
  private readonly JUPITER_FALLBACK_URL = 'https://quote-api.jup.ag/v6' // Alternative Jupiter endpoint
  private readonly IS_DEVELOPMENT = import.meta.env.DEV

  /**
   * Test network connectivity to external APIs
   * Helps diagnose network/firewall issues in development
   */
  async testNetworkConnectivity(): Promise<void> {
    console.log('🌐 [NETWORK TEST] Checking API connectivity...')
    
    const testEndpoints = [
      { name: 'Jupiter', url: 'https://price.jup.ag' },
      { name: 'CoinGecko', url: 'https://api.coingecko.com' },
      { name: 'Birdeye', url: 'https://public-api.birdeye.so' }
    ]
    
    for (const endpoint of testEndpoints) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
        
        const response = await fetch(endpoint.url, { 
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // Avoid CORS issues for connectivity test
        })
        clearTimeout(timeoutId)
        console.log(`✅ [NETWORK TEST] ${endpoint.name} - Reachable`)
      } catch (error) {
        console.error(`❌ [NETWORK TEST] ${endpoint.name} - Not reachable:`, error)
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            console.error(`⏱️ [NETWORK TEST] ${endpoint.name} - Connection timeout (>5s)`)
          } else if (error.message.includes('Failed to fetch')) {
            console.error(`🔒 [NETWORK TEST] ${endpoint.name} - Likely blocked by firewall/network`)
          }
        }
      }
    }
    
    console.log(`
🔧 [NETWORK DIAGNOSIS] If APIs are not reachable:
1. Your network/firewall may be blocking external APIs
2. Try using a VPN or different internet connection
3. Corporate/university networks often block crypto APIs
4. Deploy to production environment for testing
5. Switching from devnet to mainnet will NOT fix this issue
    `)
  }

  // Get SOL price - with intelligent environment detection
  async getSOLPrice(): Promise<PriceData> {
    const cacheKey = 'SOL'
    const cachedPrice = this.priceCache.get(cacheKey)
    
    if (cachedPrice && Date.now() - cachedPrice.lastUpdated < this.CACHE_DURATION) {
      return cachedPrice
    }

    // Always try real APIs only - no mock data, no fallbacks
    try {
      // Use Jupiter as primary source (Solana-native, more reliable)
      return await this.getSOLPriceFromJupiter()
    } catch (jupiterError) {
      console.error('Jupiter API failed:', jupiterError instanceof Error ? jupiterError.message : 'Unknown error')
      
      try {
        // Try CoinGecko as fallback
        if (!this.IS_DEVELOPMENT) {
          // Production: Use direct API calls (no proxy)
          return await this.getSOLPriceFromRealAPI()
        } else {
          // Development: Use proxy
          return await this.getSOLPriceFromProxy()
        }
      } catch (coinGeckoError) {
        console.error('CoinGecko also failed:', coinGeckoError instanceof Error ? coinGeckoError.message : 'Unknown error')
        
        // Use cached data if available (even if expired) as last resort
        if (cachedPrice) {
          console.warn('⚠️ Using stale cached SOL price - APIs are down')
          return cachedPrice
        }
        
        // All sources failed - throw error to be handled by UI
        throw new Error(`Failed to fetch SOL price: Jupiter failed (${jupiterError instanceof Error ? jupiterError.message : 'Unknown error'}), CoinGecko failed (${coinGeckoError instanceof Error ? coinGeckoError.message : 'Unknown error'})`)
      }
    }
  }

  // Get SOL price from CoinPaprika API (fallback)
  private async getSOLPriceFromCoinPaprika(): Promise<PriceData> {
    const url = `${this.COINPAPRIKA_BASE_URL}/tickers/sol-solana`
    console.log('🔍 Fetching SOL price from CoinPaprika:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    })
    
    console.log('📡 CoinPaprika response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available')
      console.error('❌ CoinPaprika API error response:', errorText)
      throw new Error(`CoinPaprika API error! Status: ${response.status} ${response.statusText}. Details: ${errorText}`)
    }
    
    const data = await response.json()
    
    if (!data.quotes?.USD) {
      throw new Error('Invalid CoinPaprika response format')
    }
    
    const quote = data.quotes.USD
    const priceData: PriceData = {
      price: quote.price || 0,
      priceChange24h: quote.percent_change_24h || 0,
      priceChangePercent24h: quote.percent_change_24h || 0,
      marketCap: quote.market_cap || 0,
      volume24h: quote.volume_24h || 0,
      lastUpdated: Date.now()
    }
    
    console.log('✅ CoinPaprika SOL price fetched successfully:', priceData.price)
    
    // Cache the successful result
    const cacheKey = 'SOL'
    this.priceCache.set(cacheKey, priceData)
    
    return priceData
  }



  // Get SOL price from real API (production)
  private async getSOLPriceFromRealAPI(): Promise<PriceData> {
    // Use CoinGecko directly in production (no proxy)
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true'
    console.log('🔍 [PRODUCTION] Fetching SOL price from CoinGecko:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FloppFun/1.0.0'
      },
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error! Status: ${response.status}`)
    }
    
    const data = await response.json()
    const solData = data.solana
    
    const priceData: PriceData = {
      price: solData.usd || 0,
      priceChange24h: solData.usd_24h_change || 0,
      priceChangePercent24h: solData.usd_24h_change || 0,
      marketCap: solData.usd_market_cap || 0,
      volume24h: solData.usd_24h_vol || 0,
      lastUpdated: Date.now()
    }
    
    console.log('✅ [PRODUCTION] SOL price fetched:', priceData.price)
    
    // Cache the result
    const cacheKey = 'SOL'
    this.priceCache.set(cacheKey, priceData)
    
    return priceData
  }

  // Get SOL price from proxy (development)
  private async getSOLPriceFromProxy(): Promise<PriceData> {
    // Rate limiting - wait if we've made a request too recently
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    this.lastRequestTime = Date.now()

    const url = `${this.COINGECKO_BASE_URL}/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    console.log('🔍 [DEV] Fetching SOL price via proxy:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(10000)
    })
    
    console.log('📡 [DEV] Proxy response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available')
      console.error('❌ [DEV] Proxy API error response:', errorText)
      throw new Error(`Proxy API error! Status: ${response.status}. Details: ${errorText}`)
    }
    
    const data = await response.json()
    const solData = data.solana
    
    const priceData: PriceData = {
      price: solData.usd || 0,
      priceChange24h: solData.usd_24h_change || 0,
      priceChangePercent24h: solData.usd_24h_change || 0,
      marketCap: solData.usd_market_cap || 0,
      volume24h: solData.usd_24h_vol || 0,
      lastUpdated: Date.now()
    }
    
    console.log('✅ [DEV] SOL price fetched via proxy:', priceData.price)
    
    // Cache the result
    const cacheKey = 'SOL'
    this.priceCache.set(cacheKey, priceData)
    
    return priceData
  }

  // Get SOL price from Jupiter API (Solana-specific, very reliable)
  private async getSOLPriceFromJupiter(): Promise<PriceData> {
    // Jupiter Price API v6 - more reliable endpoint
    const SOL_MINT = import.meta.env.VITE_SOL_MINT || 'So11111111111111111111111111111111111111112'
    
    // Use the correct Jupiter API endpoint based on environment
    const baseUrl = this.IS_DEVELOPMENT 
      ? this.JUPITER_BASE_URL 
      : 'https://price.jup.ag/v6'
    
    const USDC_MINT = import.meta.env.VITE_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    const url = `${baseUrl}/price?ids=${SOL_MINT}&vsToken=${USDC_MINT}` // vs USDC
    console.log('🚀 [JUPITER] Fetching SOL price:', url)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FloppFun/1.0.0'
      },
      signal: AbortSignal.timeout(8000) // Shorter timeout for Jupiter
    })
    
    console.log('📡 [JUPITER] Response status:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available')
      console.error('❌ [JUPITER] API error response:', errorText)
      throw new Error(`Jupiter API error! Status: ${response.status}. Details: ${errorText}`)
    }
    
    const data = await response.json()
    console.log('📊 [JUPITER] Raw response:', data)
    
    if (!data.data?.[SOL_MINT]) {
      throw new Error('Invalid Jupiter response format - no SOL data found')
    }
    
    const solData = data.data[SOL_MINT]
    const price = parseFloat(solData.price) || 0
    
    const priceData: PriceData = {
      price: price,
      priceChange24h: 0, // Jupiter doesn't provide 24h change (we can calculate later)
      priceChangePercent24h: 0, // Jupiter doesn't provide 24h change
      marketCap: 0, // Jupiter focuses on price, not market cap
      volume24h: 0, // Jupiter doesn't provide volume
      lastUpdated: Date.now()
    }
    
    console.log(`✅ [JUPITER] SOL price fetched successfully: $${priceData.price}`)
    
    // Cache the successful result
    const cacheKey = 'SOL'
    this.priceCache.set(cacheKey, priceData)
    
    return priceData
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
      // Prioritize Jupiter for all tokens (Solana-native, more reliable)
      console.log(`🚀 [JUPITER] Fetching token price for ${mintAddress}`)
      const jupiterPrice = await this.getTokenPriceFromJupiter(mintAddress)
      if (jupiterPrice) {
        return jupiterPrice
      }
      
      console.warn(`Jupiter failed for token ${mintAddress}, trying Birdeye as fallback`)
      
      // Fallback to Birdeye if Jupiter fails
      const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY
      
      if (!apiKey || apiKey === 'demo' || apiKey === 'your_birdeye_api_key_here') {
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
        // Use real bonding curve price from database (stored in SOL)
        const tokenPriceSOL = token.current_price || 0.0000001
        
        // Convert SOL price to USD
        const solPriceData = await this.getSOLPrice()
        const tokenPriceUSD = tokenPriceSOL * solPriceData.price
        
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
            const latestPriceSOL = priceHistory[0]?.price || tokenPriceSOL
            const oldPriceSOL = priceHistory[priceHistory.length - 1]?.price || tokenPriceSOL
            // Calculate 24h change in SOL terms (currency-agnostic)
            priceChange24h = oldPriceSOL > 0 ? ((latestPriceSOL - oldPriceSOL) / oldPriceSOL) * 100 : 0
          }
        } catch (priceHistoryError) {
          // Ignore price history errors
        }

        return {
          price: tokenPriceUSD, // Now properly converted to USD
          priceChange24h,
          priceChangePercent24h: priceChange24h,
          marketCap: token.market_cap || 0, // Already in USD
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

  // Get token price from Jupiter API (Solana-native, free, no API key required)
  private async getTokenPriceFromJupiter(mintAddress: string): Promise<TokenPriceData | null> {
    try {
      // Use the correct Jupiter API endpoint based on environment
      const baseUrl = this.IS_DEVELOPMENT 
        ? this.JUPITER_BASE_URL 
        : 'https://price.jup.ag/v6'
      
      // Use USDC as base currency for token prices
      const usdcMint = import.meta.env.VITE_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      const url = `${baseUrl}/price?ids=${mintAddress}&vsToken=${usdcMint}`
      
      console.log(`🚀 [JUPITER] Fetching token price: ${url}`)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FloppFun/1.0.0'
        },
        signal: AbortSignal.timeout(8000)
      })
      
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
        
        // Try to get token metadata from Jupiter Token List
        let symbol = 'UNKNOWN'
        let name = 'Unknown Token'
        
        try {
          const tokenListUrl = import.meta.env.VITE_JUPITER_TOKEN_LIST_URL || 'https://tokens.jup.ag/tokens'
          const tokenListResponse = await fetch(`${tokenListUrl}?tags=verified`)
          if (tokenListResponse.ok) {
            const tokenList = await tokenListResponse.json()
            const tokenInfo = tokenList.find((token: any) => token.address === mintAddress)
            if (tokenInfo) {
              symbol = tokenInfo.symbol || symbol
              name = tokenInfo.name || name
              apiHealthMonitor.recordSuccess('token_metadata')
            }
          }
        } catch (metaError) {
          console.warn('Failed to fetch token metadata from Jupiter:', metaError)
          apiHealthMonitor.recordFailure('token_metadata', 'Network error')
        }
        
        console.log(`✅ [JUPITER] Token price fetched: ${symbol} = $${price}`)
        
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