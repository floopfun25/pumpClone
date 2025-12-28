<template>
  <div class="market-dashboard">
    <!-- Market Overview Header -->
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
    >
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          📊 Live Market Overview
        </h2>
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-sm text-green-600 dark:text-green-400"
            >Real-time</span
          >
          <button
            @click="refreshMarketData"
            :disabled="loading"
            class="ml-4 p-2 text-primary-600 hover:text-primary-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Refresh Market Data"
          >
            <div :class="loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'">⟳</div>
          </button>
        </div>
      </div>

      <!-- Market Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div class="text-center">
          <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {{ formatMarketCap(marketData.totalMarketCap) }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Total Market Cap
          </div>
        </div>

        <div class="text-center">
          <div class="text-3xl font-bold text-green-600 dark:text-green-400">
            {{ formatVolume(marketData.totalVolume24h) }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">24h Volume</div>
        </div>

        <div class="text-center">
          <div class="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {{ marketData.totalTokens.toLocaleString() }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Total Tokens
          </div>
        </div>

        <div class="text-center">
          <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {{ marketData.activeTokens24h.toLocaleString() }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Active 24h</div>
        </div>
      </div>
    </div>

    <!-- Trending Tokens Sections -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- Top Gainers -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            🚀 Top Gainers
          </h3>
          <span
            class="text-xs text-green-600 bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded"
          >
            24h
          </span>
        </div>

        <div v-if="marketOverview.topGainers.length > 0" class="space-y-3">
          <div
            v-for="token in marketOverview.topGainers.slice(0, 5)"
            :key="token.mint"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            @click="navigateToToken(token.mint)"
          >
            <div class="flex items-center space-x-3">
              <div
                class="w-8 h-8 rounded-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-bold"
              >
                {{ token.rank }}
              </div>
              <div>
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ token.name }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  ${{ token.symbol }}
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                ${{ formatPrice(token.price) }}
              </div>
              <div class="text-sm font-bold text-green-600">
                +{{ token.priceChange24h.toFixed(2) }}%
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <div class="text-4xl mb-2">📈</div>
          <p class="text-gray-500 dark:text-gray-400">
            No gainers data available
          </p>
        </div>
      </div>

      <!-- Top Losers -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            📉 Top Losers
          </h3>
          <span
            class="text-xs text-red-600 bg-red-100 dark:bg-red-900/20 px-2 py-1 rounded"
          >
            24h
          </span>
        </div>

        <div v-if="marketOverview.topLosers.length > 0" class="space-y-3">
          <div
            v-for="token in marketOverview.topLosers.slice(0, 5)"
            :key="token.mint"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            @click="navigateToToken(token.mint)"
          >
            <div class="flex items-center space-x-3">
              <div
                class="w-8 h-8 rounded-full bg-gradient-to-r from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-bold"
              >
                {{ token.rank }}
              </div>
              <div>
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ token.name }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  ${{ token.symbol }}
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                ${{ formatPrice(token.price) }}
              </div>
              <div class="text-sm font-bold text-red-600">
                {{ token.priceChange24h.toFixed(2) }}%
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <div class="text-4xl mb-2">📉</div>
          <p class="text-gray-500 dark:text-gray-400">
            No losers data available
          </p>
        </div>
      </div>
    </div>

    <!-- Most Active & New Listings -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Most Active -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            🔥 Most Active
          </h3>
          <span
            class="text-xs text-blue-600 bg-blue-100 dark:bg-blue-900/20 px-2 py-1 rounded"
          >
            Volume
          </span>
        </div>

        <div v-if="marketOverview.mostActive.length > 0" class="space-y-3">
          <div
            v-for="token in marketOverview.mostActive.slice(0, 5)"
            :key="token.mint"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            @click="navigateToToken(token.mint)"
          >
            <div class="flex items-center space-x-3">
              <div
                class="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold"
              >
                {{ token.rank }}
              </div>
              <div>
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ token.name }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  ${{ token.symbol }}
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                ${{ formatVolume(token.volume24h) }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                24h Volume
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <div class="text-4xl mb-2">🔥</div>
          <p class="text-gray-500 dark:text-gray-400">No active tokens data</p>
        </div>
      </div>

      <!-- New Listings -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            ✨ New Listings
          </h3>
          <span
            class="text-xs text-purple-600 bg-purple-100 dark:bg-purple-900/20 px-2 py-1 rounded"
          >
            Fresh
          </span>
        </div>

        <div v-if="marketOverview.newListings.length > 0" class="space-y-3">
          <div
            v-for="token in marketOverview.newListings.slice(0, 5)"
            :key="token.mint"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            @click="navigateToToken(token.mint)"
          >
            <div class="flex items-center space-x-3">
              <div
                class="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold"
              >
                NEW
              </div>
              <div>
                <div class="font-medium text-gray-900 dark:text-white">
                  {{ token.name }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  ${{ token.symbol }}
                </div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                ${{ formatPrice(token.price) }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                Just launched
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <div class="text-4xl mb-2">✨</div>
          <p class="text-gray-500 dark:text-gray-400">No new listings yet</p>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="mt-8 text-center">
      <div class="flex flex-wrap justify-center gap-4">
        <router-link to="/create" class="btn-primary">
          🚀 Create Token
        </router-link>
        <router-link to="/search" class="btn-secondary">
          🔍 Explore Tokens
        </router-link>
        <button @click="refreshMarketData" class="btn-secondary">
          📊 Refresh Data
        </button>
      </div>
    </div>

    <!-- Update Timestamp -->
    <div class="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
      Last updated: {{ lastUpdateTime }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import {
  marketAnalyticsService,
  type MarketOverview,
} from "@/services/marketAnalytics";
import {
  formatPrice,
  formatVolume,
  formatMarketCap,
} from "@/services/priceOracle";
import { MarketDataService } from "@/services/marketDataService";

const router = useRouter();

// State
const loading = ref(false);
const lastUpdateTime = ref("");

// Market data
const marketData = ref({
  totalMarketCap: 0,
  totalVolume24h: 0,
  totalTokens: 0,
  activeTokens24h: 0,
});

// Market overview
const marketOverview = ref<MarketOverview>({
  totalMarketCap: 0,
  totalVolume24h: 0,
  totalTokens: 0,
  activeTokens24h: 0,
  topGainers: [],
  topLosers: [],
  mostActive: [],
  newListings: [],
});

/**
 * Load market data
 */
const loadMarketData = async () => {
  try {
    loading.value = true;

    const data = await MarketDataService.getTotalMarketStats();
    if (data) {
      marketData.value = data;
    }
    marketOverview.value = await marketAnalyticsService.getMarketOverview();
    lastUpdateTime.value = new Date().toLocaleTimeString();
  } catch (error) {
    console.error("Failed to load market data:", error);
  } finally {
    loading.value = false;
  }
};

/**
 * Refresh market data manually
 */
const refreshMarketData = async () => {
  await loadMarketData();
};

/**
 * Navigate to token detail page
 */
const navigateToToken = (mintAddress: string) => {
  router.push(`/token/${mintAddress}`);
};

// Update market data periodically
let marketDataInterval: NodeJS.Timeout | null = null;

onMounted(async () => {
  await loadMarketData();
  marketDataInterval = setInterval(loadMarketData, 60000); // Update every minute
});

onUnmounted(() => {
  if (marketDataInterval) {
    clearInterval(marketDataInterval);
  }
});
</script>

<style scoped>
.market-dashboard {
  @apply w-full;
}

.card {
  @apply bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6;
}
</style>
