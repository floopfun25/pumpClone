import { ref, type Ref } from 'vue'
import { SupabaseService } from './supabase'
import { BondingCurveService, type EnhancedTradeResult } from './bondingCurve'

export interface RealPriceData {
  tokenId: string
  price: number
  volume: number
  marketCap: number
  priceChange24h: number
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export interface ChartDataPoint {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

class RealTimePriceService {
  private static subscribers = new Map<string, Set<(data: RealPriceData) => void>>()
  private static priceCache = new Map<string, RealPriceData>()
  private static chartDataCache = new Map<string, ChartDataPoint[]>()
  private static updateIntervals = new Map<string, NodeJS.Timeout>()

  /**
   * Subscribe to real-time price updates for a token
   */
  static subscribe(tokenId: string, callback: (data: RealPriceData) => void): () => void {
    // Add callback to subscribers
    if (!this.subscribers.has(tokenId)) {
      this.subscribers.set(tokenId, new Set())
    }
    this.subscribers.get(tokenId)!.add(callback)

    // Start monitoring this token
    this.startMonitoring(tokenId)

    // Return unsubscribe function
    return () => {
      const tokenSubscribers = this.subscribers.get(tokenId)
      if (tokenSubscribers) {
        tokenSubscribers.delete(callback)
        
        // Stop monitoring if no more subscribers
        if (tokenSubscribers.size === 0) {
          this.stopMonitoring(tokenId)
        }
      }
    }
  }

  /**
   * Start monitoring a token for price changes
   */
  private static startMonitoring(tokenId: string) {
    if (this.updateIntervals.has(tokenId)) {
      return // Already monitoring
    }

    // Fetch initial data
    this.fetchAndUpdatePrice(tokenId)

    // Set up interval to check for updates every 5 seconds
    const interval = setInterval(() => {
      this.fetchAndUpdatePrice(tokenId)
    }, 5000)

    this.updateIntervals.set(tokenId, interval)

    // Also subscribe to real-time transaction updates
    this.subscribeToTransactionUpdates(tokenId)
  }

  /**
   * Stop monitoring a token
   */
  private static stopMonitoring(tokenId: string) {
    const interval = this.updateIntervals.get(tokenId)
    if (interval) {
      clearInterval(interval)
      this.updateIntervals.delete(tokenId)
    }
    this.subscribers.delete(tokenId)
    this.priceCache.delete(tokenId)
  }

  /**
   * Fetch current price data and update subscribers
   */
  private static async fetchAndUpdatePrice(tokenId: string) {
    try {
      // Get current state and calculate period
      const state = await BondingCurveService.getTokenBondingCurveState(tokenId)
      const currentTime = Date.now()
      
      // Get existing chart data or initialize
      let chartData = this.chartDataCache.get(tokenId) || []
      
      // Calculate recent volume from transactions
      const recentVolume = await this.calculateRecentVolume(tokenId)
      
      // Calculate price change
      const priceChange24h = await this.calculatePriceChange24h(tokenId, state.currentPrice)
      
      // Update candles for all timeframes
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '24h']
      
      for (const timeframe of timeframes) {
        const periodMs = this.getIntervalMs(timeframe)
        const periodStart = Math.floor(currentTime / periodMs) * periodMs
        
        // Get or create candle data for this timeframe
        let timeframeData = this.chartDataCache.get(`${tokenId}_${timeframe}`) || []
        let currentCandle = timeframeData.find(c => c.time === periodStart)
        
        if (currentCandle) {
          // Update existing candle
          currentCandle.close = state.currentPrice
          currentCandle.high = Math.max(currentCandle.high, state.currentPrice)
          currentCandle.low = Math.min(currentCandle.low, state.currentPrice)
          currentCandle.volume += recentVolume
          
          // Force update cache to trigger chart refresh
          this.chartDataCache.set(`${tokenId}_${timeframe}`, [...timeframeData])
        } else {
          // Create new candle
          const newCandle: ChartDataPoint = {
            time: periodStart,
            open: timeframeData.length > 0 ? timeframeData[timeframeData.length - 1].close : state.currentPrice,
            high: state.currentPrice,
            low: state.currentPrice,
            close: state.currentPrice,
            volume: recentVolume
          }
          timeframeData.push(newCandle)
          
          // Keep only required number of candles
          const maxPeriods = this.getPeriodsForTimeframe(timeframe)
          if (timeframeData.length > maxPeriods) {
            timeframeData = timeframeData.slice(-maxPeriods)
          }
          
          // Update cache with new candle
          this.chartDataCache.set(`${tokenId}_${timeframe}`, timeframeData)
        }
      }

      // Create price update data
      const priceData: RealPriceData = {
        tokenId,
        price: state.currentPrice,
        volume: recentVolume,
        marketCap: state.marketCap,
        priceChange24h,
        timestamp: currentTime,
        open: chartData[chartData.length - 1]?.open || state.currentPrice,
        high: chartData[chartData.length - 1]?.high || state.currentPrice,
        low: chartData[chartData.length - 1]?.low || state.currentPrice,
        close: state.currentPrice
      }

      // Update price cache
      this.priceCache.set(tokenId, priceData)

      // Notify subscribers
      const subscribers = this.subscribers.get(tokenId)
      if (subscribers) {
        subscribers.forEach(callback => {
          try {
            callback(priceData)
          } catch (error) {
            console.error('Error in price update callback:', error)
          }
        })
      }

    } catch (error) {
      console.error(`Failed to fetch price for token ${tokenId}:`, error)
    }
  }

  /**
   * Force immediate price update for a token (useful after trades)
   */
  static async forceUpdate(tokenId: string) {
    await this.fetchAndUpdatePrice(tokenId)
  }

  /**
   * Subscribe to real-time transaction updates (DISABLED - using polling instead)
   */
  private static subscribeToTransactionUpdates(tokenId: string) {
    // DISABLED: Supabase Realtime causing WebSocket errors
    // Using polling-based updates instead which work reliably
    console.log('💡 Using polling-based updates instead of realtime for', tokenId)
    
    /*
    try {
      SupabaseService.subscribeToTransactions(tokenId, (transaction: any) => {
        // When a new transaction occurs, immediately update the price
        this.handleNewTransaction(tokenId, transaction)
      })
    } catch (error) {
      console.error('Failed to subscribe to transaction updates:', error)
    }
    */
  }

  /**
   * Handle a new transaction and update price immediately
   */
  private static async handleNewTransaction(tokenId: string, transaction: any) {
    try {
      // Calculate new price based on the trade
      const state = await BondingCurveService.getTokenBondingCurveState(tokenId)
      
      // Update price data immediately
      await this.fetchAndUpdatePrice(tokenId)
      
      console.log(`Price updated for token ${tokenId} after new transaction`)
    } catch (error) {
      console.error('Error handling new transaction:', error)
    }
  }

  /**
   * Get cached price data for a token
   */
  static getCachedPrice(tokenId: string): RealPriceData | null {
    return this.priceCache.get(tokenId) || null
  }

  /**
   * Get chart data for a token
   */
  static getChartData(tokenId: string, timeframe: string = '24h'): ChartDataPoint[] {
    // Get cached data for specific timeframe
    const cached = this.chartDataCache.get(`${tokenId}_${timeframe}`) || []
    return cached
  }

  /**
   * Get historical price data from database and build chart data
   */
  static async getHistoricalChartData(tokenId: string, timeframe: string = '24h'): Promise<ChartDataPoint[]> {
    try {
      // Get price history from database
      const priceHistory = await SupabaseService.getTokenPriceHistory(tokenId, timeframe)
      
      if (priceHistory.length === 0) {
        // If no historical data, generate initial state with trend
        const state = await BondingCurveService.getTokenBondingCurveState(tokenId)
        const now = Date.now()
        const basePrice = state.currentPrice
        const points: ChartDataPoint[] = []
        
        // Create data points for the last period to show some trend
        const periods = this.getPeriodsForTimeframe(timeframe)
        const periodMs = this.getIntervalMs(timeframe)
        
        for (let i = periods - 1; i >= 0; i--) {
          const time = now - (i * periodMs)
          const volatility = 0.005 // 0.5% volatility for mock data
          const randomChange = (Math.random() - 0.5) * volatility
          const price = basePrice * (1 + randomChange)
          
          points.push({
            time,
            open: price * (1 - volatility/4),
            high: price * (1 + volatility/2),
            low: price * (1 - volatility/2),
            close: price,
            volume: Math.random() * state.marketCap * 0.001 // Small mock volume based on market cap
          })
        }
        
        // Update cache with initial data
        this.chartDataCache.set(tokenId, points)
        return points
      }

      // Convert price history to OHLCV format
      const intervalMs = this.getIntervalMs(timeframe)
      const chartData: ChartDataPoint[] = []
      
      // Group price points into candles
      const grouped = new Map<number, any[]>()
      
      priceHistory.forEach(point => {
        const timestamp = new Date(point.timestamp).getTime()
        const candleTime = Math.floor(timestamp / intervalMs) * intervalMs
        
        if (!grouped.has(candleTime)) {
          grouped.set(candleTime, [])
        }
        grouped.get(candleTime)!.push(point)
      })

      // Convert grouped data to OHLCV candles
      for (const [time, points] of grouped.entries()) {
        if (points.length === 0) continue
        
        const prices = points.map(p => p.price).sort((a, b) => a - b)
        const volumes = points.map(p => p.volume || 0)
        
        chartData.push({
          time,
          open: points[0].price,
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: points[points.length - 1].price,
          volume: volumes.reduce((sum, v) => sum + v, 0)
        })
      }

      // Sort by time
      chartData.sort((a, b) => a.time - b.time)
      
      // Cache the data
      this.chartDataCache.set(tokenId, chartData)
      
      return chartData
    } catch (error) {
      console.error('Failed to get historical chart data:', error)
      return []
    }
  }

  /**
   * Get interval in milliseconds for timeframe
   */
  private static getIntervalMs(timeframe: string): number {
    switch (timeframe) {
      case '1m':
        return 60 * 1000 // 1 minute
      case '5m':
        return 5 * 60 * 1000 // 5 minutes
      case '15m':
        return 15 * 60 * 1000 // 15 minutes
      case '30m':
        return 30 * 60 * 1000 // 30 minutes
      case '1h':
        return 60 * 60 * 1000 // 1 hour
      case '4h':
        return 4 * 60 * 60 * 1000 // 4 hours
      case '24h':
        return 24 * 60 * 60 * 1000 // 24 hours
      case '7d':
        return 7 * 24 * 60 * 60 * 1000 // 7 days
      case '30d':
        return 30 * 24 * 60 * 60 * 1000 // 30 days
      default:
        return 5 * 60 * 1000 // Default to 5 minutes
    }
  }

  private static getPeriodsForTimeframe(timeframe: string): number {
    switch (timeframe) {
      case '1m':
        return 60 // Show last 60 minutes for 1m
      case '5m':
        return 72 // Show last 6 hours for 5m
      case '15m':
        return 96 // Show last 24 hours for 15m
      case '30m':
        return 96 // Show last 48 hours for 30m
      case '1h':
        return 72 // Show last 72 hours for 1h
      case '4h':
        return 90 // Show last 15 days for 4h
      case '24h':
        return 30 // Show last 30 days for 24h
      case '7d':
        return 30 // Show last 30 weeks for 7d
      case '30d':
        return 24 // Show last 24 months for 30d
      default:
        return 72
    }
  }

  /**
   * Record a trade and update price data
   */
  static async recordTrade(
    tokenId: string,
    tradeResult: EnhancedTradeResult,
    transactionId: string
  ): Promise<void> {
    try {
      // Update token price in database
      await BondingCurveService.updateTokenPriceAfterTrade(tokenId, tradeResult, transactionId)
      
      // Immediately update cached data
      await this.fetchAndUpdatePrice(tokenId)
      
      console.log(`Trade recorded for token ${tokenId}, price updated to ${tradeResult.newPrice}`)
    } catch (error) {
      console.error('Error recording trade:', error)
    }
  }

  /**
   * Create a reactive price ref for Vue components
   */
  static createPriceRef(tokenId: string): {
    priceData: Ref<RealPriceData | null>
    chartData: Ref<ChartDataPoint[]>
    unsubscribe: () => void
  } {
    const priceData = ref<RealPriceData | null>(this.getCachedPrice(tokenId))
    const chartData = ref<ChartDataPoint[]>(this.getChartData(tokenId))

    const unsubscribe = this.subscribe(tokenId, (data) => {
      priceData.value = data
      chartData.value = this.getChartData(tokenId)
    })

    return {
      priceData,
      chartData,
      unsubscribe
    }
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    this.priceCache.clear()
    this.chartDataCache.clear()
  }

  private static async calculateRecentVolume(tokenId: string): Promise<number> {
    try {
      const currentTime = Date.now()
      const recentTransactions = await SupabaseService.getTokenTransactions(tokenId, 100)
      return recentTransactions
        .filter(tx => new Date(tx.created_at).getTime() > currentTime - (5 * 60 * 1000))
        .reduce((sum, tx) => sum + (tx.sol_amount || 0), 0) / 1e9
    } catch (error) {
      console.error('Error calculating recent volume:', error)
      return 0
    }
  }

  private static async calculatePriceChange24h(tokenId: string, currentPrice: number): Promise<number> {
    try {
      const priceHistory = await SupabaseService.getTokenPriceHistory(tokenId, '24h')
      if (priceHistory.length > 0) {
        const oldestPrice = priceHistory[0].price
        return ((currentPrice - oldestPrice) / oldestPrice) * 100
      }
      return 0
    } catch (error) {
      console.error('Error calculating 24h price change:', error)
      return 0
    }
  }
}

export { RealTimePriceService } 