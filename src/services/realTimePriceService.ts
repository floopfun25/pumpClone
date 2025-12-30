import { ref, type Ref } from "vue";
import { tradingAPI } from "./api";
import { getTokenPriceHistory } from "./backendApi";
import { BondingCurveService, type EnhancedTradeResult } from "./bondingCurve";
import { webSocketService, type PriceUpdate } from "./webSocketService";

export interface RealPriceData {
  tokenId: string;
  price: number;
  volume: number;
  marketCap: number;
  priceChange24h: number;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  progress: number;
}

export interface ChartDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class RealTimePriceService {
  private static subscribers = new Map<
    string,
    Set<(data: RealPriceData) => void>
  >();
  private static priceCache = new Map<string, RealPriceData>();
  private static chartDataCache = new Map<string, ChartDataPoint[]>();
  private static wsUnsubscribers = new Map<string, () => void>();
  private static lastUpdateTime = new Map<string, number>();
  private static readonly UPDATE_THROTTLE_MS = 1000; // Max 1 update per second
  private static readonly MAX_CANDLES = 1000; // Limit memory usage

  /**
   * Subscribe to real-time price updates for a token
   */
  static subscribe(
    tokenId: string,
    callback: (data: RealPriceData) => void,
  ): () => void {
    // Add callback to subscribers
    if (!this.subscribers.has(tokenId)) {
      this.subscribers.set(tokenId, new Set());
    }
    this.subscribers.get(tokenId)!.add(callback);

    // Start monitoring this token
    this.startMonitoring(tokenId);

    // Return unsubscribe function
    return () => {
      const tokenSubscribers = this.subscribers.get(tokenId);
      if (tokenSubscribers) {
        tokenSubscribers.delete(callback);

        // Stop monitoring if no more subscribers
        if (tokenSubscribers.size === 0) {
          this.stopMonitoring(tokenId);
        }
      }
    };
  }

  /**
   * Start monitoring a token for price changes via WebSocket
   */
  private static startMonitoring(tokenId: string) {
    if (this.wsUnsubscribers.has(tokenId)) {
      return; // Already monitoring
    }

    // Fetch initial data
    this.fetchAndUpdatePrice(tokenId);

    // Subscribe to WebSocket price updates
    const unsubscribe = webSocketService.subscribeToPrice(tokenId, (update: PriceUpdate) => {
      this.handleWebSocketPriceUpdate(tokenId, update);
    });

    this.wsUnsubscribers.set(tokenId, unsubscribe);
    console.log(`[RealTimePriceService] Started monitoring token ${tokenId} via WebSocket`);
  }

  /**
   * Stop monitoring a token
   */
  private static stopMonitoring(tokenId: string) {
    const unsubscribe = this.wsUnsubscribers.get(tokenId);
    if (unsubscribe) {
      unsubscribe();
      this.wsUnsubscribers.delete(tokenId);
    }
    this.subscribers.delete(tokenId);
    this.priceCache.delete(tokenId);
    this.lastUpdateTime.delete(tokenId);
    console.log(`[RealTimePriceService] Stopped monitoring token ${tokenId}`);
  }

