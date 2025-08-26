<template>
  <div
    class="enhanced-trading-interface bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
  >
    <!-- Header -->
    <div
      class="bg-gray-50 dark:bg-gray-900 px-6 py-4 md:px-6 md:py-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center justify-between">
        <h3
          class="text-xl md:text-lg font-semibold text-gray-900 dark:text-white"
        >
          {{ $t("token.trade") }} {{ tokenSymbol }}
        </h3>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-sm md:text-xs text-green-600 dark:text-green-400"
            >Live</span
          >
        </div>
      </div>
    </div>

    <!-- Trade Type Selector -->
    <div class="p-6 md:p-6 p-4 pb-4">
      <div class="grid grid-cols-2 gap-3 md:gap-2 mb-6">
        <button
          :class="[
            'py-4 md:py-3 px-4 rounded-lg font-semibold transition-all duration-200 border-2 text-base md:text-sm',
            tradeType === 'buy'
              ? 'bg-green-500 border-green-500 text-white shadow-lg'
              : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
          ]"
          @click="tradeType = 'buy'"
        >
          🚀 {{ $t("token.buy") }}
        </button>
        <button
          :class="[
            'py-4 md:py-3 px-4 rounded-lg font-semibold transition-all duration-200 border-2 text-base md:text-sm',
            tradeType === 'sell'
              ? 'bg-red-500 border-red-500 text-white shadow-lg'
              : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
          ]"
          @click="tradeType = 'sell'"
        >
          💰 {{ $t("token.sell") }}
        </button>
      </div>

      <!-- Quick Buy Buttons (Buy Mode Only) -->
      <div v-if="tradeType === 'buy'" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <span
            class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300"
            >Quick Buy</span
          >
          <span class="text-sm md:text-xs text-gray-500 dark:text-gray-400"
            >SOL Amount</span
          >
        </div>
        <div class="grid grid-cols-4 gap-3 md:gap-2">
          <button
            v-for="amount in quickBuyAmounts"
            :key="amount"
            @click="setTradeAmount(amount)"
            :class="[
              'py-3 md:py-2 px-3 text-sm font-medium rounded-lg border transition-all duration-200',
              parseFloat(tradeAmount) === amount
                ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600 text-green-700 dark:text-green-400'
                : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600',
            ]"
          >
            {{ amount }} SOL
          </button>
        </div>
      </div>

      <!-- Quick Sell Buttons (Sell Mode Only) -->
      <div v-if="tradeType === 'sell'" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <span
            class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300"
            >Quick Sell</span
          >
          <span class="text-sm md:text-xs text-gray-500 dark:text-gray-400"
            >% of Holdings</span
          >
        </div>
        <div class="grid grid-cols-4 gap-3 md:gap-2">
          <button
            v-for="percentage in quickSellPercentages"
            :key="percentage"
            @click="setSellPercentage(percentage)"
            class="py-3 md:py-2 px-3 text-sm font-medium rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
          >
            {{ percentage }}%
          </button>
        </div>
      </div>

      <!-- Amount Input -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <label
            class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {{ tradeType === "buy" ? "SOL Amount" : "Token Amount" }}
          </label>
          <div
            v-if="tradeType === 'sell'"
            class="text-sm md:text-xs text-gray-500 dark:text-gray-400"
          >
            Balance: {{ formatNumber(tokenBalance) }} {{ tokenSymbol }}
          </div>
        </div>

        <div class="relative">
          <input
            v-model="tradeAmount"
            type="number"
            :placeholder="tradeType === 'buy' ? '0.1' : '1000'"
            class="w-full px-4 py-4 md:py-3 text-lg font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            :step="tradeType === 'buy' ? '0.001' : '1'"
            :min="0"
            @input="calculateTradePreview"
          />
          <div
            class="absolute right-4 top-1/2 transform -translate-y-1/2 text-base md:text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            {{ tradeType === "buy" ? "SOL" : tokenSymbol }}
          </div>
        </div>
      </div>

      <!-- Trade Preview -->
      <div
        v-if="tradePreview"
        class="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <div class="flex items-center justify-between mb-3">
          <span
            class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300"
            >Trade Preview</span
          >
          <div class="flex items-center gap-1">
            <div
              class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"
            ></div>
            <span class="text-sm md:text-xs text-blue-600 dark:text-blue-400"
              >Live</span
            >
          </div>
        </div>

        <div class="space-y-2 text-base md:text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">
              {{
                tradeType === "buy" ? "You will receive" : "You will receive"
              }}
            </span>
            <span class="font-medium text-gray-900 dark:text-white">
              {{
                tradeType === "buy"
                  ? `${formatNumber(tradePreview.tokensOut)} ${tokenSymbol}`
                  : `${formatNumber(tradePreview.solOut)} SOL`
              }}
            </span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">Price Impact</span>
            <span
              :class="[
                'font-medium',
                Math.abs(tradePreview.priceImpact) > 5
                  ? 'text-red-500'
                  : 'text-gray-900 dark:text-white',
              ]"
            >
              {{ tradePreview.priceImpact > 0 ? "+" : ""
              }}{{ tradePreview.priceImpact.toFixed(2) }}%
            </span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400"
              >Platform Fee (1%)</span
            >
            <span class="font-medium text-gray-900 dark:text-white">
              {{ formatNumber(tradePreview.fees) }} SOL
            </span>
          </div>

          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">New Price</span>
            <span class="font-medium text-gray-900 dark:text-white">
              ${{ tradePreview.newPrice.toFixed(8) }}
            </span>
          </div>
        </div>

        <!-- Price Impact Warning -->
        <div
          v-if="Math.abs(tradePreview.priceImpact) > 5"
          class="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <div class="flex items-center gap-2">
            <span class="text-yellow-600 dark:text-yellow-400">⚠️</span>
            <span
              class="text-base md:text-sm text-yellow-800 dark:text-yellow-200 font-medium"
            >
              High price impact detected
            </span>
          </div>
        </div>
      </div>

      <!-- Slippage Settings -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <span
            class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300"
            >Slippage Tolerance</span
          >
          <button
            @click="showSlippageSettings = !showSlippageSettings"
            class="text-sm md:text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-2 px-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            {{ showSlippageSettings ? "Hide" : "Show" }}
          </button>
        </div>

        <div v-if="showSlippageSettings" class="space-y-3">
          <div class="grid grid-cols-3 gap-3 md:gap-2">
            <button
              v-for="preset in slippagePresets"
              :key="preset"
              @click="slippageTolerance = preset"
              :class="[
                'py-3 md:py-2 px-3 text-sm font-medium rounded-lg border transition-all duration-200',
                slippageTolerance === preset
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600',
              ]"
            >
              {{ preset }}%
            </button>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model.number="customSlippage"
              type="number"
              placeholder="Custom"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              step="0.1"
              min="0.1"
              max="50"
              @blur="handleCustomSlippageBlur"
            />
            <span class="text-sm text-gray-500 dark:text-gray-400">%</span>
          </div>
        </div>

        <div v-else class="text-right">
          <span class="text-sm font-medium text-gray-600 dark:text-gray-400"
            >{{ slippageTolerance }}%</span
          >
        </div>
      </div>

      <!-- Trade Button -->
      <button
        @click="executeTrade"
        :disabled="!canTrade"
        :class="[
          'w-full py-5 md:py-4 px-6 font-bold text-lg rounded-lg transition-all duration-200 shadow-lg',
          tradeType === 'buy'
            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
            : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white',
          !canTrade
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:shadow-xl active:scale-95',
        ]"
      >
        <span v-if="trading" class="flex items-center justify-center gap-2">
          <div
            class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
          ></div>
          Processing...
        </span>
        <span v-else>
          {{ tradeType === "buy" ? "🚀 Buy" : "💰 Sell" }} {{ tokenSymbol }}
        </span>
      </button>

      <!-- Trade Info -->
      <div class="mt-4 text-center">
        <div class="text-sm md:text-xs text-gray-500 dark:text-gray-400">
          <span>Powered by bonding curve • </span>
          <span>1% platform fee • </span>
          <span>No slippage on curve</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { BondingCurveService } from "@/services/bondingCurve";
