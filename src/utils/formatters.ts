/**
 * Global formatting utilities for consistent display across the application
 * Prevents scientific notation and provides user-friendly number formats
 */

/**
 * Format numbers for display (volume, market cap, holders, etc.)
 * Shows actual small numbers with appropriate decimal places
 */
export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || num === 0) {
    return "0";
  }

  // Handle negative numbers
  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum >= 1_000_000_000) {
    return `${sign}${(absNum / 1_000_000_000).toFixed(2)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${sign}${(absNum / 1_000_000).toFixed(2)}M`;
  }
  if (absNum >= 1_000) {
    return `${sign}${(absNum / 1_000).toFixed(2)}K`;
  }
  if (absNum >= 1) {
    return `${sign}${absNum.toFixed(2)}`;
  }
  if (absNum >= 0.01) {
    return `${sign}${absNum.toFixed(3)}`;
  }
  if (absNum >= 0.0001) {
    return `${sign}${absNum.toFixed(4)}`;
  }
  if (absNum >= 0.000001) {
    return `${sign}${absNum.toFixed(6)}`;
  }
  // For extremely small numbers, show up to 8 decimal places
  return `${sign}${absNum.toFixed(8)}`;
}

/**
 * Format prices for display
 * Shows actual small numbers with appropriate decimal places
 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null || price === 0) {
    return "0.00";
  }

  // Handle very small prices - show actual value with more decimals
  if (price > 0 && price < 0.000001) {
    return price.toFixed(8);
  }
  if (price < 0.001) {
    return price.toFixed(7);
  }
  if (price < 0.01) {
    return price.toFixed(6);
  }
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}

/**
 * Format percentage changes
 */
export function formatPriceChange(change: number | undefined | null): string {
  if (change === undefined || change === null) {
    return "0.00";
  }
  return change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
}

/**
 * Format volume specifically
 */
export function formatVolume(volume: number | undefined | null): string {
  if (volume === undefined || volume === null || volume === 0) {
    return "0";
  }

  if (volume >= 1e9) {
    return `${(volume / 1e9).toFixed(2)}B`;
  }
  if (volume >= 1e6) {
    return `${(volume / 1e6).toFixed(2)}M`;
  }
  if (volume >= 1e3) {
    return `${(volume / 1e3).toFixed(2)}K`;
  }
  if (volume >= 1) {
    return volume.toFixed(2);
  }
  if (volume >= 0.01) {
    return volume.toFixed(3);
  }
  if (volume >= 0.0001) {
    return volume.toFixed(4);
  }
  if (volume >= 0.000001) {
    return volume.toFixed(6);
  }

  return volume.toFixed(8);
}

/**
 * Format market cap specifically
 */
export function formatMarketCap(marketCap: number | undefined | null): string {
  if (marketCap === undefined || marketCap === null || marketCap === 0) {
    return "0";
  }

  if (marketCap >= 1e9) {
    return `${(marketCap / 1e9).toFixed(2)}B`;
  }
  if (marketCap >= 1e6) {
    return `${(marketCap / 1e6).toFixed(2)}M`;
  }
  if (marketCap >= 1e3) {
    return `${(marketCap / 1e3).toFixed(2)}K`;
  }
  if (marketCap >= 1) {
    return marketCap.toFixed(2);
  }
  if (marketCap >= 0.01) {
    return marketCap.toFixed(3);
  }
  if (marketCap >= 0.0001) {
    return marketCap.toFixed(4);
  }
  if (marketCap >= 0.000001) {
    return marketCap.toFixed(6);
  }

  return marketCap.toFixed(8);
}

/**
 * Format token amounts (for balances, supplies, etc.)
 */
export function formatTokenAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || amount === 0) {
    return "0";
  }

  if (amount >= 1e9) {
    return `${(amount / 1e9).toFixed(2)}B`;
  }
  if (amount >= 1e6) {
    return `${(amount / 1e6).toFixed(2)}M`;
  }
  if (amount >= 1e3) {
    return `${(amount / 1e3).toFixed(2)}K`;
  }

  return amount.toLocaleString();
}

/**
 * Format very small decimals (like token prices in wei/lamports)
 */
export function formatSmallDecimals(
  value: number | undefined | null,
  decimals: number = 6,
): string {
  if (value === undefined || value === null || value === 0) {
    return "0";
  }

  if (value > 0 && value < Math.pow(10, -decimals)) {
    return `<${Math.pow(10, -decimals)}`;
  }

  return value.toFixed(decimals);
}

/**
 * Check if a number would display in scientific notation
 */
export function wouldBeScientificNotation(num: number): boolean {
  return Math.abs(num) < 1e-6 || Math.abs(num) >= 1e21;
}

/**
 * Safe number formatting that never returns scientific notation
 */
export function safeFormatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || num === 0) {
    return "0";
  }

  if (wouldBeScientificNotation(num)) {
    if (num > 0 && num < 1e-6) {
      return "<0.000001";
    }
    if (num >= 1e21) {
      return `${(num / 1e12).toFixed(2)}T+`;
    }
  }

  return formatNumber(num);
}