  /**
   * Handle WebSocket price update with throttling and candle updates
   */
  private static async handleWebSocketPriceUpdate(tokenId: string, update: PriceUpdate) {
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(tokenId) || 0;

    // Throttle updates to max 1 per second
    if (now - lastUpdate < this.UPDATE_THROTTLE_MS) {
      return;
    }

    this.lastUpdateTime.set(tokenId, now);

    try {
      const currentPrice = update.price;
      const currentTime = now;

      // Update candles for all timeframes
      const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "24h"];

      for (const timeframe of timeframes) {
        const periodMs = this.getIntervalMs(timeframe);
        const periodStartMs = Math.floor(currentTime / periodMs) * periodMs;
        const periodStart = Math.floor(periodStartMs / 1000); // Convert to Unix seconds

        // Get or create candle data for this timeframe
        let timeframeData =
          this.chartDataCache.get(`${tokenId}_${timeframe}`) || [];
        const currentCandle = timeframeData.find((c) => c.time === periodStart);

        if (currentCandle) {
          // Update existing candle
          currentCandle.close = currentPrice;
          currentCandle.high = Math.max(currentCandle.high, currentPrice);
          currentCandle.low = Math.min(currentCandle.low, currentPrice);
          currentCandle.volume += update.volume24h;
        } else {
          // Create new candle
          const newCandle: ChartDataPoint = {
            time: periodStart, // Already in Unix seconds
            open:
              timeframeData.length > 0
                ? timeframeData[timeframeData.length - 1].close
                : currentPrice,
            high: currentPrice,
            low: currentPrice,
            close: currentPrice,
            volume: update.volume24h,
          };
          timeframeData.push(newCandle);

          // Trim old data to prevent memory bloat
          const maxPeriods = Math.min(this.getPeriodsForTimeframe(timeframe), this.MAX_CANDLES);
          if (timeframeData.length > maxPeriods) {
            timeframeData = timeframeData.slice(-maxPeriods);
          }
        }

        // Update cache with trimmed data
        this.chartDataCache.set(`${tokenId}_${timeframe}`, timeframeData);
      }

      // Calculate price change (use cached data if available)
      const priceChange24h = await this.calculatePriceChange24h(tokenId, currentPrice);

      // Create price update data
      const priceData: RealPriceData = {
        tokenId,
        price: currentPrice,
        volume: update.volume24h,
        marketCap: update.marketCap,
        priceChange24h,
        timestamp: currentTime,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        progress: 0, // Will be updated by bonding curve service if needed
      };

      // Update price cache
      this.priceCache.set(tokenId, priceData);

      // Notify subscribers
      const subscribers = this.subscribers.get(tokenId);
      if (subscribers) {
        subscribers.forEach((callback) => {
          try {
            callback(priceData);
          } catch (error) {
            console.error("Error in price update callback:", error);
          }
        });
      }
    } catch (error) {
      console.error(`Error handling WebSocket price update for token ${tokenId}:`, error);
    }
  }

  /**
   * Fetch current price data and update subscribers
   */
  private static async fetchAndUpdatePrice(tokenId: string) {
    try {
      // Get current state and calculate period
      const state =
        await BondingCurveService.getTokenBondingCurveState(tokenId);
      const currentTime = Date.now();

      // Get existing chart data or initialize
      const chartData = this.chartDataCache.get(tokenId) || [];

      // Calculate recent volume from transactions
      const recentVolume = await this.calculateRecentVolume(tokenId);

      // Calculate price change
      const priceChange24h = await this.calculatePriceChange24h(
        tokenId,
        state.currentPrice,
      );

      // Update candles for all timeframes
      const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "24h"];

      for (const timeframe of timeframes) {
        const periodMs = this.getIntervalMs(timeframe);
        const periodStartMs = Math.floor(currentTime / periodMs) * periodMs;
        const periodStart = Math.floor(periodStartMs / 1000); // Convert to Unix seconds

        // Get or create candle data for this timeframe
        let timeframeData =
          this.chartDataCache.get(`${tokenId}_${timeframe}`) || [];
        const currentCandle = timeframeData.find((c) => c.time === periodStart);

        if (currentCandle) {
          // Update existing candle
          currentCandle.close = state.currentPrice;
          currentCandle.high = Math.max(currentCandle.high, state.currentPrice);
          currentCandle.low = Math.min(currentCandle.low, state.currentPrice);
          currentCandle.volume += recentVolume;

          // Force update cache to trigger chart refresh
          this.chartDataCache.set(`${tokenId}_${timeframe}`, [
            ...timeframeData,
          ]);
        } else {
          // Create new candle
          const newCandle: ChartDataPoint = {
            time: periodStart, // Already in Unix seconds
            open:
              timeframeData.length > 0
                ? timeframeData[timeframeData.length - 1].close
                : state.currentPrice,
            high: state.currentPrice,
            low: state.currentPrice,
            close: state.currentPrice,
            volume: recentVolume,
          };
          timeframeData.push(newCandle);

          // Keep only required number of candles
          const maxPeriods = this.getPeriodsForTimeframe(timeframe);
          if (timeframeData.length > maxPeriods) {
            timeframeData = timeframeData.slice(-maxPeriods);
          }

          // Update cache with new candle
          this.chartDataCache.set(`${tokenId}_${timeframe}`, timeframeData);
        }
      }

      // Create price update data
      const priceData: RealPriceData = {
        tokenId,
        price: state.currentPrice,
        volume: recentVolume,
        marketCap: state.marketCap,
        priceChange24h,
        timestamp: currentTime,
        open: chartData[chartData.length - 1]?.open || state.currentPrice,
        high: chartData[chartData.length - 1]?.high || state.currentPrice,
        low: chartData[chartData.length - 1]?.low || state.currentPrice,
        close: state.currentPrice,
        progress: state.progress,
      };

      // Update price cache
      this.priceCache.set(tokenId, priceData);

      // Notify subscribers
      const subscribers = this.subscribers.get(tokenId);
      if (subscribers) {
        subscribers.forEach((callback) => {
          try {
            callback(priceData);
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
   * Force immediate price update for a token (useful after trades)
   */
  static async forceUpdate(tokenId: string) {
    await this.fetchAndUpdatePrice(tokenId);
  }


  /**
   * Get cached price data for a token
   */
  static getCachedPrice(tokenId: string): RealPriceData | null {
    return this.priceCache.get(tokenId) || null;
  }

  /**
   * Get chart data for a token
   */
  static getChartData(
    tokenId: string,
    timeframe: string = "24h",
  ): ChartDataPoint[] {
    // Get cached data for specific timeframe
    const cached = this.chartDataCache.get(`${tokenId}_${timeframe}`) || [];
    return cached;
  }

  /**
   * Get historical price data from database and build chart data
   */
  static async getHistoricalChartData(
    tokenId: string,
    timeframe: string = "24h",
  ): Promise<ChartDataPoint[]> {
    try {
      // Get price history from Spring Boot backend
      const priceHistory = await getTokenPriceHistory(tokenId, timeframe);

      if (priceHistory.length === 0) {
        // No trading history yet - return empty array
        console.log(`[RealTimePriceService] No trading history available for token ${tokenId}`);
        return [];
      }

      if (priceHistory.length === 1) {
        // If only one data point, create two candles: one at trade time, one at current time
        const point = priceHistory[0];
        const timestampMs = new Date(point.timestamp).getTime();
        const time = Math.floor(timestampMs / 1000); // Convert to Unix seconds

        // First candle: the actual trade data
        const tradeCandle: ChartDataPoint = {
          time,
          open: point.open || point.price,
          high: point.high || point.price,
          low: point.low || point.price,
          close: point.close || point.price,
          volume: point.volume || 0,
        };

        // Second candle: current price at current time
        const now = Math.floor(Date.now() / 1000);
        const currentCandle: ChartDataPoint = {
          time: now,
          open: point.close || point.price,
          high: point.close || point.price,
          low: point.close || point.price,
          close: point.close || point.price,
          volume: 0,
        };

        const chartData = [tradeCandle, currentCandle];
        this.chartDataCache.set(tokenId, chartData);
        return chartData;
      }

      // Backend already returns OHLCV aggregated data, just convert format
      const chartData: ChartDataPoint[] = priceHistory.map((point: any) => {
        const timestampMs = new Date(point.timestamp).getTime();
        return {
          time: Math.floor(timestampMs / 1000), // Convert to Unix seconds
          open: point.open || point.price,
          high: point.high || point.price,
          low: point.low || point.price,
          close: point.close || point.price,
          volume: point.volume || 0,
        };
      });

      // Sort by time (should already be sorted from backend)
      chartData.sort((a, b) => a.time - b.time);

      // Cache the data
      this.chartDataCache.set(tokenId, chartData);

      return chartData;
    } catch (error) {
      console.error("Failed to get historical chart data:", error);
      return [];
    }
  }

  /**
   * Get interval in milliseconds for timeframe
   */
  private static getIntervalMs(timeframe: string): number {
    switch (timeframe) {
      case "1m":
        return 60 * 1000; // 1 minute
      case "5m":
        return 5 * 60 * 1000; // 5 minutes
      case "15m":
        return 15 * 60 * 1000; // 15 minutes
      case "30m":
        return 30 * 60 * 1000; // 30 minutes
      case "1h":
        return 60 * 60 * 1000; // 1 hour
      case "4h":
        return 4 * 60 * 60 * 1000; // 4 hours
      case "24h":
        return 24 * 60 * 60 * 1000; // 24 hours
      case "7d":
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case "30d":
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      default:
        return 5 * 60 * 1000; // Default to 5 minutes
    }
  }

  private static getPeriodsForTimeframe(timeframe: string): number {
    switch (timeframe) {
      case "1m":
        return 60; // Show last 60 minutes for 1m
      case "5m":
        return 72; // Show last 6 hours for 5m
      case "15m":
        return 96; // Show last 24 hours for 15m
      case "30m":
        return 96; // Show last 48 hours for 30m
      case "1h":
        return 72; // Show last 72 hours for 1h
      case "4h":
        return 90; // Show last 15 days for 4h
      case "24h":
        return 30; // Show last 30 days for 24h
      case "7d":
        return 30; // Show last 30 weeks for 7d
      case "30d":
        return 24; // Show last 24 months for 30d
      default:
        return 72;
    }
  }

  /**
   * Record a trade and update price data
   */
  static async recordTrade(
    tokenId: string,
    tradeResult: EnhancedTradeResult,
    transactionId: string,
  ): Promise<void> {
    try {
      // Update token price in database
      await BondingCurveService.updateTokenPriceAfterTrade(
        tokenId,
        tradeResult,
        transactionId,
      );

      // Immediately update cached data
      await this.fetchAndUpdatePrice(tokenId);

      console.log(
        `Trade recorded for token ${tokenId}, price updated to ${tradeResult.newPrice}`,
      );
    } catch (error) {
      console.error("Error recording trade:", error);
    }
  }

  /**
   * Create a reactive price ref for Vue components
   */
  static createPriceRef(tokenId: string): {
    priceData: Ref<RealPriceData | null>;
    chartData: Ref<ChartDataPoint[]>;
    unsubscribe: () => void;
  } {
    const priceData = ref<RealPriceData | null>(this.getCachedPrice(tokenId));
    const chartData = ref<ChartDataPoint[]>(this.getChartData(tokenId));

    const unsubscribe = this.subscribe(tokenId, (data) => {
      priceData.value = data;
      chartData.value = this.getChartData(tokenId);
    });

    return {
      priceData,
      chartData,
      unsubscribe,
    };
  }

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    this.priceCache.clear();
    this.chartDataCache.clear();
  }

  static clearCacheForToken(tokenId: string): void {
    if (!tokenId) return;

    this.priceCache.delete(tokenId);
    // Also clear all timeframe-specific chart caches
    const timeframes = [
      "1m",
      "5m",
      "15m",
      "30m",
      "1h",
      "4h",
      "24h",
      "7d",
      "30d",
    ];
    for (const timeframe of timeframes) {
      this.chartDataCache.delete(`${tokenId}_${timeframe}`);
    }
    console.log(`🧹 Cache cleared for token: ${tokenId}`);
  }

  private static async calculateRecentVolume(tokenId: string): Promise<number> {
    try {
      const currentTime = Date.now();
      const response = await tradingAPI.getTokenTransactions(Number(tokenId), 0, 100);
      const recentTransactions = response.content;
      return (
        recentTransactions
          .filter(
            (tx) =>
              new Date(tx.createdAt).getTime() > currentTime - 5 * 60 * 1000,
          )
          .reduce((sum, tx) => sum + (tx.solAmount || 0), 0) / 1e9
      );
    } catch (error) {
      console.error("Error calculating recent volume:", error);
      return 0;
    }
  }

  private static async calculatePriceChange24h(
    tokenId: string,
    currentPrice: number,
  ): Promise<number> {
    try {
      const priceHistory = await getTokenPriceHistory(tokenId, "24h");
      if (priceHistory.length > 0) {
        const oldestPrice = priceHistory[0].price;
        return ((currentPrice - oldestPrice) / oldestPrice) * 100;
      }
      return 0;
    } catch (error) {
      console.error("Error calculating 24h price change:", error);
      return 0;
    }
  }
}

export { RealTimePriceService };
