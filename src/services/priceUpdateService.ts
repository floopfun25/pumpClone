import { ref, type Ref } from "vue";
import { SupabaseService } from "./supabase";

interface PriceUpdate {
  tokenId: string;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  timestamp: number;
}

class PriceUpdateService {
  private static subscribers = new Map<
    string,
    Set<(update: PriceUpdate) => void>
  >();
  private static intervals = new Map<string, NodeJS.Timeout>();
  private static isRunning = false;

  /**
   * Subscribe to real-time price updates for a token
   */
  static subscribe(
    tokenId: string,
    callback: (update: PriceUpdate) => void,
  ): () => void {
    // Add callback to subscribers
    if (!this.subscribers.has(tokenId)) {
      this.subscribers.set(tokenId, new Set());
    }
    this.subscribers.get(tokenId)!.add(callback);

    // Start price updates for this token if not already running
    this.startPriceUpdates(tokenId);

    // Return unsubscribe function
    return () => {
      const tokenSubscribers = this.subscribers.get(tokenId);
      if (tokenSubscribers) {
        tokenSubscribers.delete(callback);

        // Stop updates if no more subscribers
        if (tokenSubscribers.size === 0) {
          this.stopPriceUpdates(tokenId);
        }
      }
    };
  }

  /**
   * Start real-time price updates for a token
   */
  private static startPriceUpdates(tokenId: string) {
    if (this.intervals.has(tokenId)) {
      return; // Already running
    }

    // Fetch initial price
    this.fetchAndBroadcastPrice(tokenId);

    // Set up interval for price updates (every 3 seconds)
    const interval = setInterval(() => {
      this.fetchAndBroadcastPrice(tokenId);
    }, 3000);

    this.intervals.set(tokenId, interval);
  }

  /**
   * Stop price updates for a token
   */
  private static stopPriceUpdates(tokenId: string) {
    const interval = this.intervals.get(tokenId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(tokenId);
    }
    this.subscribers.delete(tokenId);
  }

  /**
   * Fetch latest price and broadcast to subscribers
   */
  private static async fetchAndBroadcastPrice(tokenId: string) {
    try {
      // Fetch latest token data
      const token = await SupabaseService.getTokenById(tokenId);
      if (!token) return;

      // Get previous price for change calculation
      const previousPrice = this.getPreviousPrice(tokenId);
      const priceChange24h = previousPrice
        ? ((token.current_price - previousPrice) / previousPrice) * 100
        : 0;

      // Create price update
      const update: PriceUpdate = {
        tokenId,
        price: token.current_price,
        marketCap: token.market_cap,
        volume24h: token.volume_24h || 0,
        priceChange24h,
        timestamp: Date.now(),
      };

      // Store current price for next comparison
      this.storePreviousPrice(tokenId, token.current_price);

      // Broadcast to all subscribers
      const subscribers = this.subscribers.get(tokenId);
      if (subscribers) {
        subscribers.forEach((callback) => {
          try {
            callback(update);
          } catch (error) {
            console.error("Error in price update callback:", error);
          }
        });
      }
    } catch (error) {
      console.error(`Failed to fetch price for token ${tokenId}:`, error);
    }
  }

  /**
   * Get previous price for comparison
   */
  private static previousPrices = new Map<string, number>();

  private static getPreviousPrice(tokenId: string): number | null {
    return this.previousPrices.get(tokenId) || null;
  }

  private static storePreviousPrice(tokenId: string, price: number) {
    this.previousPrices.set(tokenId, price);
  }

  /**
   * Create a reactive price ref for a token
   */
  static createPriceRef(
    tokenId: string,
    initialPrice: number = 0,
  ): {
    price: Ref<number>;
    marketCap: Ref<number>;
    volume24h: Ref<number>;
    priceChange24h: Ref<number>;
    lastUpdate: Ref<number>;
    unsubscribe: () => void;
  } {
    const price = ref(initialPrice);
    const marketCap = ref(0);
    const volume24h = ref(0);
    const priceChange24h = ref(0);
    const lastUpdate = ref(Date.now());

    const unsubscribe = this.subscribe(tokenId, (update) => {
      price.value = update.price;
      marketCap.value = update.marketCap;
      volume24h.value = update.volume24h;
      priceChange24h.value = update.priceChange24h;
      lastUpdate.value = update.timestamp;
    });

    return {
      price,
      marketCap,
      volume24h,
      priceChange24h,
      lastUpdate,
      unsubscribe,
    };
  }

  /**
   * Simulate price movements for demo/testing
   */
  static simulatePriceMovement(tokenId: string, basePrice: number) {
    let currentPrice = basePrice;

    const interval = setInterval(() => {
      // Simulate realistic price movement (±5% max change)
      const changePercent = (Math.random() - 0.5) * 0.1; // ±5%
      currentPrice = currentPrice * (1 + changePercent);

      // Ensure price doesn't go negative
      currentPrice = Math.max(currentPrice, 0.000001);

      const update: PriceUpdate = {
        tokenId,
        price: currentPrice,
        marketCap: currentPrice * 1000000000, // Assume 1B supply
        volume24h: Math.random() * 100000,
        priceChange24h: ((currentPrice - basePrice) / basePrice) * 100,
        timestamp: Date.now(),
      };

      // Broadcast to subscribers
      const subscribers = this.subscribers.get(tokenId);
      if (subscribers) {
        subscribers.forEach((callback) => callback(update));
      }
    }, 2000); // Update every 2 seconds for demo

    // Return cleanup function
    return () => clearInterval(interval);
  }

  /**
   * Clean up all subscriptions
   */
  static cleanup() {
    // Clear all intervals
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();

    // Clear all subscribers
    this.subscribers.clear();

    // Clear previous prices
    this.previousPrices.clear();
  }
}

export { PriceUpdateService, type PriceUpdate };
