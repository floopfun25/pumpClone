/**
 * Token Balance Cache Service
 * Caches user token balances to avoid redundant blockchain queries
 */

export interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
}

class TokenBalanceCache {
  private cache: Map<string, TokenBalance[]> = new Map();

  /**
   * Load user token balances and cache them
   */
  async loadUserBalances(walletAddress: string): Promise<void> {
    try {
      // TODO: Implement actual token balance loading from Solana blockchain
      console.warn(`TokenBalanceCache.loadUserBalances not fully implemented for wallet: ${walletAddress}`);

      // For now, just initialize empty cache entry
      if (!this.cache.has(walletAddress)) {
        this.cache.set(walletAddress, []);
      }
    } catch (error) {
      console.error('Error loading user balances:', error);
    }
  }

  /**
   * Clear cached balances for a specific wallet
   */
  clearWalletCache(walletAddress: string): void {
    this.cache.delete(walletAddress);
  }

  /**
   * Get cached balances for a wallet
   */
  getBalances(walletAddress: string): TokenBalance[] {
    return this.cache.get(walletAddress) || [];
  }

  /**
   * Update a specific token balance in cache
   */
  updateBalance(walletAddress: string, mint: string, balance: number, decimals: number): void {
    const balances = this.getBalances(walletAddress);
    const existingIndex = balances.findIndex(b => b.mint === mint);

    if (existingIndex >= 0) {
      balances[existingIndex] = { mint, balance, decimals };
    } else {
      balances.push({ mint, balance, decimals });
    }

    this.cache.set(walletAddress, balances);
  }

  /**
   * Clear all cached balances
   */
  clearAll(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const tokenBalanceCache = new TokenBalanceCache();
