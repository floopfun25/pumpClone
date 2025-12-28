/**
 * Portfolio Tracking Service
 * Tracks user portfolio changes and snapshots using backend API
 */

import { storePortfolioSnapshot as storeSnapshotAPI, get24hPortfolioChange as get24hChangeAPI } from './backendApi';

export interface PortfolioSnapshot {
  totalValue: number;
  tokens: Array<{
    mint: string;
    balance: number;
    value: number;
  }>;
  timestamp?: number;
}

export interface Portfolio24hChange {
  valueChange: number;
  percentChange: number;
}

class PortfolioTrackingService {
  /**
   * Get portfolio 24h change for a user
   */
  async getPortfolio24hChange(userId: string, currentValue: number): Promise<Portfolio24hChange | null> {
    try {
      console.log(`📊 [PORTFOLIO] Fetching 24h change for user ${userId}`);

      const response = await get24hChangeAPI(currentValue);

      const change: Portfolio24hChange = {
        valueChange: Number(response.valueChange),
        percentChange: Number(response.percentChange),
      };

      console.log(`✅ [PORTFOLIO] 24h change: ${change.percentChange.toFixed(2)}%`);

      return change;
    } catch (error) {
      console.error('❌ [PORTFOLIO] Error getting 24h change:', error);
      return {
        valueChange: 0,
        percentChange: 0,
      };
    }
  }

  /**
   * Store portfolio snapshot for a user
   */
  async storePortfolioSnapshot(userId: string, snapshot: PortfolioSnapshot): Promise<void> {
    try {
      // Calculate totals
      const tokenValue = snapshot.tokens.reduce((sum, token) => sum + token.value, 0);

      await storeSnapshotAPI({
        totalValue: snapshot.totalValue,
        solBalance: 0, // Will be calculated in PortfolioPage
        solValue: 0,
        tokenValue,
        tokenCount: snapshot.tokens.length,
      });

      console.log(`✅ [PORTFOLIO] Snapshot stored for user ${userId}: $${snapshot.totalValue.toFixed(2)}`);
    } catch (error) {
      console.error('❌ [PORTFOLIO] Error storing snapshot:', error);
    }
  }
}

// Export singleton instance
export const portfolioTrackingService = new PortfolioTrackingService();
