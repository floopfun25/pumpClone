export interface ApiHealthStatus {
  service: string;
  status: "healthy" | "degraded" | "down";
  lastChecked: Date;
  lastSuccess: Date | null;
  consecutiveFailures: number;
  responseTime?: number;
  errorMessage?: string;
}

export interface FallbackEvent {
  service: string;
  mint?: string;
  fallbackType: "mock_price" | "mock_metadata" | "database_fallback";
  timestamp: Date;
  reason: string;
}

class ApiHealthMonitor {
  private healthStatus = new Map<string, ApiHealthStatus>();
  private fallbackEvents: FallbackEvent[] = [];
  private maxFallbackEvents = 100; // Keep last 100 fallback events
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeServices();
    this.startHealthChecks();
  }

  /**
   * Initialize service health status
   */
  private initializeServices(): void {
    const services = ["birdeye", "jupiter", "token_metadata", "price_oracle"];

    services.forEach((service) => {
      this.healthStatus.set(service, {
        service,
        status: "healthy",
        lastChecked: new Date(),
        lastSuccess: null,
        consecutiveFailures: 0,
      });
    });
  }

  /**
   * Record API success
   */
  recordSuccess(service: string, responseTime?: number): void {
    const status = this.healthStatus.get(service);
    if (status) {
      this.healthStatus.set(service, {
        ...status,
        status: "healthy",
        lastChecked: new Date(),
        lastSuccess: new Date(),
        consecutiveFailures: 0,
        responseTime,
        errorMessage: undefined,
      });
    }
  }

  /**
   * Record API failure
   */
  recordFailure(service: string, errorMessage: string): void {
    const status = this.healthStatus.get(service);
    if (status) {
      const consecutiveFailures = status.consecutiveFailures + 1;
      let newStatus: "healthy" | "degraded" | "down" = "healthy";

      if (consecutiveFailures >= 5) {
        newStatus = "down";
      } else if (consecutiveFailures >= 2) {
        newStatus = "degraded";
      }

      this.healthStatus.set(service, {
        ...status,
        status: newStatus,
        lastChecked: new Date(),
        consecutiveFailures,
        errorMessage,
      });

      // Log critical failures
      if (newStatus === "down") {
        // console.warn(`🚨 API Service ${service} is DOWN - ${consecutiveFailures} consecutive failures`)
      }
    }
  }

  /**
   * Record fallback usage
   */
  recordFallback(
    service: string,
    fallbackType: FallbackEvent["fallbackType"],
    reason: string,
    mint?: string,
  ): void {
    const event: FallbackEvent = {
      service,
      fallbackType,
      timestamp: new Date(),
      reason,
      mint,
    };

    this.fallbackEvents.unshift(event);

    // Keep only the last maxFallbackEvents
    if (this.fallbackEvents.length > this.maxFallbackEvents) {
      this.fallbackEvents = this.fallbackEvents.slice(
        0,
        this.maxFallbackEvents,
      );
    }

    console.info(
      `⚠️ Using fallback for ${service}: ${fallbackType} - ${reason}`,
    );
  }

  /**
   * Get health status for a service
   */
  getServiceHealth(service: string): ApiHealthStatus | null {
    return this.healthStatus.get(service) || null;
  }

  /**
   * Get all service health status
   */
  getAllServiceHealth(): ApiHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get recent fallback events
   */
  getRecentFallbacks(limit: number = 20): FallbackEvent[] {
    return this.fallbackEvents.slice(0, limit);
  }

  /**
   * Get fallback summary by service
   */
  getFallbackSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    this.fallbackEvents.forEach((event) => {
      summary[event.service] = (summary[event.service] || 0) + 1;
    });

    return summary;
  }

  /**
   * Check if we're heavily using fallbacks
   */
  isUsingFallbacksHeavily(): boolean {
    const recentEvents = this.fallbackEvents.filter(
      (event) => Date.now() - event.timestamp.getTime() < 60 * 60 * 1000, // Last hour
    );

    return recentEvents.length > 10; // More than 10 fallbacks in last hour
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Run health checks every 5 minutes
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthChecks();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Perform health checks on external services
   */
  private async performHealthChecks(): Promise<void> {
    const checks = [this.checkBirdeyeHealth(), this.checkJupiterHealth()];

    await Promise.allSettled(checks);
  }

  /**
   * Check Birdeye API health
   */
  private async checkBirdeyeHealth(): Promise<void> {
    const start = Date.now();
    try {
      const apiKey = import.meta.env.VITE_BIRDEYE_API_KEY;

      if (
        !apiKey ||
        apiKey === "demo" ||
        apiKey === "your_birdeye_api_key_here"
      ) {
        this.recordFailure("birdeye", "No valid API key configured");
        return;
      }

      const response = await fetch(
        "https://public-api.birdeye.so/defi/price?address=So11111111111111111111111111111111111111112", // SOL
        {
          headers: { "X-API-KEY": apiKey },
        },
      );

      const responseTime = Date.now() - start;

      if (response.ok) {
        this.recordSuccess("birdeye", responseTime);
      } else {
        this.recordFailure("birdeye", `HTTP ${response.status}`);
      }
    } catch (error) {
      this.recordFailure(
        "birdeye",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Check Jupiter API health
   */
  private async checkJupiterHealth(): Promise<void> {
    const start = Date.now();
    try {
      const response = await fetch(
        "https://price.jup.ag/v4/price?ids=So11111111111111111111111111111111111111112",
      );

      const responseTime = Date.now() - start;

      if (response.ok) {
        this.recordSuccess("jupiter", responseTime);
      } else {
        this.recordFailure("jupiter", `HTTP ${response.status}`);
      }
    } catch (error) {
      this.recordFailure(
        "jupiter",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Get overall system health
   */
  getOverallHealth(): "healthy" | "degraded" | "critical" {
    const services = Array.from(this.healthStatus.values());
    const downServices = services.filter((s) => s.status === "down").length;
    const degradedServices = services.filter(
      (s) => s.status === "degraded",
    ).length;

    if (downServices > 0 || this.isUsingFallbacksHeavily()) {
      return "critical";
    } else if (degradedServices > 0) {
      return "degraded";
    } else {
      return "healthy";
    }
  }

  /**
   * Clean up when service is destroyed
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const apiHealthMonitor = new ApiHealthMonitor();
export default apiHealthMonitor;
