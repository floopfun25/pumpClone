<template>
  <!-- Token Detail Page -->
  <div class="min-h-screen bg-binance-dark">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center min-h-screen">
      <div class="spinner w-12 h-12"></div>
    </div>

    <!-- Token Content -->
    <div v-else class="py-8">
      <div class="container mx-auto px-4">
        <!-- Error State -->
        <div v-if="error" class="text-center py-12">
          <div class="text-6xl mb-4">❌</div>
          <h2 class="text-2xl font-semibold text-white mb-2">{{ error }}</h2>
          <router-link to="/" class="btn-primary">{{
            $t("common.back")
          }}</router-link>
        </div>

        <!-- Token Header - Binance Style -->
        <div
          v-else
          class="bg-binance-card rounded-xl shadow-sm border border-binance-border p-4 mb-8"
        >
          <div class="flex items-center gap-3 text-sm flex-wrap">
            <!-- Token Logo (small, inline with text) -->
            <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img
                v-if="token?.image_url"
                :src="token.image_url"
                :alt="tokenName"
                class="w-full h-full object-cover"
                @load="
                  () =>
                    console.log(
                      '✅ [TOKEN DETAIL] Small logo loaded successfully:',
                      token.image_url,
                    )
                "
                @error="
                  (e: Event) =>
                    console.error(
                      '❌ [TOKEN DETAIL] Small logo failed to load:',
                      token.image_url,
                      e,
                    )
                "
              />
              <div
                v-else
                class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs"
              >
                {{ tokenSymbol.slice(0, 1) }}
              </div>
            </div>

            <!-- Token Name & Symbol -->
            <span class="font-medium text-white">
              {{ tokenName }} ({{ tokenSymbol }})
            </span>

            <span class="text-binance-gray">|</span>

            <!-- Creator with link -->
            <router-link
              v-if="token?.creator"
              :to="`/profile/${token.creator.wallet_address}`"
              class="text-binance-blue hover:text-blue-300 font-medium transition-colors"
            >
              {{
                token.creator.username ||
                formatWalletAddress(token.creator.wallet_address)
              }}
            </router-link>
            <span v-else class="text-binance-gray">Unknown Creator</span>

            <span class="text-binance-gray">|</span>

            <!-- Time ago -->
            <span class="text-binance-gray">
              {{ formatTimeAgo(token?.created_at) }}
            </span>

            <span class="text-binance-gray">|</span>

            <!-- Market Cap -->
            <span class="text-white">
              <span class="text-binance-gray">market cap:</span>
              <span class="font-semibold ml-1">{{ formattedMarketCap }}</span>
            </span>

            <span class="text-binance-gray">|</span>

            <!-- Replies Count -->
            <span class="text-white">
              <span class="text-binance-gray">replies:</span>
              <span class="font-semibold ml-1">{{ commentsCount }}</span>
            </span>
          </div>
        </div>

        <div
          v-if="!error"
          class="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-8 gap-4"
        >
          <!-- Left Column: Chart & Comments (2/3 width) -->
          <div class="lg:col-span-2 space-y-6 md:space-y-6 space-y-4">
            <!-- Price Chart -->
            <ErrorBoundary
              title="Chart Loading Error"
              message="The price chart couldn't load properly."
              show-reload
            >
              <TokenChart
                ref="chartComponentRef"
                v-if="token?.id"
                :token-id="token.id"
                :token-symbol="token.symbol"
                :mint-address="token.mint_address"
                class="mobile-chart"
              />
            </ErrorBoundary>

            <!-- Mobile Trading Interface - Show under chart on mobile only (when connected) -->
            <div v-if="walletStore.isConnected" class="lg:hidden mobile-trading-section">
              <ErrorBoundary
                title="Trading Interface Error"
                message="The trading interface couldn't load properly."
              >
                <TradingInterface
                  :token-symbol="tokenSymbol"
                  :bonding-curve-state="bondingCurveState"
                  :wallet-balance="walletStore.balance"
                  :token-balance="userTokenBalance"
                  :token-mint="token.value?.mint_address"
                  :token-decimals="tokenDecimals"
                  @trade="handleTrade"
                  @connect-wallet="connectWallet"
                />
              </ErrorBoundary>
            </div>

            <!-- Comments Section -->
            <ErrorBoundary
              title="Comments Loading Error"
              message="The comments section couldn't load properly."
            >
              <TokenComments
                v-if="token?.id"
                :token-id="Number(token.id)"
                :token-creator="token.creator?.wallet_address"
                @connect-wallet="connectWallet"
                class="mobile-comments"
              />
            </ErrorBoundary>
          </div>

          <!-- Right Sidebar: Trading & Token Info (1/3 width) - Desktop Only -->
          <div class="hidden lg:block space-y-4 mobile-sidebar">
            <!-- Trading Interface (only show when wallet is connected) -->
            <ErrorBoundary
              v-if="walletStore.isConnected"
              title="Trading Interface Error"
              message="The trading interface couldn't load properly."
            >
              <TradingInterface
                :token-symbol="tokenSymbol"
                :bonding-curve-state="bondingCurveState"
                :wallet-balance="walletStore.balance"
                :token-balance="userTokenBalance"
                :token-mint="token.value?.mint_address"
                :token-decimals="tokenDecimals"
                @trade="handleTrade"
                @connect-wallet="connectWallet"
              />
            </ErrorBoundary>

            <!-- Token Info Card -->
            <div
              class="bg-binance-card rounded-xl border border-binance-border p-6 md:p-4 mobile-info-card"
            >
              <h3 class="text-lg md:text-base font-semibold text-white mb-4">
                Token Info
              </h3>
              <div class="space-y-3 md:space-y-2 text-base md:text-sm">
                <div class="flex justify-between">
                  <span class="text-binance-gray">Price:</span>
                  <span class="font-medium text-white"
                    >${{ currentPrice?.toFixed(8) || "0.00000000" }}</span
                  >
                </div>
                <div class="flex justify-between">
                  <span class="text-binance-gray">Market Cap:</span>
                  <span class="font-medium text-white">{{
                    formattedMarketCap
                  }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-binance-gray">Holders:</span>
                  <span class="font-medium text-white">{{
                    token?.holder_count || 0
                  }}</span>
                </div>
                <div v-if="token?.website" class="flex justify-between">
                  <span class="text-binance-gray">Website:</span>
                  <a
                    :href="token.website"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-binance-blue hover:underline"
                  >
                    Visit
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import { PublicKey, Transaction, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { tokenAPI, tradingAPI } from "@/services/api";
import { useWalletStore } from "@/stores/wallet";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { pumpTradingService } from "@/services/pumpTradingService";
import {
  marketAnalyticsService,
  type TokenAnalytics,
} from "@/services/marketAnalytics";
import TokenComments from "@/components/token/TokenComments.vue";
import TokenChart from "@/components/charts/TokenChart.vue";
import TradingInterface from "@/components/token/TradingInterface.vue";
import ErrorBoundary from "@/components/common/ErrorBoundary.vue";
import { BondingCurveService } from "@/services/bondingCurve";
import {
  RealTimePriceService,
  type RealPriceData,
} from "@/services/realTimePriceService";
import { config } from "@/config";
import { solanaConfig } from "@/config/index";
import { simpleBalanceService } from "@/services/simpleBalanceService";
import { bondingCurveProgram } from "@/services/bondingCurveProgram";

const route = useRoute();
const router = useRouter();
const walletStore = useWalletStore();
const uiStore = useUIStore();
const authStore = useAuthStore();

// State
const loading = ref(true);
const error = ref("");

// Real token data from Supabase
const token = ref<any>(null);
const recentTrades = ref<any[]>([]);
const topHolders = ref<any[]>([]);

// Market analytics data
const tokenAnalytics = ref<TokenAnalytics | null>(null);
let analyticsSubscription: (() => void) | null = null;

// Real-time bonding curve state
const bondingCurveState = ref<any>(null);
const bondingProgress = ref<any>(null);
const lastPriceUpdate = ref<Date>(new Date());
const priceUnsubscribe = ref<(() => void) | null>(null);

// Watchlist state
const isInWatchlist = ref(false);
const watchlistLoading = ref(false);

// User token balance (for trading)
const userTokenBalance = ref(0); // Store human-readable balance directly
const tokenDecimals = ref(6); // Default to 6 decimals (pump.fun standard)
// Load token data on page mount
onMounted(async () => {
  await loadPublicTokenData();

  // Load token balance if wallet is already connected
  if (walletStore.isConnected && walletStore.walletAddress && token.value?.mint_address) {
    try {
      console.log("🔄 [MOUNT] Loading fresh balance from blockchain");
      await loadUserTokenBalance(true); // Force refresh from blockchain
      console.log("✅ [MOUNT] Fresh balance loaded on mount");
    } catch (error) {
      console.error("❌ [MOUNT] Failed to load balance on mount:", error);
    }
  }
});

// Watch for wallet connection changes to load balances
watch(
  () => walletStore.isConnected,
  async (isConnected) => {
    if (isConnected && walletStore.walletAddress && token.value?.mint_address) {
      try {
        console.log("🔄 [WALLET WATCH] Loading fresh balance after wallet connection");
        await loadUserTokenBalance(true); // Force refresh from blockchain
        console.log("✅ [WALLET WATCH] Fresh balance loaded after wallet connection");
      } catch (error) {
        console.error("❌ [WALLET WATCH] Failed to load balance:", error);
      }
    } else if (!isConnected) {
      userTokenBalance.value = 0;
      console.log("🔄 [WALLET WATCH] Cleared balance after wallet disconnection");
    }
  },
);

// Watch for token loading to trigger balance loading
watch(
  () => token.value?.mint_address,
  async (mintAddress) => {
    if (mintAddress && walletStore.isConnected && walletStore.walletAddress) {
      try {
        console.log("🔄 [TOKEN WATCH] Loading fresh balance for new token");
        await loadUserTokenBalance(true); // Force refresh from blockchain
        console.log("✅ [TOKEN WATCH] Fresh balance loaded for new token");
      } catch (error) {
        console.error("❌ [TOKEN WATCH] Failed to load balance:", error);
      }
    }
  },
);

// Debug watcher for chart rendering
watch(
  () => token.value?.id,
  (newId) => {
    if (newId) {
      console.log("[DEBUG] Rendering TokenChart for token.id:", newId);
    }
  },
);

// Computed properties for display
const tokenName = computed(() => token.value?.name || "Unknown Token");
const tokenSymbol = computed(() => token.value?.symbol || "N/A");
const tokenDescription = computed(
  () => token.value?.description || "No description available.",
);

// Computed properties
const formattedMarketCap = computed(() => {
  // Use bonding curve state market cap if available, otherwise fall back to token data
  const marketCap =
    bondingCurveState.value?.marketCap || token.value?.market_cap || 0;
  return `${formatNumber(marketCap)}`;
});

const progressPercentage = computed(() => {
  if (!bondingProgress.value) return 0;
  return Math.min(100, bondingProgress.value.progress || 0);
});

// Computed for comments count from token data
const commentsCount = computed(() => {
  // This would typically come from the token's comments relation
  // For now, we'll use a placeholder or fetch separately
  return token.value?.comments_count || 0;
});

const shareData = computed(() => ({
  title: token.value ? `${token.value.name} (${token.value.symbol})` : "",
  description:
    token.value?.description ||
    "Check out this amazing meme token on FloppFun!",
  url: `${window.location.origin}/token/${token.value?.mint_address || ""}`,
  hashtags: [
    "FloppFun",
    "memecoins",
    "Solana",
    token.value?.symbol || "",
  ].filter(Boolean),
}));

const priceChangeColor = computed(() => {
  const change = token.value?.price_change_24h || 0;
  return change >= 0 ? "text-pump-green" : "text-pump-red";
});

// ENV admin wallet
const ADMIN_WALLET = import.meta.env.VITE_ADMIN_WALLET;

// Admin state
const isAdmin = computed(() => {
  const pubKey = walletStore.walletAddress || walletStore.publicKey;
  return pubKey && ADMIN_WALLET && pubKey.toString() === ADMIN_WALLET;
});

/**
 * Connect wallet handler
 */
const connectWallet = async () => {
  try {
    // Open wallet modal using the correct UI store method
    uiStore.showModal("wallet");

    // Set up listener for successful wallet connection
    const unwatch = watchEffect(() => {
      if (walletStore.isConnected && walletStore.walletAddress) {
        // Authenticate user with Supabase when wallet connects
        authenticateUserWithWallet();
        unwatch(); // Remove watcher after first execution
      }
    });
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    uiStore.showToast({
      type: "error",
      title: "Connection Failed",
      message: "Failed to connect wallet. Please try again.",
    });
  }
};

/**
 * Simple authentication for trading (using Spring Boot backend)
 */
const authenticateForTrading = async () => {
  if (!walletStore.walletAddress) {
    throw new Error("Wallet not connected");
  }

  try {
    console.log("🔐 [AUTH] Starting authentication for trading...");
    console.log("🔍 [AUTH] Wallet address:", walletStore.walletAddress);

    // Use authStore to sign in with wallet (JWT-based)
    if (!authStore.isAuthenticated) {
      await authStore.signInWithWallet();
      console.log("✅ [AUTH] Authentication successful");
    } else {
      console.log("✅ [AUTH] Already authenticated");
    }

    // Load user token balance after authentication
    await loadUserTokenBalance();

    return { user: authStore.user };
  } catch (error: any) {
    console.error("❌ [AUTH] Authentication failed:", error);
    throw new Error(
      `Authentication failed: ${error.message || "Unknown error"}`,
    );
  }
};

/**
 * Authenticate user with wallet for trading and commenting
 */
const authenticateUserWithWallet = async () => {
  try {
    if (!walletStore.walletAddress) return;

    // Check if already authenticated with the same wallet
    if (
      authStore.isAuthenticated &&
      authStore.user?.wallet_address === walletStore.walletAddress
    ) {
      console.log("✅ User already authenticated");
      return;
    }

    console.log("🔐 Authenticating user with Supabase...");

    // Use the simple authentication method for better mobile compatibility
    await authenticateForTrading();

    console.log("✅ User authenticated for trading and commenting");

    // 🔄 Load token balance after authentication
    if (walletStore.walletAddress && token.value?.mint_address) {
      try {
        console.log("🔄 Loading fresh balance after authentication");
        await loadUserTokenBalance(true); // Force refresh
        console.log("✅ Fresh balance loaded after authentication");
      } catch (balanceError) {
        console.error("❌ Failed to load balance after authentication:", balanceError);
      }
    }
  } catch (error) {
    console.error("❌ Failed to authenticate user:", error);
    // Show info message about authentication being optional for viewing
    uiStore.showToast({
      type: "info",
      title: "Authentication Optional",
      message:
        "You can view token info without authentication. Authentication is required for trading and commenting.",
    });
  }
};

/**
 * Pre-trade checks and authentication
 */
async function prepareForTrade(): Promise<boolean> {
  if (!authStore.isAuthenticated || !authStore.user) {
    uiStore.showToast({
      type: "info",
      title: "Setting up trading...",
      message: "Preparing your wallet for trading...",
    });
    try {
      await authenticateForTrading();
      uiStore.showToast({
        type: "success",
        title: "Ready to Trade!",
        message: "Your wallet is now set up for trading.",
      });
      return true;
    } catch (authError: any) {
      uiStore.showToast({
        type: "error",
        title: "Setup Failed",
        message:
          authError.message || "Failed to set up trading. Please try again.",
      });
      return false;
    }
  }
  return true;
}

/**
 * Handle trade from TradingInterface component
 */
const handleTrade = async (tradeData: {
  type: "buy" | "sell";
  amount: number;
  preview: any;
}) => {
  if (!walletStore.isConnected) {
    uiStore.showToast({
      type: "error",
      title: "Wallet Not Connected",
      message: "Please connect your wallet to trade",
    });
    return;
  }

  if (!token.value?.mint_address) {
    uiStore.showToast({
      type: "error",
      title: "Token Not Found",
      message: "Token information is not available",
    });
    return;
  }

  if (!(await prepareForTrade())) {
    return; // Stop if authentication fails
  }

  // Check if token has graduated
  if (bondingCurveState.value?.isGraduated) {
    uiStore.showToast({
      type: "error",
      title: "Token Graduated",
      message: "This token has graduated to DEX. Trade on PumpSwap instead.",
    });
    return;
  }

  try {
    uiStore.setLoading(true);

    // Make sure balance is fresh before trade
    await walletStore.updateBalance();

    const mintAddress = new PublicKey(token.value.mint_address);
    const { type, amount, preview } = tradeData;

    // Removed price impact confirmation dialog

    let signature: string;

    if (type === "buy") {
      // Execute buy transaction using pump trading service
      const result = await pumpTradingService.buyTokens(mintAddress, amount);
      signature = result.signature;

      const tokensReceived = Number(result.tokensTraded) / Math.pow(10, token.value?.decimals || 9);
      
      uiStore.showToast({
        type: "success",
        title: "Buy Order Successful! 🎉",
        message: `Bought ${tokensReceived.toFixed(6)} ${tokenSymbol.value} for ${amount} SOL`,
      });
    } else {
      // CRITICAL FIX: Refresh balance before sell to prevent selling more than owned
      await loadUserTokenBalance(true); // Force refresh
      
      // Convert base units amount back to human-readable for validation
      const actualDecimals = tokenDecimals.value || token.value?.decimals || 6; // Use actual token decimals
      const humanReadableAmount = Number(amount) / Math.pow(10, actualDecimals);
      
      console.log(`🔍 [SELL VALIDATION] Debug:
        Token decimals: ${actualDecimals}
        Amount (base units): ${amount}
        Human readable amount: ${humanReadableAmount}
        User balance: ${userTokenBalance.value}
        Validation passes: ${humanReadableAmount <= userTokenBalance.value}
      `);
      
      if (humanReadableAmount > userTokenBalance.value) {
        uiStore.showToast({
          type: "error",
          title: "Insufficient Balance",
          message: `Cannot sell ${humanReadableAmount.toFixed(6)} tokens. You only have ${userTokenBalance.value.toFixed(6)} tokens.`,
        });
        return;
      }

      // Execute sell transaction using pump trading service
      const result = await pumpTradingService.sellTokens(mintAddress, BigInt(amount));
      signature = result.signature;

      const humanReadableTokenAmount = (
        amount / Math.pow(10, token.value?.decimals || 9)
      ).toFixed(6);
      const humanReadableSolAmount = (Number(result.solAmount) / LAMPORTS_PER_SOL).toFixed(6);

      uiStore.showToast({
        type: "success",
        title: "Sell Order Successful! 💰",
        message: `Sold ${humanReadableTokenAmount} ${tokenSymbol.value} for ${humanReadableSolAmount} SOL`,
      });
    }

    // After a successful trade, refresh all relevant data
    await refreshAllTokenData();

    // 💰 CRITICAL: Refresh wallet SOL balance after transaction
    await walletStore.updateBalance();
    console.log("💰 Wallet balance refreshed after trade");

    // 🔄 Update balance after trade using simple balance service
    if (walletStore.walletAddress && token.value?.mint_address) {
      try {
        // Update balance after trade (clears cache and fetches fresh)
        await simpleBalanceService.updateBalanceAfterTrade(
          walletStore.walletAddress,
          token.value.mint_address,
          type,
          type === "buy" ? BigInt(amount * 1e9) : BigInt(amount), // Rough estimate for cache clearing
        );
        
        // Reload balance to update UI
        await loadUserTokenBalance(true);
        
        console.log("✅ Balance updated and refreshed after", type, "transaction");
      } catch (balanceError) {
        console.error("❌ Failed to refresh balance after trade:", balanceError);
        // Try simple refresh
        try {
          await loadUserTokenBalance(true);
        } catch (fallbackError) {
          console.error("❌ Balance refresh fallback also failed:", fallbackError);
        }
      }
    }

    console.log(`✅ ${type} transaction completed:`, signature);
  } catch (error: any) {
    console.error("❌ [TRADE] Trade failed:", error);
    console.error("❌ [TRADE] Error details:", {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details,
    });

    let errorMessage = "An unexpected error occurred during the trade";
    let errorTitle = "Trade Failed";

    // Handle specific error types
    if (
      error.code === "42501" ||
      error.message.includes("row-level security")
    ) {
      errorTitle = "Database Permission Error";
      errorMessage =
        "Your wallet session has expired. Please refresh the page and try again.";
      console.log("🔄 [TRADE] RLS error detected - clearing auth state");
      // Clear auth state to force fresh authentication
      await authStore.signOut();
    } else if (error.message.includes("Insufficient")) {
      errorMessage = error.message;
    } else if (error.message.includes("Slippage")) {
      errorMessage =
        "Price moved too much during trade. Try again with higher slippage tolerance.";
    } else if (error.message.includes("graduated")) {
      errorMessage = "This token has graduated to DEX trading.";
    } else if (error.message.includes("Forbidden") || error.status === 403) {
      errorTitle = "Permission Denied";
      errorMessage =
        "Database access denied. Please refresh the page and reconnect your wallet.";
      console.log("🔄 [TRADE] 403 error detected - clearing auth state");
      await authStore.signOut();
    } else if (
      error.message.includes("network") ||
      error.message.includes("fetch")
    ) {
      errorTitle = "Network Error";
      errorMessage =
        "Failed to connect to the trading service. Please check your internet connection and try again.";
    }

    uiStore.showToast({
      type: "error",
      title: errorTitle,
      message: errorMessage,
    });
  } finally {
    uiStore.setLoading(false);
  }
};

/**
 * Refreshes all data related to the token after a state change like a trade.
 */
async function refreshAllTokenData() {
  if (!token.value?.id) return;
  console.log("🔄 Refreshing all token data...");
  await Promise.all([
    RealTimePriceService.forceUpdate(token.value.id),
    loadBondingCurveData(),
    loadPublicTokenData(),
    loadPrivateUserData(),
  ]);
  // Explicitly tell the chart to reload its data.
  // The refreshChart function already handles cache clearing.
  refreshChart();
}

/**
 * Load real top holders data from database
 */
const loadTopHolders = async () => {
  if (!token.value?.id) {
    console.warn("No token ID available for loading top holders");
    return;
  }

  try {
    console.log("🔄 Top holders not yet implemented in backend");
    // TODO: Implement getTokenTopHolders in backend API
    topHolders.value = [];
    console.log("ℹ️ No holders data available yet");
  } catch (error) {
    console.error("❌ Failed to load top holders:", error);
    // Keep empty array on error
    topHolders.value = [];
  }
};

/**
 * Load user's token balance for trading (directly from blockchain)
 */
const loadUserTokenBalance = async (forceRefresh: boolean = false) => {
  if (
    !walletStore.isConnected ||
    !walletStore.walletAddress ||
    !token.value?.mint_address
  ) {
    userTokenBalance.value = 0;
    return;
  }

  try {
    console.log("📊 Loading user token balance from blockchain...", {
      forceRefresh,
      walletAddress: walletStore.walletAddress.slice(0, 8) + "...",
      tokenMint: token.value.mint_address.slice(0, 8) + "...",
    });

    // Get balance directly from blockchain
    const balanceInfo = await simpleBalanceService.getTokenBalance(
      walletStore.walletAddress,
      token.value.mint_address,
      forceRefresh,
    );

    // Store the human-readable balance directly
    userTokenBalance.value = balanceInfo.humanReadable;
    tokenDecimals.value = balanceInfo.decimals;

    console.log(
      "✅ User token balance loaded from blockchain:",
      balanceInfo.humanReadable,
      "tokens, Decimals:",
      balanceInfo.decimals,
      "Account exists:",
      balanceInfo.exists,
    );
  } catch (error) {
    console.error("❌ Failed to load user token balance:", error);
    userTokenBalance.value = 0; // Reset balance on error
  }
};

/**
 * Load public token data from Supabase
 */
const loadPublicTokenData = async () => {
  try {
    const mintAddress = route.params.mintAddress as string;

    if (!mintAddress) {
      throw new Error("No mint address provided");
    }

    // Fetch token data from Spring Boot backend
    const tokenData = await tokenAPI.getTokenByMint(mintAddress);

    if (!tokenData) {
      throw new Error("Token not found");
    }

    // Convert backend format to expected format
    token.value = {
      id: tokenData.id.toString(),
      mint_address: tokenData.mintAddress,
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description,
      image_url: tokenData.imageUrl,
      metadata_uri: tokenData.metadataUri,
      creator_id: tokenData.creatorId?.toString(),
      total_supply: tokenData.totalSupply,
      current_price: tokenData.currentPrice,
      market_cap: tokenData.marketCap,
      volume_24h: 0,
      holders_count: 0,
      status: tokenData.hasGraduated ? 'graduated' : 'active',
      graduated_at: tokenData.graduatedAt,
      created_at: tokenData.createdAt,
      updated_at: tokenData.createdAt,
      bonding_curve_progress: 0,
      sol_in_bonding_curve: tokenData.solInBondingCurve,
      virtual_sol_reserves: tokenData.virtualSolReserves,
      virtual_token_reserves: tokenData.virtualTokenReserves,
      creator: tokenData.creator,
      comments_count: 0,
    };

    console.log("[DEBUG] token.value after backend fetch:", token.value);

    console.log("🔍 [TOKEN DETAIL] Public token data loaded:", {
      id: tokenData.id,
      name: tokenData.name,
    });

    // Load transactions from backend
    try {
      const transactionsResponse = await tradingAPI.getTokenTransactions(tokenData.id, 0, 10);
      recentTrades.value = transactionsResponse.content.map((tx: any) => ({
        id: tx.id,
        type: tx.transactionType,
        amount: `${(tx.solAmount / 1e9).toFixed(3)} SOL`,
        time: formatTimeAgo(tx.createdAt),
        user: tx.walletAddress?.substring(0, 4) + '...' + tx.walletAddress?.substring(tx.walletAddress.length - 4),
      }));
    } catch (err) {
      console.log("Could not load transactions:", err);
      recentTrades.value = [];
    }

    // Comments not yet implemented in backend
    token.value.comments_count = 0;

    // Load market analytics (does not require auth)
    try {
      const analytics =
        await marketAnalyticsService.getTokenAnalytics(mintAddress);
      tokenAnalytics.value = analytics;

      if (analyticsSubscription) analyticsSubscription();

      analyticsSubscription = marketAnalyticsService.subscribeToTokenAnalytics(
        mintAddress,
        (updatedAnalytics) => {
          tokenAnalytics.value = updatedAnalytics;
        },
      );
    } catch (analyticsError) {
      console.warn("Failed to load token analytics:", analyticsError);
    }
  } catch (err) {
    console.error("Failed to load token:", err);
    error.value = err instanceof Error ? err.message : "Failed to load token";

    if (err instanceof Error && err.message.includes("not found")) {
      router.push("/404");
    }
  } finally {
    loading.value = false;
  }
};

/**
 * Load private data that requires authentication
 */
const loadPrivateUserData = async () => {
  if (!authStore.isAuthenticated || !token.value?.id) {
    console.log(
      "ℹ️ Skipping private data load: user not authenticated or no token ID.",
    );
    userTokenBalance.value = 0;
    topHolders.value = [];
    isInWatchlist.value = false;
    return;
  }

  console.log("🔄 Loading private user data...");
  try {
    await Promise.all([
      loadTopHolders(),
      loadUserTokenBalance(),
      checkWatchlistStatus(),
    ]);
    console.log("✅ Private user data loaded successfully.");
  } catch (error) {
    console.error("❌ Failed to load private user data:", error);
  }
};

/**
 * Format time ago helper
 */
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return "just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

/**
 * Format number helper for large numbers
 */
const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toString();
};

/**
 * Format wallet address for display
 */
const formatWalletAddress = (address: string): string => {
  if (!address) return "Unknown";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

/**
 * Format contract address for display
 */
const formatContractAddress = (address: string): string => {
  if (!address) return "N/A";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Copy text to clipboard
 */
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    uiStore.showToast({
      type: "success",
      title: "Copied!",
      message: "Address copied to clipboard",
    });
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    uiStore.showToast({
      type: "error",
      title: "Copy Failed",
      message: "Failed to copy address",
    });
  }
};

const bondingCurveConfig = config.bondingCurve;

const loadBondingCurveData = async () => {
  if (!token.value) return;

  try {
    console.log("🔄 Loading bonding curve data for token:", token.value.id);

    // Load real bonding curve state using the service
    const curveState = await BondingCurveService.getTokenBondingCurveState(
      token.value.id,
    );
    bondingCurveState.value = curveState;

    // Load progress data - use data from token directly
    bondingProgress.value = {
      progress: curveState.progress || 0,
      currentSol: token.value.sol_in_bonding_curve || 0,
      targetSol: 85, // Default graduation threshold
    };

    // Update last price update time
    lastPriceUpdate.value = new Date();

    console.log("✅ Bonding curve data loaded:", {
      price: curveState.currentPrice,
      progress: curveState.progress,
      marketCap: curveState.marketCap,
      graduated: curveState.isGraduated,
    });

    // Set up real-time price updates every 10 seconds
    if (priceUnsubscribe.value) {
      priceUnsubscribe.value();
    }

    priceUnsubscribe.value = RealTimePriceService.subscribe(
      token.value.id,
      (updatedPrice: RealPriceData) => {
        bondingCurveState.value = {
          ...bondingCurveState.value,
          currentPrice: updatedPrice.price,
          marketCap: updatedPrice.marketCap,
        };
        bondingProgress.value = {
          ...bondingProgress.value,
          progress: updatedPrice.progress,
        };
        lastPriceUpdate.value = new Date();
        console.log("🔄 Price updated:", {
          price: updatedPrice.price,
          progress: updatedPrice.progress,
        });
      },
    );
  } catch (error) {
    console.error("Failed to load bonding curve data:", error);

    // Fallback to basic progress calculation
    bondingProgress.value = {
      progress: 0,
      currentSol: token.value?.sol_in_bonding_curve || 0,
      targetSol: 85,
    };
  }
};

const chartComponentRef = ref<InstanceType<typeof TokenChart> | null>(null);

/**
 * Force chart to reload data
 */
const refreshChart = () => {
  if (!token.value?.id) return;

  // Clear cache and force re-fetch
  RealTimePriceService.clearCacheForToken(token.value.id);

  // Call the child component's method directly via the ref
  if (chartComponentRef.value) {
    // Re-apply the currently selected timeframe to force a refresh
    chartComponentRef.value.setTimeframe(
      chartComponentRef.value.selectedTimeframe,
    );
    console.log("✅ Chart refresh triggered via component ref.");
  } else {
    console.warn("⚠️ Could not refresh chart: component ref not available.");
  }
};

/**
 * Computed property for real-time price display
 */
const currentPrice = computed(() => {
  if (bondingCurveState.value?.currentPrice) {
    return Number(bondingCurveState.value.currentPrice);
  }
  return Number(token.value?.current_price) || 0;
});

/**
 * Check if token is in user's watchlist
 */
const checkWatchlistStatus = async () => {
  if (
    !authStore.isAuthenticated ||
    !authStore.user?.id ||
    !token.value?.id
  ) {
    isInWatchlist.value = false;
    return;
  }

  try {
    // TODO: Implement watchlist in backend API
    isInWatchlist.value = false;
    // isInWatchlist.value = await userAPI.isTokenInWatchlist(authStore.user.id, token.value.id);
  } catch (error) {
    console.error("Failed to check watchlist status:", error);
    isInWatchlist.value = false;
  }
};

/**
 * Toggle token in/out of watchlist
 */
const toggleWatchlist = async () => {
  if (!authStore.isAuthenticated) {
    uiStore.showToast({
      type: "error",
      title: "Authentication Required",
      message: "Please connect your wallet to use watchlist",
    });
    return;
  }

  if (!authStore.user?.id || !token.value?.id) {
    uiStore.showToast({
      type: "error",
      title: "Error",
      message: "Unable to update watchlist at this time",
    });
    return;
  }

  watchlistLoading.value = true;

  try {
    // TODO: Implement watchlist in backend API
    uiStore.showToast({
      type: "info",
      title: "Coming Soon",
      message: "Watchlist feature will be available soon",
    });

    // if (isInWatchlist.value) {
    //   await userAPI.removeFromWatchlist(authStore.user.id, token.value.id);
    //   isInWatchlist.value = false;
    //   uiStore.showToast({
    //     type: "success",
    //     title: "Removed from Watchlist",
    //     message: `${token.value.name} has been removed from your watchlist`,
    //   });
    // } else {
    //   await userAPI.addToWatchlist(authStore.user.id, token.value.id);
    //   isInWatchlist.value = true;
    //   uiStore.showToast({
    //     type: "success",
    //     title: "Added to Watchlist",
    //     message: `${token.value.name} has been added to your watchlist`,
    //   });
    // }
  } catch (error: any) {
    console.error("Failed to toggle watchlist:", error);

    let errorMessage = "Failed to update watchlist";
    let errorTitle = "Watchlist Error";

    if (error.message.includes("already in your watchlist")) {
      errorMessage = "Token is already in your watchlist";
      isInWatchlist.value = true;
    } else if (
      error.message.includes("not yet available") ||
      error.message.includes("database migration")
    ) {
      errorTitle = "Feature Not Available";
      errorMessage =
        "Watchlist feature requires database setup. Please run the SQL migration first.";
    }

    uiStore.showToast({
      type: "error",
      title: errorTitle,
      message: errorMessage,
    });
  } finally {
    watchlistLoading.value = false;
  }
};

/**
 * Initialize bonding curve for the token (admin only)
 */
const initLoading = ref(false);
const initError = ref("");
const initSuccess = ref(false);

const initializeBondingCurve = async () => {
  if (!token.value?.mint_address) {
    initError.value = "No mint address found.";
    return;
  }
  const creatorRaw = walletStore.walletAddress || walletStore.publicKey;
  if (!creatorRaw) {
    initError.value = "No admin wallet connected.";
    return;
  }
  const creator =
    typeof creatorRaw === "string" ? new PublicKey(creatorRaw) : creatorRaw;
  initLoading.value = true;
  initError.value = "";
  initSuccess.value = false;
  try {
    console.log(
      "[ADMIN] Initializing bonding curve for mint:",
      token.value.mint_address,
    );
    const mint = new PublicKey(token.value.mint_address);
    
    // Use bonding curve program service to initialize
    const { bondingCurveProgram } = await import("@/services/bondingCurveProgram");
    const signature = await bondingCurveProgram.initializeBondingCurve(
      mint,
      BigInt(1_000_000_000 * Math.pow(10, 9)), // Default total supply
    );
    
    console.log("[ADMIN] Bonding curve initialized:", signature);
    initSuccess.value = true;
    await refreshAllTokenData();
  } catch (e: any) {
    console.error("[ADMIN] Bonding curve init error:", e);
    initError.value = e.message || "Initialization failed";
  } finally {
    initLoading.value = false;
  }
};
</script>

<style scoped>
/* Add any component-specific styles here */

/* Spinner animation */
.spinner {
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
