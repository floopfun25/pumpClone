<template>
  <div
    class="bg-binance-card rounded-xl border border-binance-border p-6 mobile-trading-card"
  >
    <!-- Buy/Sell Toggle -->
    <div class="grid grid-cols-2 gap-2 mb-4">
      <button
        :class="[
          'py-3 px-4 text-base font-medium rounded-lg transition-colors',
          tradeType === 'buy'
            ? 'bg-binance-green text-white'
            : 'bg-trading-elevated text-binance-gray hover:text-white hover:bg-trading-surface border border-binance-border',
        ]"
        @click="tradeType = 'buy'"
      >
        buy
      </button>
      <button
        :class="[
          'py-3 px-4 text-base font-medium rounded-lg transition-colors',
          tradeType === 'sell'
            ? 'bg-binance-red text-white'
            : 'bg-trading-elevated text-binance-gray hover:text-white hover:bg-trading-surface border border-binance-border',
        ]"
        @click="tradeType = 'sell'"
      >
        sell
      </button>
    </div>

    <!-- Balance Display -->
    <div class="text-base text-binance-gray mb-4">
      balance:
      <span class="font-medium text-white">
        {{ displayBalance }}
      </span>
    </div>

    <!-- Authentication Status -->
    <div
      v-if="walletStore.isConnected && !authStore.isAuthenticated"
      class="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
    >
      <div class="flex items-center gap-2 text-yellow-400 text-sm">
        <div class="w-4 h-4">⚠️</div>
        <span>Setting up trading... Click 'Buy' or 'Sell' to continue</span>
      </div>
    </div>

    <!-- Authentication Success -->
    <div
      v-if="walletStore.isConnected && authStore.isAuthenticated"
      class="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
    >
      <div class="flex items-center gap-2 text-green-400 text-sm">
        <div class="w-4 h-4">✅</div>
        <span>Ready to trade!</span>
      </div>
    </div>

    <!-- Amount Input -->
    <div class="mb-4">
      <div
        class="flex items-center border border-binance-border rounded-lg bg-trading-elevated"
      >
        <input
          v-model="tradeAmount"
          type="number"
          placeholder="0.00"
          class="flex-1 px-4 py-3 bg-transparent text-white focus:outline-none text-base"
          step="0.001"
          min="0"
          :max="maxAmount"
          @input="handleAmountInput"
        />
        <span
          class="px-4 py-3 text-base text-binance-gray border-l border-binance-border"
        >
          {{ tradeType === "buy" ? "SOL" : tokenSymbol }}
        </span>
      </div>
    </div>

    <!-- Trade Preview -->
    <div
      v-if="showTradePreview"
      class="mb-4 p-4 bg-trading-elevated rounded-lg border border-binance-border"
    >
      <div class="space-y-2 text-base">
        <div class="flex justify-between">
          <span class="text-binance-gray">
            {{ tradeType === "buy" ? "Tokens received:" : "SOL received:" }}
          </span>
          <span class="font-medium text-white">
            {{
              tradeType === "buy"
                ? `${tradePreview.tokensReceived.toFixed(6)} ${tokenSymbol}`
                : `${Math.abs(tradePreview.solSpent).toFixed(6)} SOL`
            }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-binance-gray">Price impact:</span>
          <span
            :class="[
              'font-medium',
              Math.abs(tradePreview.priceImpact) > 5
                ? 'text-binance-red'
                : 'text-white',
            ]"
          >
            {{ tradePreview.priceImpact.toFixed(2) }}%
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-binance-gray">New price:</span>
          <span class="font-medium text-white">
            {{ tradePreview.newPrice.toFixed(9) }} SOL
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-binance-gray">Platform fee:</span>
          <span class="font-medium text-white">
            {{ tradePreview.platformFee.toFixed(6) }} SOL
          </span>
        </div>
      </div>
    </div>

    <!-- Quick Amount Buttons -->
    <div class="grid grid-cols-4 gap-2 mb-4">
      <button
        v-for="amount in quickAmounts"
        :key="amount"
        @click="setQuickAmount(amount)"
        :disabled="!isValidQuickAmount(amount)"
        class="py-3 px-2 text-sm bg-trading-elevated text-binance-gray border border-binance-border rounded hover:bg-trading-surface hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ amount }}
        {{
          amount !== "max" ? (tradeType === "buy" ? "SOL" : tokenSymbol) : ""
        }}
      </button>
    </div>

    <!-- Trade Button -->
    <button
      @click="executeTrade"
      :disabled="!canTrade"
      class="w-full py-4 px-4 font-semibold text-lg rounded-lg transition-all duration-200 active:scale-95"
      :class="[
        tradeType === 'buy'
          ? 'bg-binance-green hover:bg-trading-buy text-white'
          : 'bg-binance-red hover:bg-trading-sell text-white',
        !canTrade ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg',
      ]"
    >
      <span v-if="trading" class="flex items-center justify-center gap-2">
        <div
          class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
        ></div>
        Processing...
      </span>
      <span v-else>
        {{ tradeType === "buy" ? "Buy with SOL" : `Sell for ${tokenSymbol}` }}
      </span>
    </button>

    <!-- Error Display -->
    <div
      v-if="error"
      class="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
    >
      <div class="text-red-400 text-sm">{{ error }}</div>
      <!-- Quick fix button for liquidity errors -->
      <div v-if="isLiquidityError" class="mt-2">
        <button
          @click="useRecommendedAmount"
          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
        >
          Use Max Available ({{ recommendedAmount }} tokens)
        </button>
      </div>
    </div>
    <!-- Connected Toast -->
    <div
      v-if="showConnectedToast"
      class="fixed top-4 right-4 z-50 flex items-center space-x-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 shadow-lg text-sm font-medium"
      style="pointer-events: none"
    >
      <span class="text-pump-green">🟢 Connected:</span>
      <span class="font-mono">{{ walletStore.publicKey }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useWalletStore } from "@/stores/wallet";
