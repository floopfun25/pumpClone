import { PublicKey } from "@solana/web3.js";
import { priceOracleService } from "./priceOracle";
import { tokenAPI, tradingAPI } from "./api";
import { getTokenPriceHistory } from "./backendApi";

export interface MarketData {
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  transactions24h: number;
  liquidity: number;
  lastUpdated: number;
}

export interface TokenAnalytics {
  mint: string;
  symbol: string;
  name: string;
  marketData: MarketData;
  technicalIndicators: TechnicalIndicators;
  socialMetrics: SocialMetrics;
  riskMetrics: RiskMetrics;
}

export interface TechnicalIndicators {
  rsi: number; // Relative Strength Index
  volume_sma: number; // Volume Simple Moving Average
  price_sma_7d: number;
  price_sma_30d: number;
  volatility: number;
  momentum: number;
}

export interface SocialMetrics {
  sentiment_score: number; // -1 to 1
  mentions_24h: number;
  trending_rank: number;
  community_activity: number;
}

export interface RiskMetrics {
  liquidity_score: number; // 0-100
  volatility_score: number; // 0-100
  concentration_risk: number; // 0-100
  smart_money_flow: number;
}

export interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  image_url?: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  trending_score: number;
  rank: number;
}

export interface MarketOverview {
  totalMarketCap: number;
  totalVolume24h: number;
  totalTokens: number;
  activeTokens24h: number;
  topGainers: TrendingToken[];
  topLosers: TrendingToken[];
  mostActive: TrendingToken[];
  newListings: TrendingToken[];
}

class MarketAnalyticsService {
  private cache = new Map<string, any>();
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  private subscriptions = new Map<string, Set<(data: any) => void>>();

