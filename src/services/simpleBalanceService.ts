/**
 * Simple Token Balance Service
 * Reads real balances directly from blockchain (pump.fun style)
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, getMint } from "@solana/spl-token";
import { config } from "@/config";

export interface TokenBalance {
  balance: bigint;           // Raw balance in base units
  humanReadable: number;     // Human readable balance
  decimals: number;          // Token decimals
  exists: boolean;           // Whether token account exists
}

export class SimpleBalanceService {
  private connection: Connection;
  private balanceCache = new Map<string, { balance: TokenBalance; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
    console.log("💰 Initialized Simple Balance Service");
  }

  /**
   * Get user's token balance (with minimal caching)
   */
  async getTokenBalance(
    userWallet: string,
    mintAddress: string,
    forceRefresh = false,
  ): Promise<TokenBalance> {
    const cacheKey = `${userWallet}-${mintAddress}`;
    
    // Check cache first (unless force refresh)
    if (!forceRefresh && this.balanceCache.has(cacheKey)) {
      const cached = this.balanceCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log("💰 Using cached balance for", mintAddress.slice(0, 8) + "...");
        return cached.balance;
      }
    }

    try {
      console.log("💰 Fetching fresh balance from blockchain...");
      console.log("💰 User:", userWallet.slice(0, 8) + "...");
      console.log("💰 Token:", mintAddress.slice(0, 8) + "...");

      const userPubkey = new PublicKey(userWallet);
      const mintPubkey = new PublicKey(mintAddress);

      // Get associated token account address
      const tokenAccount = await getAssociatedTokenAddress(mintPubkey, userPubkey);
      console.log("💰 Token account:", tokenAccount.toBase58());

      let balance: TokenBalance;

      try {
        // Try to get the account info
        const accountInfo = await getAccount(this.connection, tokenAccount);
        
        // Get mint info for decimals
        const mintInfo = await getMint(this.connection, mintPubkey);
        
        const humanReadable = Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals);
        
        balance = {
          balance: accountInfo.amount,
          humanReadable,
          decimals: mintInfo.decimals,
          exists: true,
        };
        
        console.log("✅ Found token account with balance:", humanReadable);
      } catch (accountError) {
        // Account doesn't exist
        console.log("ℹ️ Token account doesn't exist (balance = 0)");
        balance = {
          balance: BigInt(0),
          humanReadable: 0,
          decimals: 9, // default
          exists: false,
        };
      }

      // Cache the result
      this.balanceCache.set(cacheKey, {
        balance,
        timestamp: Date.now(),
      });

      return balance;
    } catch (error) {
      console.error("❌ Failed to fetch token balance:", error);
      
      // Return zero balance on error
      return {
        balance: BigInt(0),
        humanReadable: 0,
        decimals: 9,
        exists: false,
      };
    }
  }

  /**
   * Get multiple token balances for a user
   */
  async getMultipleBalances(
    userWallet: string,
    mintAddresses: string[],
    forceRefresh = false,
  ): Promise<Map<string, TokenBalance>> {
    const balances = new Map<string, TokenBalance>();
    
    // Fetch all balances in parallel
    const balancePromises = mintAddresses.map(async (mint) => {
      const balance = await this.getTokenBalance(userWallet, mint, forceRefresh);
      return { mint, balance };
    });
    
    const results = await Promise.allSettled(balancePromises);
    
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        balances.set(result.value.mint, result.value.balance);
      } else {
        console.warn(`Failed to fetch balance for ${mintAddresses[index]}:`, result.reason);
        balances.set(mintAddresses[index], {
          balance: BigInt(0),
          humanReadable: 0,
          decimals: 9,
          exists: false,
        });
      }
    });
    
    return balances;
  }

  /**
   * Clear cache for specific token or all tokens
   */
  clearCache(mintAddress?: string, userWallet?: string): void {
    if (mintAddress && userWallet) {
      const cacheKey = `${userWallet}-${mintAddress}`;
      this.balanceCache.delete(cacheKey);
      console.log("🗑️ Cleared cache for", mintAddress.slice(0, 8) + "...");
    } else {
      this.balanceCache.clear();
      console.log("🗑️ Cleared all balance cache");
    }
  }

  /**
   * Update balance after a trade (optimistic update)
   */
  async updateBalanceAfterTrade(
    userWallet: string,
    mintAddress: string,
    tradeType: "buy" | "sell",
    tokenAmount: bigint,
  ): Promise<void> {
    console.log("🔄 Updating balance after", tradeType, "trade");
    
    // Clear cache to force fresh read
    this.clearCache(mintAddress, userWallet);
    
    // Fetch fresh balance
    await this.getTokenBalance(userWallet, mintAddress, true);
    
    console.log("✅ Balance updated after trade");
  }

  /**
   * Get SOL balance for a wallet
   */
  async getSolBalance(walletAddress: string): Promise<number> {
    try {
      const publicKey = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      console.error("Failed to get SOL balance:", error);
      return 0;
    }
  }
}

// Export singleton
export const simpleBalanceService = new SimpleBalanceService();