import { useAuthStore } from "@/stores/auth";
import { BondingCurveService } from "@/services/bondingCurve";

interface Props {
  tokenSymbol: string;
  bondingCurveState: any;
  walletBalance?: number; // in SOL
  tokenBalance?: number; // in human-readable tokens
  tokenMint?: string; // mint address for decimals
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props & { tokenDecimals?: number }>(), {
  walletBalance: 0,
  tokenBalance: 0,
  tokenMint: "",
  tokenDecimals: 6, // Default to 6 decimals (pump.fun standard)
  disabled: false,
});

const emit = defineEmits<{
  trade: [{ type: "buy" | "sell"; amount: number; preview: any }];
  "connect-wallet": [];
}>();

// Stores
const walletStore = useWalletStore();
const authStore = useAuthStore();
// Toast state
const showConnectedToast = ref(false);

// State
const tradeType = ref<"buy" | "sell">("buy");
const tradeAmount = ref(""); // always human-readable
const tradePreview = ref<any>(null);
const trading = ref(false);
const error = ref("");
const tokenDecimals = ref(props.tokenDecimals ?? 6);
const recommendedAmount = ref("0");

// Computed properties
const displayBalance = computed(() => {
  if (!walletStore.isConnected) return "Connect wallet";
  if (tradeType.value === "buy") {
    return `${(props.walletBalance || walletStore.balance).toFixed(4)} SOL`;
  } else {
    // Show human-readable token balance
    return `${props.tokenBalance.toFixed(6)} ${props.tokenSymbol}`;
  }
});

const maxAmount = computed(() => {
  if (!walletStore.isConnected) return 0;

  if (tradeType.value === "buy") {
    // Reserve small amount for transaction fees
    const maxSol = (props.walletBalance || walletStore.balance) - 0.01;
    return Math.max(0, maxSol);
  } else {
    return props.tokenBalance;
  }
});

const quickAmounts = computed(() => {
  if (tradeType.value === "buy") {
    return ["0.1", "0.5", "1", "max"];
  } else {
    return ["25%", "50%", "75%", "max"];
  }
});

const canTrade = computed(() => {
  if (props.disabled || trading.value) return false;
  if (!walletStore.isConnected) return false;
  if (!authStore.isAuthenticated) return false; // Authentication required for trading
  if (!tradeAmount.value || parseFloat(tradeAmount.value) <= 0) return false;

  const amount = parseFloat(tradeAmount.value);
  if (tradeType.value === "buy") {
    return amount <= maxAmount.value;
  } else {
    return amount <= props.tokenBalance;
  }
});

// Trade Preview should always show if tradeAmount > 0 and bondingCurveState exists
const showTradePreview = computed(() => {
  return (
    tradePreview.value &&
    parseFloat(tradeAmount.value) > 0 &&
    props.bondingCurveState
  );
});

// Detect liquidity errors and extract recommended amount
const isLiquidityError = computed(() => {
  return error.value.includes("Insufficient liquidity") || error.value.includes("💧");
});

// Extract recommended amount from error message
const extractRecommendedAmount = (errorMsg: string): string => {
  const match = errorMsg.match(/Maximum you can sell now: ([\d.]+) tokens/);
  return match ? match[1] : "0";
};

// Methods
const handleAmountInput = () => {
  error.value = "";
  calculateTradePreview();
};

const setQuickAmount = (amount: string) => {
  try {
    if (amount === "max") {
      tradeAmount.value = maxAmount.value.toString();
    } else if (tradeType.value === "buy") {
      tradeAmount.value = amount;
    } else {
      // Percentage for sell orders (human-readable)
      const percentage = parseFloat(amount.replace("%", "")) / 100;
      const calculatedAmount = props.tokenBalance * percentage;
      // Round to whole tokens for cleaner display, or use max 2 decimals if needed
      tradeAmount.value = calculatedAmount >= 1
        ? Math.floor(calculatedAmount).toString()
        : calculatedAmount.toFixed(2);
    }
    calculateTradePreview();
  } catch (err) {
    error.value = "Failed to set amount";
  }
};

