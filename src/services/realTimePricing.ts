import { ref, reactive } from 'vue'
import { BondingCurveService } from './bondingCurve'
import { SupabaseService } from './supabase'

interface PriceUpdate {
  tokenId: string
  price: number
  marketCap: number
  progress: number
  volume24h: number
  priceChange24h: number
  timestamp: Date
}

interface TokenSubscription {
  tokenId: string
  callbacks: Array<(update: PriceUpdate) => void>
  interval?: NodeJS.Timeout
}

class RealTimePricingService {
  private subscriptions = new Map<string, TokenSubscription>()
  private updateInterval = 5000 // Update every 5 seconds
  private isConnected = ref(false)

  /**
   * Subscribe to real-time price updates for a token
   */
  subscribeToToken(
    tokenId: string, 
    callback: (update: PriceUpdate) => void
  ): () => void {
    console.log('🔔 Subscribing to price updates for token:', tokenId)

    let subscription = this.subscriptions.get(tokenId)
    
    if (!subscription) {
      subscription = {
        tokenId,
        callbacks: []
      }
      this.subscriptions.set(tokenId, subscription)
    }

    // Add callback to subscription
    subscription.callbacks.push(callback)

    // Start polling if this is the first subscriber
    if (subscription.callbacks.length === 1) {
      this.startPolling(tokenId)
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribeFromToken(tokenId, callback)
    }
  }

  /**
   * Unsubscribe from token price updates
   */
  private unsubscribeFromToken(
    tokenId: string, 
    callback: (update: PriceUpdate) => void
  ) {
    const subscription = this.subscriptions.get(tokenId)
    if (!subscription) return

    // Remove callback
    const index = subscription.callbacks.indexOf(callback)
    if (index > -1) {
      subscription.callbacks.splice(index, 1)
    }

    // Stop polling if no more subscribers
    if (subscription.callbacks.length === 0) {
      this.stopPolling(tokenId)
      this.subscriptions.delete(tokenId)
    }
  }

  /**
   * Start polling for price updates
   */
  private startPolling(tokenId: string) {
    const subscription = this.subscriptions.get(tokenId)
    if (!subscription) return

    console.log('⏰ Starting price polling for token:', tokenId)

    // Get initial update
    this.fetchPriceUpdate(tokenId)

    // Set up interval
    subscription.interval = setInterval(() => {
      this.fetchPriceUpdate(tokenId)
    }, this.updateInterval)
  }

  /**
   * Stop polling for a token
   */
  private stopPolling(tokenId: string) {
    const subscription = this.subscriptions.get(tokenId)
    if (!subscription) return

    console.log('⏹️ Stopping price polling for token:', tokenId)

    if (subscription.interval) {
      clearInterval(subscription.interval)
      subscription.interval = undefined
    }
  }

  /**
   * Fetch latest price update for a token
   */
  private async fetchPriceUpdate(tokenId: string) {
    try {
      const subscription = this.subscriptions.get(tokenId)
      if (!subscription) return

      // Get bonding curve state
      const curveState = await BondingCurveService.getTokenBondingCurveState(tokenId)
      
      // Get token data for 24h changes
      const token = await SupabaseService.getTokenById(tokenId)
      if (!token) return

      // Calculate 24h price change
      const currentPrice = curveState.currentPrice
      const price24hAgo = token.price_24h_ago || currentPrice
      const priceChange24h = price24hAgo > 0 
        ? ((currentPrice - price24hAgo) / price24hAgo) * 100 
        : 0

      const update: PriceUpdate = {
        tokenId,
        price: currentPrice,
        marketCap: curveState.marketCap,
        progress: curveState.progress,
        volume24h: token.volume_24h || 0,
        priceChange24h,
        timestamp: new Date()
      }

      // Notify all subscribers
      subscription.callbacks.forEach(callback => {
        try {
          callback(update)
        } catch (error) {
          console.error('Error in price update callback:', error)
        }
      })

    } catch (error) {
      console.error('Failed to fetch price update for token', tokenId, error)
    }
  }

  /**
   * Get current price for a token (one-time fetch)
   */
  async getCurrentPrice(tokenId: string): Promise<PriceUpdate | null> {
    try {
      const curveState = await BondingCurveService.getTokenBondingCurveState(tokenId)
      const token = await SupabaseService.getTokenById(tokenId)
      
      if (!token) return null

      const currentPrice = curveState.currentPrice
      const price24hAgo = token.price_24h_ago || currentPrice
      const priceChange24h = price24hAgo > 0 
        ? ((currentPrice - price24hAgo) / price24hAgo) * 100 
        : 0

      return {
        tokenId,
        price: currentPrice,
        marketCap: curveState.marketCap,
        progress: curveState.progress,
        volume24h: token.volume_24h || 0,
        priceChange24h,
        timestamp: new Date()
      }
    } catch (error) {
      console.error('Failed to get current price for token', tokenId, error)
      return null
    }
  }

  /**
   * Trigger immediate price update for a token (after trade)
   */
  async triggerUpdate(tokenId: string) {
    console.log('🔄 Triggering immediate update for token:', tokenId)
    await this.fetchPriceUpdate(tokenId)
  }

  /**
   * Get all active subscriptions (for debugging)
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys())
  }

  /**
   * Clean up all subscriptions
   */
  cleanup() {
    console.log('🧹 Cleaning up all price subscriptions')
    
    this.subscriptions.forEach((subscription, tokenId) => {
      this.stopPolling(tokenId)
    })
    
    this.subscriptions.clear()
    this.isConnected.value = false
  }

  /**
   * Update polling interval
   */
  setUpdateInterval(ms: number) {
    this.updateInterval = ms
    console.log('⏱️ Price update interval set to:', ms, 'ms')
  }
}

// Export singleton instance
export const realTimePricingService = new RealTimePricingService()

// Export types
export type { PriceUpdate } 