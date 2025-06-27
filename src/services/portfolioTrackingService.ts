import { supabase } from './supabase'

export interface PortfolioSnapshot {
  id: string
  user_id: string
  total_value: number
  sol_balance: number
  sol_value: number
  token_value: number
  token_count: number
  snapshot_date: string
  created_at: string
}

export interface PortfolioChange {
  value24h: number
  valuePercentage24h: number
  bestPerformer?: {
    mint: string
    name: string
    change: number
  }
  worstPerformer?: {
    mint: string
    name: string
    change: number
  }
}

class PortfolioTrackingService {
  
  /**
   * Store daily portfolio snapshot
   */
  async storePortfolioSnapshot(
    userId: string, 
    portfolioData: {
      totalValue: number
      solBalance: number
      solValue: number
      tokenValue: number
      tokenCount: number
    }
  ): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      // Check if snapshot already exists for today
      const { data: existing } = await supabase
        .from('portfolio_snapshots')
        .select('id')
        .eq('user_id', userId)
        .eq('snapshot_date', today)
        .single()

      if (existing) {
        // Update existing snapshot
        const { error } = await supabase
          .from('portfolio_snapshots')
          .update({
            total_value: portfolioData.totalValue,
            sol_balance: portfolioData.solBalance,
            sol_value: portfolioData.solValue,
            token_value: portfolioData.tokenValue,
            token_count: portfolioData.tokenCount
          })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        // Create new snapshot
        const { error } = await supabase
          .from('portfolio_snapshots')
          .insert({
            user_id: userId,
            total_value: portfolioData.totalValue,
            sol_balance: portfolioData.solBalance,
            sol_value: portfolioData.solValue,
            token_value: portfolioData.tokenValue,
            token_count: portfolioData.tokenCount,
            snapshot_date: today
          })

        if (error) throw error
      }

      return true
    } catch (error) {
      console.error('Failed to store portfolio snapshot:', error)
      return false
    }
  }

  /**
   * Get portfolio 24h change
   */
  async getPortfolio24hChange(userId: string, currentValue: number): Promise<PortfolioChange> {
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Get yesterday's snapshot
      const { data: yesterdaySnapshot } = await supabase
        .from('portfolio_snapshots')
        .select('total_value')
        .eq('user_id', userId)
        .eq('snapshot_date', yesterdayStr)
        .single()

      if (!yesterdaySnapshot) {
        return {
          value24h: 0,
          valuePercentage24h: 0
        }
      }

      const value24h = currentValue - yesterdaySnapshot.total_value
      const valuePercentage24h = yesterdaySnapshot.total_value > 0 
        ? (value24h / yesterdaySnapshot.total_value) * 100 
        : 0

      return {
        value24h,
        valuePercentage24h
      }
    } catch (error) {
      console.error('Failed to calculate 24h change:', error)
      return {
        value24h: 0,
        valuePercentage24h: 0
      }
    }
  }

  /**
   * Get portfolio history for charts
   */
  async getPortfolioHistory(userId: string, days: number = 30): Promise<PortfolioSnapshot[]> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateStr = startDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', userId)
        .gte('snapshot_date', startDateStr)
        .order('snapshot_date', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to get portfolio history:', error)
      return []
    }
  }

  /**
   * Calculate token performance for best/worst performers
   */
  async getTokenPerformance24h(userId: string): Promise<{
    bestPerformer?: { mint: string; name: string; change: number }
    worstPerformer?: { mint: string; name: string; change: number }
  }> {
    try {
      // Get user's current holdings
      const { data: currentHoldings } = await supabase
        .from('user_holdings')
        .select(`
          *,
          tokens!inner (
            mint_address,
            name,
            current_price
          )
        `)
        .eq('user_id', userId)
        .gt('amount', 0)

      if (!currentHoldings || currentHoldings.length === 0) {
        return {}
      }

      // Get 24h price changes for each token
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString()

      const tokenPerformances = await Promise.all(
        currentHoldings.map(async (holding: any) => {
          try {
            // Get price from 24h ago
            const { data: priceHistory } = await supabase
              .from('token_price_history')
              .select('price')
              .eq('token_id', holding.token_id)
              .lte('timestamp', yesterdayStr)
              .order('timestamp', { ascending: false })
              .limit(1)
              .single()

            const currentPrice = holding.tokens.current_price || 0
            const yesterdayPrice = priceHistory?.price || currentPrice
            
            const change = yesterdayPrice > 0 
              ? ((currentPrice - yesterdayPrice) / yesterdayPrice) * 100 
              : 0

            return {
              mint: holding.tokens.mint_address,
              name: holding.tokens.name,
              change
            }
          } catch {
            return {
              mint: holding.tokens.mint_address,
              name: holding.tokens.name,
              change: 0
            }
          }
        })
      )

      // Find best and worst performers
      const sortedPerformances = tokenPerformances.sort((a, b) => b.change - a.change)
      
      return {
        bestPerformer: sortedPerformances[0],
        worstPerformer: sortedPerformances[sortedPerformances.length - 1]
      }
    } catch (error) {
      console.error('Failed to get token performance:', error)
      return {}
    }
  }

  /**
   * Clean up old snapshots (keep only last 90 days)
   */
  async cleanupOldSnapshots(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 90)
      const cutoffStr = cutoffDate.toISOString().split('T')[0]

      const { error } = await supabase
        .from('portfolio_snapshots')
        .delete()
        .lt('snapshot_date', cutoffStr)

      if (error) throw error
    } catch (error) {
      console.error('Failed to cleanup old snapshots:', error)
    }
  }
}

export const portfolioTrackingService = new PortfolioTrackingService()
export default portfolioTrackingService 