import { useWalletStore } from "@/stores/wallet";

interface Props {
  tokenId: string;
  tokenSymbol: string;
  tokenPrice: number;
  bondingCurveState: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "trade-executed": [result: any];
  "connect-wallet": [];
}>();

// Stores
const walletStore = useWalletStore();

// State
const tradeType = ref<"buy" | "sell">("buy");
const tradeAmount = ref("");
const slippageTolerance = ref(3.0);
const customSlippage = ref<number | null>(null);
const showSlippageSettings = ref(false);
const trading = ref(false);
const tradePreview = ref<any>(null);
const tokenBalance = ref(0);
const updateInterval = ref<NodeJS.Timeout | null>(null);

// Constants
const quickBuyAmounts = [0.1, 0.5, 1, 2];
const quickSellPercentages = [25, 50, 75, 100];
const slippagePresets = [1, 3, 5];

// Computed
const canTrade = computed(() => {
  if (!walletStore.isConnected) return false;
  if (!tradeAmount.value || parseFloat(tradeAmount.value) <= 0) return false;
  if (trading.value) return false;

  if (tradeType.value === "sell") {
    return parseFloat(tradeAmount.value) <= tokenBalance.value;
  }

  return true;
});

// Methods
const setTradeAmount = (amount: number) => {
  tradeAmount.value = amount.toString();
  calculateTradePreview();
};

const setSellPercentage = (percentage: number) => {
  const amount = (tokenBalance.value * percentage) / 100;
  tradeAmount.value = amount.toString();
  calculateTradePreview();
};