const isValidQuickAmount = (amount: string): boolean => {
  if (amount === "max") return maxAmount.value > 0;

  if (tradeType.value === "buy") {
    const amountNum = parseFloat(amount);
    return amountNum <= maxAmount.value;
  } else {
    return props.tokenBalance > 0;
  }
};

const calculateTradePreview = () => {
  const amount = parseFloat(tradeAmount.value);
  if (!amount || amount <= 0 || !props.bondingCurveState) {
    tradePreview.value = null;
    return;
  }

  try {
    const currentState = props.bondingCurveState;

    if (tradeType.value === "buy") {
      tradePreview.value = BondingCurveService.calculateBuyTrade(
        amount,
        currentState.virtualSolReserves,
        currentState.virtualTokenReserves,
        currentState.realTokenReserves,
      );
    } else {
      tradePreview.value = BondingCurveService.calculateSellTrade(
        amount,
        currentState.virtualSolReserves,
        currentState.virtualTokenReserves,
        currentState.realTokenReserves,
      );
    }
  } catch (err) {
    console.warn("Failed to calculate trade preview:", err);
    tradePreview.value = null;
    error.value = "Failed to calculate trade preview";
  }
};

const executeTrade = async () => {
  if (!canTrade.value) {
    if (!walletStore.isConnected) {
      emit("connect-wallet");
    }
    return;
  }

  const amount = parseFloat(tradeAmount.value);
  if (!amount || amount <= 0) {
    error.value = "Please enter a valid amount";
    return;
  }

  try {
    trading.value = true;
    error.value = "";

    // Convert to base units for backend
    let baseAmount = amount;
    if (tradeType.value === "sell") {
      baseAmount = amount * Math.pow(10, tokenDecimals.value);
      
      console.log(`🔍 [TRADING INTERFACE] Sell conversion debug:
        User input: ${amount} tokens
        Token decimals: ${tokenDecimals.value}
        Conversion: ${amount} * 10^${tokenDecimals.value} = ${baseAmount}
        Base amount: ${baseAmount}
      `);
    }
    emit("trade", {
      type: tradeType.value,
      amount: baseAmount,
      preview: tradePreview.value,
    });

    // Clear form on successful trade
    tradeAmount.value = "";
    tradePreview.value = null;
  } catch (err: any) {
    error.value = err.message || "Trade failed";
    // Extract recommended amount from liquidity errors
    if (error.value.includes("💧") || error.value.includes("Insufficient liquidity")) {
      recommendedAmount.value = extractRecommendedAmount(error.value);
    }
  } finally {
    trading.value = false;
  }
};

// Use the recommended amount from liquidity error
const useRecommendedAmount = () => {
  if (recommendedAmount.value && parseFloat(recommendedAmount.value) > 0) {
    tradeAmount.value = recommendedAmount.value;
    error.value = "";
    calculateTradePreview();
  }
};

// Watchers
watch(
  () => tradeType.value,
  () => {
    tradeAmount.value = "";
    tradePreview.value = null;
    error.value = "";
  },
);

watch(
  () => props.bondingCurveState,
  () => {
    if (tradeAmount.value) {
      calculateTradePreview();
    }
  },
);

// Show connected toast for 3 seconds when wallet connects
watch(
  () => walletStore.isConnected,
  (isConnected, prev) => {
    if (isConnected && !prev) {
      showConnectedToast.value = true;
      setTimeout(() => {
        showConnectedToast.value = false;
      }, 3000);
    }
  },
);

// Watch for prop changes to tokenDecimals
watch(
  () => props.tokenDecimals,
  (newDecimals) => {
    if (newDecimals !== undefined) {
      tokenDecimals.value = newDecimals;
      console.log(`🔄 [TRADING INTERFACE] Token decimals updated to: ${newDecimals}`);
    }
  },
);

// Lifecycle
onMounted(() => {
  // Token decimals are now passed as props from parent component
  console.log(`🔍 [TRADING INTERFACE] Mounted with token decimals: ${tokenDecimals.value}`);
});
</script>

<style scoped>
/* Mobile-specific optimizations */
@media (max-width: 768px) {
  .mobile-trading-card {
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  /* Better mobile button interactions */
  button:active {
    transform: scale(0.95);
  }

  /* Improve mobile touch targets */
  button {
    min-height: 44px;
  }

  /* Better mobile form elements */
  input[type="number"] {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: textfield;
  }

  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

/* Improve mobile touch interactions */
@media (max-width: 768px) {
  .mobile-trading-card button {
    min-height: 48px;
  }

  .mobile-trading-card input {
    min-height: 48px;
  }
}
</style>
