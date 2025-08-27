import { PublicKey } from "@solana/web3.js";
import { supabase } from "./supabase";
import { solanaProgram } from "./solanaProgram";

// Token balance cache entry
export interface TokenBalanceEntry {
  tokenMint: string;
  walletAddress: string;
  balance: number; // Human-readable balance (not lamports)
  decimals: number;
  lastUpdated: string;
  lastSynced: string; // Last time synced with blockchain
  isStale: boolean; // True if needs refresh from blockchain
}

// Local storage cache interface
export interface LocalBalanceCache {
  [key: string]: TokenBalanceEntry; // Key format: `${walletAddress}:${tokenMint}`
}

// Database cache interface
export interface DatabaseBalanceCache {
  user_id: string;
  token_mint: string;
  balance: number;
  decimals: number;
  last_updated: string;
  last_synced: string;
  is_stale: boolean;
}

class TokenBalanceCacheService {
  private localCache: LocalBalanceCache = {};
  private cacheKey = "token_balance_cache";
  private syncInProgress = new Set<string>();
  
  // Cache expiry times (in milliseconds)
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes for normal cache
  private readonly STALE_TTL = 30 * 60 * 1000; // 30 minutes before marking stale
  
  constructor() {
    this.loadFromLocalStorage();
  }

  /**
   * Get cache key for a wallet-token pair
   */
  private getCacheKey(walletAddress: string, tokenMint: string): string {
    return `${walletAddress}:${tokenMint}`;
  }

