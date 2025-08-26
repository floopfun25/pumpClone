import { supabase } from "./supabase";

export interface TokenEconomics {
  totalSupply: number;
  creatorShare: number;
  marketSupply: number;
  lockedTokens: number;
  unlockedTokens: number;
  bondingCurveTokens: number;
}

export interface LockSchedule {
  id: string;
  unlockDate: Date;
  unlockPercentage: number;
  unlockAmount: number;
  status: "pending" | "completed";
}

export interface TokenLock {
  id: string;
  tokenId: string;
  lockedAmount: number;
  lockType: "creator" | "team" | "liquidity" | "marketing";
  lockDurationDays: number;
  unlockDate: Date;
  unlockSchedule: LockSchedule[];
  status: "locked" | "partially_unlocked" | "fully_unlocked";
}

class TokenEconomicsService {
  /**
   * Calculate token economics based on creation parameters
   */
  static calculateTokenEconomics(params: {
    totalSupply: number;
    creatorSharePercentage: number;
    lockPercentage: number;
  }): TokenEconomics {
    const { totalSupply, creatorSharePercentage, lockPercentage } = params;

    const creatorShare = Math.floor(
      (totalSupply * creatorSharePercentage) / 100,
    );
    const lockedTokens = Math.floor((creatorShare * lockPercentage) / 100);
    const unlockedTokens = creatorShare - lockedTokens;
    const marketSupply = totalSupply - creatorShare;
    const bondingCurveTokens = marketSupply + lockedTokens; // Include locked tokens in bonding curve

    return {
      totalSupply,
      creatorShare,
      marketSupply,
      lockedTokens,
      unlockedTokens,
      bondingCurveTokens,
    };
  }

  /**
   * Get token economics for an existing token
   */
  static async getTokenEconomics(
    tokenId: string,
  ): Promise<TokenEconomics | null> {
    try {
      const { data: token, error } = await supabase
        .from("tokens")
        .select("*")
        .eq("id", tokenId)
        .single();

      if (error || !token) return null;

      return {
        totalSupply: token.total_supply_custom || token.total_supply,
        creatorShare: token.creator_tokens_allocated || 0,
        marketSupply:
          (token.total_supply_custom || token.total_supply) -
          (token.creator_tokens_allocated || 0),
        lockedTokens: token.creator_tokens_locked || 0,
        unlockedTokens: token.creator_tokens_unlocked || 0,
        bondingCurveTokens: token.locked_tokens_amount || 0,
      };
    } catch (error) {
      console.error("Failed to get token economics:", error);
      return null;
    }
  }

