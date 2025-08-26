import { supabase } from "./supabase";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export interface MarketData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  transactions24h: number;
}

export class MarketDataService {
  /**
   * Calculate market cap for a token
   */
  static async calculateMarketCap(tokenId: string): Promise<number> {
    try {
      const { data: token } = await supabase
        .from("tokens")
        .select("total_supply, current_price")
        .eq("id", tokenId)
        .single();

      if (!token) return 0;

      return token.total_supply * token.current_price;
    } catch (error) {
      console.error("Failed to calculate market cap:", error);
      return 0;
    }
  }

  /**
   * Calculate 24h volume for a token
   */
  static async calculate24hVolume(tokenId: string): Promise<number> {
    try {
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data: transactions } = await supabase
        .from("transactions")
        .select("sol_amount, transaction_type, price_per_token, token_amount")
        .eq("token_id", tokenId)
        .eq("status", "completed")
        .gte("created_at", yesterday);

      if (!transactions || transactions.length === 0) return 0;

      // Calculate total volume in SOL
      return transactions.reduce((sum, tx) => {
        // If we have price_per_token and token_amount, use that for more accurate volume
        if (tx.price_per_token && tx.token_amount) {
          return sum + tx.price_per_token * tx.token_amount;
        }
        // Otherwise fall back to sol_amount
        return sum + (tx.sol_amount || 0);
      }, 0);
    } catch (error) {
      console.error("Failed to calculate 24h volume:", error);
      return 0;
    }
  }

  /**
   * Get complete market data for a token
   */
  static async getTokenMarketData(tokenId: string): Promise<MarketData> {
    try {
      const [{ data: token }, transactions24h, holders] = await Promise.all([
        // Get token data
        supabase
          .from("tokens")
          .select("total_supply, current_price, price_24h_ago")
          .eq("id", tokenId)
          .single(),

        // Get 24h transactions
        supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("token_id", tokenId)
          .eq("status", "completed")
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          ),

        // Get holders count
        supabase
          .from("user_holdings")
          .select("id", { count: "exact", head: true })
          .eq("token_id", tokenId)
          .gt("amount", 0),
      ]);

      if (!token) throw new Error("Token not found");

      const volume24h = await this.calculate24hVolume(tokenId);
      // Calculate market cap as price * total supply (price is already in SOL, result in SOL)
      const marketCapSOL = token.total_supply * token.current_price;
      const marketCap = marketCapSOL * 169; // Convert to USD (assuming SOL price ~$169)
      const priceChange24h = token.price_24h_ago
        ? ((token.current_price - token.price_24h_ago) / token.price_24h_ago) *
          100
        : 0;

      return {
        price: token.current_price,
        priceChange24h,
        volume24h,
        marketCap,
        holders: holders.count || 0,
        transactions24h: transactions24h.count || 0,
      };
    } catch (error) {
      console.error("Failed to get token market data:", error);
      return {
        price: 0,
        priceChange24h: 0,
        volume24h: 0,
        marketCap: 0,
        holders: 0,
        transactions24h: 0,
      };
    }
  }

  /**
   * Get total market stats
   */
  static async getTotalMarketStats(): Promise<{
    totalMarketCap: number;
    totalVolume24h: number;
    totalTokens: number;
    activeTokens24h: number;
  }> {
    try {
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const [{ data: tokens }, { data: volume24h }, { count: activeTokens }] =
        await Promise.all([
          // Get all active tokens
          supabase
            .from("tokens")
            .select("total_supply, current_price")
            .eq("status", "active"),

          // Get 24h volume
          supabase
            .from("transactions")
            .select("sol_amount, price_per_token, token_amount")
            .eq("status", "completed")
            .gte("created_at", yesterday),

          // Get active tokens count
          supabase
            .from("tokens")
            .select("id", { count: "exact", head: true })
            .eq("status", "active")
            .gt("volume_24h", 0),
        ]);

      // Calculate total market cap
      const totalMarketCap =
        tokens?.reduce((sum, token) => {
          const marketCapSOL = token.total_supply * token.current_price;
          return sum + marketCapSOL * 169; // Convert to USD
        }, 0) || 0;

      // Calculate total 24h volume
      const totalVolume24h =
        volume24h?.reduce((sum, tx) => {
          if (tx.price_per_token && tx.token_amount) {
            return sum + tx.price_per_token * tx.token_amount;
          }
          return sum + (tx.sol_amount || 0);
        }, 0) || 0;

      return {
        totalMarketCap,
        totalVolume24h,
        totalTokens: tokens?.length || 0,
        activeTokens24h: activeTokens || 0,
      };
    } catch (error) {
      console.error("Failed to get total market stats:", error);
      return {
        totalMarketCap: 0,
        totalVolume24h: 0,
        totalTokens: 0,
        activeTokens24h: 0,
      };
    }
  }
}
