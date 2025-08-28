/**
 * Unified Pump.fun-style Trading Service
 * Handles all buy/sell operations through the bonding curve program
 */

import {
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import { bondingCurveProgram } from "./bondingCurveProgram";

export interface TradeResult {
  signature: string;
  tokensTraded: bigint;
  solAmount: bigint;
  newPrice: number;
  marketCap: number;
}

export class PumpTradingService {
  private connection: Connection;
  private walletService = getWalletService();

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
    console.log("🚀 Initialized Pump.fun Trading Service");
  }

  /**
   * Buy tokens using bonding curve (main entry point)
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: number,
    slippagePercent: number = 3,
  ): Promise<TradeResult> {
    console.log("💰 [PUMP BUY] Starting buy transaction...");
    console.log(`💰 [PUMP BUY] Buying ${solAmount} SOL worth of tokens`);
    console.log(`💰 [PUMP BUY] Token: ${mintAddress.toBase58()}`);

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Use the bonding curve program for actual trading
      const result = await bondingCurveProgram.buyTokens(
        mintAddress,
        solAmount,
        slippagePercent,
      );

      console.log("✅ [PUMP BUY] Buy transaction completed:", result.signature);

      // Update database with transaction record
      await this.recordTrade(
        "buy",
        result.signature,
        mintAddress.toBase58(),
        this.walletService.publicKey.toBase58(),
        result.solAmount,
        result.tokensTraded,
      );

      return result;
    } catch (error) {
      console.error("❌ [PUMP BUY] Buy transaction failed:", error);
      throw error;
    }
  }

  /**
   * Sell tokens using bonding curve (main entry point)
   */
  async sellTokens(
    mintAddress: PublicKey,
    tokenAmount: bigint, // Token amount in base units
    slippagePercent: number = 3,
  ): Promise<TradeResult> {
    console.log("💸 [PUMP SELL] Starting sell transaction...");
    console.log(`💸 [PUMP SELL] Selling ${Number(tokenAmount) / 1e9} tokens`);
    console.log(`💸 [PUMP SELL] Token: ${mintAddress.toBase58()}`);

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Use the bonding curve program for actual trading
      const result = await bondingCurveProgram.sellTokens(
        mintAddress,
        tokenAmount,
        slippagePercent,
      );

      console.log("✅ [PUMP SELL] Sell transaction completed:", result.signature);

      // Update database with transaction record
      await this.recordTrade(
        "sell",
        result.signature,
        mintAddress.toBase58(),
        this.walletService.publicKey.toBase58(),
        result.solAmount,
        result.tokensTraded,
      );

      return result;
    } catch (error) {
      console.error("❌ [PUMP SELL] Sell transaction failed:", error);
      throw error;
    }
  }

  /**
   * Get user's token balance for a specific token
   */
  async getUserTokenBalance(
    userWallet: PublicKey,
    mintAddress: PublicKey,
  ): Promise<{ balance: bigint; humanReadable: number; decimals: number }> {
    try {
      // Get associated token account
      const tokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        userWallet,
      );

      try {
        const accountInfo = await getAccount(this.connection, tokenAccount);
        
        // Get mint info for decimals
        const { getMint } = await import("@solana/spl-token");
        const mintInfo = await getMint(this.connection, mintAddress);
        
        const humanReadable = Number(accountInfo.amount) / Math.pow(10, mintInfo.decimals);
        
        return {
          balance: accountInfo.amount,
          humanReadable,
          decimals: mintInfo.decimals,
        };
      } catch (accountError) {
        // Account doesn't exist, return 0 balance
        return {
          balance: BigInt(0),
          humanReadable: 0,
          decimals: 9, // default
        };
      }
    } catch (error) {
      console.error("Failed to get token balance:", error);
      return {
        balance: BigInt(0),
        humanReadable: 0,
        decimals: 9,
      };
    }
  }

  /**
   * Check if token account exists, create if needed
   */
  async ensureTokenAccount(
    userWallet: PublicKey,
    mintAddress: PublicKey,
  ): Promise<PublicKey> {
    const tokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      userWallet,
    );

    try {
      await getAccount(this.connection, tokenAccount);
      return tokenAccount; // Account exists
    } catch (error) {
      // Account doesn't exist, need to create it
      console.log("🏗️ Token account doesn't exist, will be created during trade");
      return tokenAccount;
    }
  }

  /**
   * Record trade in database (optional - continues if it fails)
   */
  private async recordTrade(
    type: "buy" | "sell",
    signature: string,
    mintAddress: string,
    userAddress: string,
    solAmount: bigint,
    tokenAmount: bigint,
  ): Promise<void> {
    try {
      const { supabase } = await import("./supabase");
      
      await supabase.from("transactions").insert({
        signature,
        token_mint: mintAddress,
        user_address: userAddress,
        transaction_type: type,
        sol_amount: Number(solAmount),
        token_amount: Number(tokenAmount),
        created_at: new Date().toISOString(),
      });
      
      console.log("✅ Trade recorded in database");
    } catch (error) {
      console.warn("⚠️ Failed to record trade in database:", error);
      // Don't throw - transaction succeeded even if recording failed
    }
  }

  /**
   * Get current token price from bonding curve
   */
  async getCurrentPrice(mintAddress: PublicKey): Promise<number> {
    try {
      return await bondingCurveProgram.getCurrentPrice(mintAddress);
    } catch (error) {
      console.warn("Failed to get current price:", error);
      return 0;
    }
  }

  /**
   * Get market cap from bonding curve
   */
  async getMarketCap(mintAddress: PublicKey): Promise<number> {
    try {
      return await bondingCurveProgram.getMarketCap(mintAddress);
    } catch (error) {
      console.warn("Failed to get market cap:", error);
      return 0;
    }
  }
}

// Export singleton
export const pumpTradingService = new PumpTradingService();