  /**
   * Get comprehensive market analytics for a token
   */
  async getTokenAnalytics(mintAddress: string): Promise<TokenAnalytics | null> {
    const cacheKey = `analytics_${mintAddress}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Get token data from Spring Boot backend
      const token = await tokenAPI.getTokenByMint(mintAddress);
      if (!token) return null;

      // Get real-time price data
      const priceData = await priceOracleService.getTokenPrice(mintAddress);

      // Calculate analytics
      const marketData = await this.calculateMarketData(token, priceData);
      const technicalIndicators = await this.calculateTechnicalIndicators(
        String(token.id),
      );
      const socialMetrics = await this.calculateSocialMetrics(String(token.id));
      const riskMetrics = await this.calculateRiskMetrics(token, marketData);

      const analytics: TokenAnalytics = {
        mint: mintAddress,
        symbol: token.symbol,
        name: token.name,
        marketData,
        technicalIndicators,
        socialMetrics,
        riskMetrics,
      };

      this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      // ...existing code...
      return null;
    }
  }

  /**
   * Get trending tokens with comprehensive analytics
   */
  async getTrendingTokens(limit: number = 20): Promise<TrendingToken[]> {
    const cacheKey = "trending_tokens";
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Get tokens from Spring Boot backend with recent activity
      const response = await tokenAPI.getTrendingTokens(0, limit * 2);
      const tokens = response.content;

      const trendingTokens: TrendingToken[] = [];

      for (const token of tokens) {
        const priceData = await priceOracleService.getTokenPrice(
          token.mintAddress,
        );
        if (!priceData) continue;

        // Calculate trending score based on multiple factors
        const volume24h = await this.getVolume24h(token.id);
        const trendingScore = this.calculateTrendingScore({
          priceChange24h: priceData.priceChangePercent24h,
          volume24h,
          marketCap: priceData.marketCap || 0,
          age: this.getTokenAge(token.createdAt),
          holders: 0, // TODO: Implement holders count in backend
        });

        trendingTokens.push({
          mint: token.mintAddress,
          symbol: token.symbol,
          name: token.name,
          image_url: token.imageUrl,
          price: priceData.price,
          priceChange24h: priceData.priceChangePercent24h,
          volume24h,
          marketCap: priceData.marketCap || 0,
          trending_score: trendingScore,
          rank: 0, // Will be set after sorting
        });
      }

      // Sort by trending score and assign ranks
      const sorted = trendingTokens
        .sort((a, b) => b.trending_score - a.trending_score)
        .slice(0, limit)
        .map((token, index) => ({ ...token, rank: index + 1 }));

      this.setCache(cacheKey, sorted);
      return sorted;
    } catch (error) {
      // ...existing code...
      return [];
    }
  }

  /**
   * Get comprehensive market overview
   */
  async getMarketOverview(): Promise<MarketOverview> {
    const cacheKey = "market_overview";
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      // Note: Market stats not yet implemented in backend
      const [topGainers, topLosers, mostActive, newListings] =
        await Promise.all([
          this.getTopGainers(10),
          this.getTopLosers(10),
          this.getMostActive(10),
          this.getNewListings(10),
        ]);

      const marketStats = {
        totalMarketCap: 0,
        totalVolume24h: 0,
        totalTokens: 0,
        activeTraders24h: 0,
      };

      const overview: MarketOverview = {
        totalMarketCap: marketStats.totalMarketCap,
        totalVolume24h: marketStats.totalVolume24h,
        totalTokens: marketStats.totalTokens,
        activeTokens24h: marketStats.activeTraders24h,
        topGainers,
        topLosers,
        mostActive,
        newListings,
      };

      this.setCache(cacheKey, overview);
      return overview;
    } catch (error) {
      // ...existing code...
      return {
        totalMarketCap: 0,
        totalVolume24h: 0,
        totalTokens: 0,
        activeTokens24h: 0,
        topGainers: [],
        topLosers: [],
        mostActive: [],
        newListings: [],
      };
    }
  }

  /**
   * Subscribe to real-time market updates
   */
  subscribeToMarketUpdates(
    callback: (data: MarketOverview) => void,
  ): () => void {
    const subId = Math.random().toString(36);

    if (!this.subscriptions.has("market_updates")) {
      this.subscriptions.set("market_updates", new Set());
    }

    this.subscriptions.get("market_updates")!.add(callback);

    // Set up interval for real-time updates
    const interval = setInterval(async () => {
      const marketData = await this.getMarketOverview();
      callback(marketData);
    }, 30000); // Update every 30 seconds

    // Return unsubscribe function
    return () => {
      clearInterval(interval);
      this.subscriptions.get("market_updates")?.delete(callback);
    };
  }

  /**
   * Subscribe to token-specific analytics updates
   */
  subscribeToTokenAnalytics(
    mintAddress: string,
    callback: (data: TokenAnalytics) => void,
  ): () => void {
    const subKey = `token_${mintAddress}`;

    if (!this.subscriptions.has(subKey)) {
      this.subscriptions.set(subKey, new Set());
    }

    this.subscriptions.get(subKey)!.add(callback);

    // Set up interval for token updates
    const interval = setInterval(async () => {
      const analytics = await this.getTokenAnalytics(mintAddress);
      if (analytics) {
        callback(analytics);
      }
    }, 15000); // Update every 15 seconds

    return () => {
      clearInterval(interval);
      this.subscriptions.get(subKey)?.delete(callback);
    };
  }

  /**
   * Calculate market data for a token
   */
  private async calculateMarketData(
    token: any,
    priceData: any,
  ): Promise<MarketData> {
    const volume24h = await this.getVolume24h(token.id);
    const transactions24h = await this.getTransactions24h(token.id);

    return {
      price: priceData?.price || 0,
      priceChange24h: priceData?.priceChange24h || 0,
      priceChangePercent24h: priceData?.priceChangePercent24h || 0,
      volume24h,
      marketCap: token.market_cap || 0,
      holders: token.holders_count || 0,
      transactions24h,
      liquidity: await this.calculateLiquidity(token),
      lastUpdated: Date.now(),
    };
  }

  /**
   * Calculate technical indicators
   */
  private async calculateTechnicalIndicators(
    tokenId: string,
  ): Promise<TechnicalIndicators> {
    try {
      const priceHistory = await getTokenPriceHistory(tokenId, "30d");

      if (priceHistory.length === 0) {
        return {
          rsi: 50,
          volume_sma: 0,
          price_sma_7d: 0,
          price_sma_30d: 0,
          volatility: 0,
          momentum: 0,
        };
      }

      const prices = priceHistory.map((p: any) => p.price);
      const volumes = priceHistory.map((p: any) => p.volume || 0);

      return {
        rsi: this.calculateRSI(prices),
        volume_sma: this.calculateSMA(volumes, 7),
        price_sma_7d: this.calculateSMA(prices.slice(-7)),
        price_sma_30d: this.calculateSMA(prices),
        volatility: this.calculateVolatility(prices),
        momentum: this.calculateMomentum(prices),
      };
    } catch (error) {
      // ...existing code...
      return {
        rsi: 50,
        volume_sma: 0,
        price_sma_7d: 0,
        price_sma_30d: 0,
        volatility: 0,
        momentum: 0,
      };
    }
  }

  /**
   * Calculate social metrics (mock implementation - would integrate with social APIs)
   */
  private async calculateSocialMetrics(
    tokenId: string,
  ): Promise<SocialMetrics> {
    // This would integrate with Twitter API, Discord API, etc.
    return {
      sentiment_score: (Math.random() - 0.5) * 2, // -1 to 1
      mentions_24h: Math.floor(Math.random() * 1000),
      trending_rank: Math.floor(Math.random() * 100) + 1,
      community_activity: Math.random() * 100,
    };
  }

  /**
   * Calculate risk metrics
   */
  private async calculateRiskMetrics(
    token: any,
    marketData: MarketData,
  ): Promise<RiskMetrics> {
    return {
      liquidity_score: Math.min(100, (marketData.liquidity / 10000) * 100),
      volatility_score: Math.min(
        100,
        marketData.volume24h > 0
          ? Math.abs(marketData.priceChangePercent24h) * 2
          : 0,
      ),
      concentration_risk: this.calculateConcentrationRisk(token),
      smart_money_flow: (Math.random() - 0.5) * 200, // -100 to 100
    };
  }

  /**
   * Helper methods for calculations
   */
  private calculateTrendingScore(factors: {
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    age: number;
    holders: number;
  }): number {
    const weights = {
      priceChange: 0.3,
      volume: 0.25,
      marketCap: 0.15,
      age: 0.15,
      holders: 0.15,
    };

    const normalizedPriceChange = Math.max(
      0,
      Math.min(100, factors.priceChange24h + 50),
    );
    const normalizedVolume = Math.min(100, (factors.volume24h / 10000) * 100);
    const normalizedMarketCap = Math.min(
      100,
      (factors.marketCap / 100000) * 100,
    );
    const normalizedAge = Math.max(0, 100 - factors.age); // Newer is better
    const normalizedHolders = Math.min(100, (factors.holders / 1000) * 100);

    return (
      normalizedPriceChange * weights.priceChange +
      normalizedVolume * weights.volume +
      normalizedMarketCap * weights.marketCap +
      normalizedAge * weights.age +
      normalizedHolders * weights.holders
    );
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / avgLoss;

    return 100 - 100 / (1 + rs);
  }

  private calculateSMA(values: number[], period?: number): number {
    const data = period ? values.slice(-period) : values;
    if (data.length === 0) return 0;
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }

    const meanReturn =
      returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) /
      returns.length;

    return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility percentage
  }

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 2) return 0;
    const recent = prices.slice(-5);
    const earlier = prices.slice(-10, -5);

    if (recent.length === 0 || earlier.length === 0) return 0;

    const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, p) => sum + p, 0) / earlier.length;

    return ((recentAvg - earlierAvg) / earlierAvg) * 100;
  }

  private async getVolume24h(tokenId: any): Promise<number> {
    try {
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      // Get all completed transactions in the last 24h
      const response = await tradingAPI.getTokenTransactions(Number(tokenId), 0, 1000);
      const transactions = response.content;

      if (!transactions || transactions.length === 0) return 0;

      // Filter transactions within last 24h
      const recent24h = transactions.filter(
        (tx) =>
          new Date(tx.createdAt).getTime() >= new Date(yesterday).getTime(),
      );

      // Calculate total volume considering both buys and sells
      const volume = recent24h.reduce((sum: number, tx) => {
        const amount = tx.solAmount || 0;
        // Use pricePerToken * tokenAmount if available, otherwise use solAmount
        const txVolume =
          tx.pricePerToken && tx.tokenAmount
            ? tx.pricePerToken * tx.tokenAmount
            : amount;
        return sum + txVolume;
      }, 0);

      return volume;
    } catch (error) {
      // ...existing code...
      return 0;
    }
  }

  private async getTransactions24h(tokenId: string): Promise<number> {
    try {
      const response = await tradingAPI.getTokenTransactions(Number(tokenId), 0, 1000);
      const transactions = response.content;
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;

      return transactions.filter(
        (tx) => new Date(tx.createdAt).getTime() > yesterday,
      ).length;
    } catch {
      return 0;
    }
  }

  private async calculateLiquidity(token: any): Promise<number> {
    // This would calculate actual DEX liquidity
    return (token.market_cap || 0) * 0.1; // Mock: 10% of market cap
  }

  private calculateConcentrationRisk(token: any): number {
    // This would analyze holder distribution
    // TODO: Implement holders count in backend
    const holders = 1;
    return Math.max(0, 100 - Math.log10(holders) * 20);
  }

  private getTokenAge(createdAt: string): number {
    return Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000),
    );
  }

  private async getTopGainers(limit: number): Promise<TrendingToken[]> {
    // Would query database for top price gainers
    return [];
  }

  private async getTopLosers(limit: number): Promise<TrendingToken[]> {
    // Would query database for top price losers
    return [];
  }

  private async getMostActive(limit: number): Promise<TrendingToken[]> {
    // Would query database for highest volume tokens
    return [];
  }

  private async getNewListings(limit: number): Promise<TrendingToken[]> {
    // Would query database for recently created tokens
    return [];
  }

  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cached analytics without API call
   */
  getCachedAnalytics(mintAddress: string): TokenAnalytics | null {
    return this.getCached(`analytics_${mintAddress}`);
  }
}

// Create singleton instance
export const marketAnalyticsService = new MarketAnalyticsService();

// Helper functions for formatting
export function formatTrendingScore(score: number): string {
  return `${score.toFixed(1)}/100`;
}

export function formatRSI(rsi: number): string {
  if (rsi > 70) return `${rsi.toFixed(1)} (Overbought)`;
  if (rsi < 30) return `${rsi.toFixed(1)} (Oversold)`;
  return `${rsi.toFixed(1)} (Neutral)`;
}

export function formatSentiment(sentiment: number): {
  text: string;
  color: string;
} {
  if (sentiment > 0.3) return { text: "Bullish", color: "text-green-600" };
  if (sentiment < -0.3) return { text: "Bearish", color: "text-red-600" };
  return { text: "Neutral", color: "text-gray-600" };
}

export function formatRiskLevel(score: number): {
  text: string;
  color: string;
} {
  if (score > 70) return { text: "High Risk", color: "text-red-600" };
  if (score > 40) return { text: "Medium Risk", color: "text-yellow-600" };
  return { text: "Low Risk", color: "text-green-600" };
}