const calculateTradePreview = async () => {
  if (!tradeAmount.value || parseFloat(tradeAmount.value) <= 0) {
    tradePreview.value = null;
    return;
  }

  try {
    const amount = parseFloat(tradeAmount.value);
    const amountBigInt = BigInt(
      Math.floor(amount * (tradeType.value === "buy" ? 1e9 : 1e6)),
    ); // Convert to lamports/tokens

    if (tradeType.value === "buy") {
      tradePreview.value = BondingCurveService.calculateBuy(
        props.bondingCurveState,
        amountBigInt,
      );
    } else {
      tradePreview.value = BondingCurveService.calculateSell(
        props.bondingCurveState,
        amountBigInt,
      );
    }
  } catch (error) {
    console.error("Failed to calculate trade preview:", error);
    tradePreview.value = null;
  }
};

const executeTrade = async () => {
  if (!canTrade.value) {
    if (!walletStore.isConnected) {
      emit("connect-wallet");
    }
    return;
  }

  trading.value = true;

  try {
    const result = await performTrade();
    emit("trade-executed", result);

    // Reset form
    tradeAmount.value = "";
    tradePreview.value = null;

    // Update token balance
    await loadTokenBalance();
  } catch (error) {
    console.error("Trade failed:", error);
  } finally {
    trading.value = false;
  }
};

const performTrade = async () => {
  try {
    const { realSolanaProgram } = await import('@/services/realSolanaProgram');
    const { PublicKey } = await import('@solana/web3.js');
    
    const mintAddress = new PublicKey(props.token.mint_address);
    const amount = parseFloat(tradeAmount.value);
    
    if (tradeType.value === 'buy') {
      // Execute real buy transaction
      const result = await realSolanaProgram.buyTokens(mintAddress, amount, 3);
      return {
        type: 'buy',
        amount,
        signature: result.signature,
        tokensReceived: result.tokensTraded,
        preview: tradePreview.value,
      };
    } else {
      // Execute real sell transaction
      const tokenAmount = BigInt(Math.floor(amount * Math.pow(10, props.token.decimals || 9)));
      const result = await realSolanaProgram.sellTokens(mintAddress, tokenAmount, 3);
      return {
        type: 'sell',
        amount,
        signature: result.signature,
        solReceived: result.solAmount,
        preview: tradePreview.value,
      };
    }
  } catch (error) {
    console.error('Trading error:', error);
    throw error;
  }
};

const loadTokenBalance = async () => {
  if (!walletStore.isConnected) {
    tokenBalance.value = 0;
    return;
  }

  try {
    // TODO: Load actual token balance from blockchain
    // Mock for now
    tokenBalance.value = 10000;
  } catch (error) {
    console.error("Failed to load token balance:", error);
    tokenBalance.value = 0;
  }
};

const formatNumber = (num: number | bigint): string => {
  const n = typeof num === "bigint" ? Number(num) / 1e6 : num;
  return new Intl.NumberFormat().format(n);
};

const handleCustomSlippageBlur = () => {
  if (
    customSlippage.value &&
    customSlippage.value >= 0.1 &&
    customSlippage.value <= 50
  ) {
    slippageTolerance.value = customSlippage.value;
  }
};

// Watchers
watch(
  () => tradeAmount.value,
  () => {
    calculateTradePreview();
  },
);

watch(
  () => tradeType.value,
  () => {
    tradeAmount.value = "";
    tradePreview.value = null;
  },
);

// Lifecycle
onMounted(() => {
  loadTokenBalance();

  // Update preview every 3 seconds
  updateInterval.value = setInterval(() => {
    if (tradeAmount.value) {
      calculateTradePreview();
    }
  }, 3000);
});

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
  }
});
</script>

<style scoped>
.enhanced-trading-interface {
  max-width: 100%;
}

/* Mobile-specific optimizations */
@media (max-width: 768px) {
  .enhanced-trading-interface {
    @apply rounded-lg;
  }

  /* Better mobile touch targets */
  button {
    @apply min-h-[44px];
  }

  /* Improved mobile form elements */
  input[type="number"] {
    @apply text-lg;
    -webkit-appearance: none;
    -moz-appearance: textfield;
  }

  /* Remove number input arrows on mobile */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Better mobile grid spacing */
  .grid {
    @apply gap-3;
  }

  /* Improve mobile button interactions */
  button:active {
    @apply scale-95;
  }

  /* Better mobile preview section */
  .trade-preview {
    @apply text-base;
  }
}

/* Custom scrollbar for any overflow */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
}

*::-webkit-scrollbar {
  width: 6px;
}

*::-webkit-scrollbar-track {
  background: transparent;
}

*::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 20px;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.8);
}

/* Animation for loading states */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Button hover effects */
button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}
</style>