  /**
   * Load cache from localStorage
   */
  private loadFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (cached) {
        this.localCache = JSON.parse(cached);
        console.log("🔄 [BALANCE CACHE] Loaded from localStorage:", Object.keys(this.localCache).length, "entries");
      }
    } catch (error) {
      console.error("❌ [BALANCE CACHE] Failed to load from localStorage:", error);
      this.localCache = {};
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.localCache));
    } catch (error) {
      console.error("❌ [BALANCE CACHE] Failed to save to localStorage:", error);
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: TokenBalanceEntry): boolean {
    const now = Date.now();
    const lastUpdated = new Date(entry.lastUpdated).getTime();
    return now - lastUpdated > this.CACHE_TTL;
  }

  /**
   * Check if cache entry should be marked stale
   */
  private shouldMarkStale(entry: TokenBalanceEntry): boolean {
    const now = Date.now();
    const lastSynced = new Date(entry.lastSynced).getTime();
    return now - lastSynced > this.STALE_TTL;
  }

  /**
   * Get token balance with caching
   */
  async getBalance(
    walletAddress: string,
    tokenMint: string,
    forceRefresh: boolean = false
  ): Promise<number> {
    const cacheKey = this.getCacheKey(walletAddress, tokenMint);
    const cached = this.localCache[cacheKey];

    console.log("🔍 [BALANCE CACHE] Getting balance for:", {
      walletAddress: walletAddress.slice(0, 8) + "...",
      tokenMint: tokenMint.slice(0, 8) + "...",
      hasCached: !!cached,
      isExpired: cached ? this.isExpired(cached) : false,
      forceRefresh
    });

    // Return cached balance if valid and not expired
    if (cached && !forceRefresh && !this.isExpired(cached)) {
      // Mark as stale if needed but still return cached value
      if (this.shouldMarkStale(cached) && !cached.isStale) {
        cached.isStale = true;
        this.saveToLocalStorage();
        // Async refresh in background
        this.syncFromBlockchain(walletAddress, tokenMint).catch(console.error);
      }
      
      console.log("✅ [BALANCE CACHE] Returning cached balance:", cached.balance);
      return cached.balance;
    }

    // Fetch fresh balance from blockchain or database
    return this.syncFromBlockchain(walletAddress, tokenMint);
  }

  /**
   * Sync balance from blockchain and update all caches
   */
  async syncFromBlockchain(
    walletAddress: string,
    tokenMint: string
  ): Promise<number> {
    const cacheKey = this.getCacheKey(walletAddress, tokenMint);

    // Prevent multiple simultaneous syncs for the same token
    if (this.syncInProgress.has(cacheKey)) {
      console.log("⏳ [BALANCE CACHE] Sync already in progress for:", cacheKey);
      // Wait for existing sync to complete
      while (this.syncInProgress.has(cacheKey)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // Return cached value after sync completes
      const cached = this.localCache[cacheKey];
      return cached?.balance || 0;
    }

    this.syncInProgress.add(cacheKey);

    try {
      console.log("🔄 [BALANCE CACHE] Syncing from blockchain:", {
        walletAddress: walletAddress.slice(0, 8) + "...",
        tokenMint: tokenMint.slice(0, 8) + "..."
      });

      // Get balance from blockchain
      const userPublicKey = new PublicKey(walletAddress);
      const mintPublicKey = new PublicKey(tokenMint);
      
      const balance = await solanaProgram.getUserTokenBalance(
        mintPublicKey,
        userPublicKey
      );

      // Get token decimals (assume 9 for now, could be fetched)
      const decimals = 9;

      const now = new Date().toISOString();
      const entry: TokenBalanceEntry = {
        tokenMint,
        walletAddress,
        balance,
        decimals,
        lastUpdated: now,
        lastSynced: now,
        isStale: false
      };

      // Update local cache
      this.localCache[cacheKey] = entry;
      this.saveToLocalStorage();

      // Update database cache (async, don't wait)
      this.saveToDatabase(entry).catch(error => 
        console.error("❌ [BALANCE CACHE] Failed to save to database:", error)
      );

      console.log("✅ [BALANCE CACHE] Synced balance from blockchain:", balance);
      return balance;

    } catch (error) {
      console.error("❌ [BALANCE CACHE] Failed to sync from blockchain:", error);
      
      // Try to get from database as fallback
      try {
        const dbBalance = await this.getFromDatabase(walletAddress, tokenMint);
        if (dbBalance !== null) {
          console.log("🔄 [BALANCE CACHE] Using database fallback:", dbBalance);
          return dbBalance;
        }
      } catch (dbError) {
        console.error("❌ [BALANCE CACHE] Database fallback failed:", dbError);
      }

      // Return cached balance if available, otherwise 0
      const cached = this.localCache[cacheKey];
      return cached?.balance || 0;

    } finally {
      this.syncInProgress.delete(cacheKey);
    }
  }

  /**
   * Update balance after a trade (immediate cache update)
   */
  updateBalanceAfterTrade(
    walletAddress: string,
    tokenMint: string,
    newBalance: number,
    decimals: number = 9
  ): void {
    const cacheKey = this.getCacheKey(walletAddress, tokenMint);
    const now = new Date().toISOString();

    const entry: TokenBalanceEntry = {
      tokenMint,
      walletAddress,
      balance: newBalance,
      decimals,
      lastUpdated: now,
      lastSynced: now, // Mark as synced since this is from a confirmed transaction
      isStale: false
    };

    this.localCache[cacheKey] = entry;
    this.saveToLocalStorage();

    console.log("✅ [BALANCE CACHE] Updated balance after trade:", {
      walletAddress: walletAddress.slice(0, 8) + "...",
      tokenMint: tokenMint.slice(0, 8) + "...",
      newBalance
    });

    // Update database cache (async)
    this.saveToDatabase(entry).catch(error => 
      console.error("❌ [BALANCE CACHE] Failed to save trade update to database:", error)
    );
  }

  /**
   * Save balance to database cache
   */
  private async saveToDatabase(entry: TokenBalanceEntry): Promise<void> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("⚠️ [BALANCE CACHE] No authenticated user for database save");
        return;
      }

      const dbEntry: Partial<DatabaseBalanceCache> = {
        user_id: user.id,
        token_mint: entry.tokenMint,
        balance: entry.balance,
        decimals: entry.decimals,
        last_updated: entry.lastUpdated,
        last_synced: entry.lastSynced,
        is_stale: entry.isStale
      };

      const { error } = await supabase
        .from("user_token_balances")
        .upsert(dbEntry, {
          onConflict: "user_id,token_mint"
        });

      if (error) {
        throw error;
      }

      console.log("✅ [BALANCE CACHE] Saved to database cache");
    } catch (error) {
      console.error("❌ [BALANCE CACHE] Database save failed:", error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Get balance from database cache
   */
  private async getFromDatabase(
    walletAddress: string,
    tokenMint: string
  ): Promise<number | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }

      const { data, error } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("token_mint", tokenMint)
        .single();

      if (error || !data) {
        return null;
      }

      // Update local cache with database data
      const cacheKey = this.getCacheKey(walletAddress, tokenMint);
      this.localCache[cacheKey] = {
        tokenMint: data.token_mint,
        walletAddress,
        balance: data.balance,
        decimals: data.decimals,
        lastUpdated: data.last_updated,
        lastSynced: data.last_synced,
        isStale: data.is_stale
      };
      this.saveToLocalStorage();

      return data.balance;
    } catch (error) {
      console.error("❌ [BALANCE CACHE] Database get failed:", error);
      return null;
    }
  }

  /**
   * Load user's token balances from database on wallet connect
   */
  async loadUserBalances(walletAddress: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return;
      }

      const { data, error } = await supabase
        .from("user_token_balances")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        console.log("🔄 [BALANCE CACHE] Loading user balances from database:", data.length, "tokens");

        for (const dbEntry of data) {
          const cacheKey = this.getCacheKey(walletAddress, dbEntry.token_mint);
          this.localCache[cacheKey] = {
            tokenMint: dbEntry.token_mint,
            walletAddress,
            balance: dbEntry.balance,
            decimals: dbEntry.decimals,
            lastUpdated: dbEntry.last_updated,
            lastSynced: dbEntry.last_synced,
            isStale: dbEntry.is_stale
          };
        }

        this.saveToLocalStorage();
        console.log("✅ [BALANCE CACHE] Loaded user balances from database");
      }
    } catch (error) {
      console.error("❌ [BALANCE CACHE] Failed to load user balances:", error);
    }
  }

  /**
   * Clear cache for wallet address
   */
  clearWalletCache(walletAddress: string): void {
    const keysToDelete = Object.keys(this.localCache)
      .filter(key => key.startsWith(`${walletAddress}:`));
    
    for (const key of keysToDelete) {
      delete this.localCache[key];
    }
    
    this.saveToLocalStorage();
    console.log("🗑️ [BALANCE CACHE] Cleared cache for wallet:", walletAddress.slice(0, 8) + "...");
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.localCache = {};
    this.saveToLocalStorage();
    localStorage.removeItem(this.cacheKey);
    console.log("🗑️ [BALANCE CACHE] Cleared all cache");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { total: number; stale: number; expired: number } {
    const entries = Object.values(this.localCache);
    return {
      total: entries.length,
      stale: entries.filter(e => e.isStale).length,
      expired: entries.filter(e => this.isExpired(e)).length
    };
  }
}

// Export singleton instance
export const tokenBalanceCache = new TokenBalanceCacheService();