  /**
   * Get all token locks for a token
   */
  static async getTokenLocks(tokenId: string): Promise<TokenLock[]> {
    try {
      const { data: locks, error } = await supabase
        .from("token_locks")
        .select("*, token_unlock_schedule(*)")
        .eq("token_id", tokenId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return locks.map((lock) => ({
        id: lock.id,
        tokenId: lock.token_id,
        lockedAmount: lock.locked_amount,
        lockType: lock.lock_type as
          | "creator"
          | "team"
          | "liquidity"
          | "marketing",
        lockDurationDays: lock.lock_duration_days,
        unlockDate: new Date(lock.unlock_date),
        unlockSchedule: (lock.token_unlock_schedule || []).map(
          (schedule: any) => ({
            id: schedule.id,
            unlockDate: new Date(schedule.unlock_date),
            unlockPercentage: schedule.unlock_percentage,
            unlockAmount: schedule.unlock_amount,
            status: schedule.status,
          }),
        ),
        status: lock.status as
          | "locked"
          | "partially_unlocked"
          | "fully_unlocked",
      }));
    } catch (error) {
      console.error("Failed to get token locks:", error);
      return [];
    }
  }

  /**
   * Check which tokens have unlocks ready to execute
   */
  static async getReadyToUnlockTokens(): Promise<LockSchedule[]> {
    try {
      const now = new Date().toISOString();

      const { data: readyUnlocks, error } = await supabase
        .from("token_unlock_schedule")
        .select("*, token_locks!inner(*, tokens!inner(*))")
        .eq("status", "pending")
        .lte("unlock_date", now);

      if (error) throw error;

      return readyUnlocks.map((unlock) => ({
        id: unlock.id,
        unlockDate: new Date(unlock.unlock_date),
        unlockPercentage: unlock.unlock_percentage,
        unlockAmount: unlock.unlock_amount,
        status: unlock.status,
      }));
    } catch (error) {
      console.error("Failed to get ready to unlock tokens:", error);
      return [];
    }
  }

  /**
   * Execute token unlock (this would integrate with smart contracts)
   */
  static async executeUnlock(unlockId: string): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Execute smart contract transaction to unlock tokens
      // 2. Transfer tokens to creator wallet
      // 3. Update database status

      const { error } = await supabase
        .from("token_unlock_schedule")
        .update({
          status: "completed",
          executed_at: new Date().toISOString(),
        })
        .eq("id", unlockId);

      if (error) throw error;

      console.log("Token unlock executed successfully");
      return true;
    } catch (error) {
      console.error("Failed to execute token unlock:", error);
      return false;
    }
  }

  /**
   * Get locked token value in SOL (requires price data)
   */
  static async getLockedTokenValue(tokenId: string): Promise<{
    totalLockedValue: number;
    locksByType: Record<string, { amount: number; value: number }>;
  }> {
    try {
      const [tokenData, locks] = await Promise.all([
        supabase
          .from("tokens")
          .select("current_price")
          .eq("id", tokenId)
          .single(),
        this.getTokenLocks(tokenId),
      ]);

      if (!tokenData.data) {
        return { totalLockedValue: 0, locksByType: {} };
      }

      const currentPrice = tokenData.data.current_price || 0;
      let totalLockedValue = 0;
      const locksByType: Record<string, { amount: number; value: number }> = {};

      for (const lock of locks) {
        const value = lock.lockedAmount * currentPrice;
        totalLockedValue += value;

        if (!locksByType[lock.lockType]) {
          locksByType[lock.lockType] = { amount: 0, value: 0 };
        }

        locksByType[lock.lockType].amount += lock.lockedAmount;
        locksByType[lock.lockType].value += value;
      }

      return { totalLockedValue, locksByType };
    } catch (error) {
      console.error("Failed to calculate locked token value:", error);
      return { totalLockedValue: 0, locksByType: {} };
    }
  }

  /**
   * Validate token economics parameters
   */
  static validateTokenEconomics(params: {
    totalSupply: number;
    creatorSharePercentage: number;
    lockPercentage: number;
    lockDurationDays: number;
  }): string[] {
    const errors: string[] = [];
    const {
      totalSupply,
      creatorSharePercentage,
      lockPercentage,
      lockDurationDays,
    } = params;

    // Total supply validation - updated range
    if (totalSupply < 100000) {
      errors.push("Total supply must be at least 100,000 tokens");
    }
    if (totalSupply > 1000000000) {
      errors.push("Total supply cannot exceed 1 billion tokens");
    }

    // Creator share validation - updated range
    if (creatorSharePercentage < 0) {
      errors.push("Creator share cannot be negative");
    }
    if (creatorSharePercentage > 80) {
      errors.push("Creator share cannot exceed 80%");
    }

    // Add recommendation warning for high creator shares
    if (creatorSharePercentage > 20) {
      errors.push(
        "Warning: Creator shares above 20% may reduce community trust",
      );
    }

    // Lock percentage validation
    if (lockPercentage < 0 || lockPercentage > 100) {
      errors.push("Lock percentage must be between 0% and 100%");
    }

    // Lock duration validation
    if (lockDurationDays < 0) {
      errors.push("Lock duration cannot be negative");
    }
    if (lockDurationDays > 730) {
      errors.push("Lock duration cannot exceed 2 years");
    }

    // Economic sanity checks - updated for new limits
    const economics = this.calculateTokenEconomics({
      totalSupply,
      creatorSharePercentage,
      lockPercentage,
    });

    // Only enforce minimum market supply for creator shares above 50%
    if (
      creatorSharePercentage > 50 &&
      economics.marketSupply < totalSupply * 0.5
    ) {
      errors.push(
        "Market supply should be at least 50% of total supply for high creator allocations",
      );
    }

    return errors;
  }

  /**
   * Format token amount for display
   */
  static formatTokenAmount(amount: number): string {
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(2)}K`;
    return amount.toLocaleString();
  }

  /**
   * Calculate time remaining until unlock
   */
  static getTimeUntilUnlock(unlockDate: Date): {
    days: number;
    hours: number;
    minutes: number;
    isUnlocked: boolean;
  } {
    const now = new Date();
    const diff = unlockDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, isUnlocked: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { days, hours, minutes, isUnlocked: false };
  }
}

export default TokenEconomicsService;
