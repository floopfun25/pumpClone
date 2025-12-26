<template>
  <div
    class="bonding-curve-progress bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t("tokenDetail.progressToDEX") }}
      </h3>
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <span class="text-xs text-blue-600 dark:text-blue-400">{{
          $t("tokenDetail.realTime")
        }}</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mb-6">
      <div class="flex justify-between items-center mb-3">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ $t("tokenDetail.goal69K") }}
        </span>
        <span class="text-lg font-bold text-blue-600 dark:text-blue-400">
          {{ progressData?.progress.toFixed(1) || 0 }}%
        </span>
      </div>

      <!-- Animated Progress Bar -->
      <div
        class="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden"
      >
        <!-- Background gradient -->
        <div
          class="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20"
        ></div>

        <!-- Progress fill -->
        <div
          class="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-1000 ease-out relative overflow-hidden"
          :style="{ width: `${Math.min(progressData?.progress || 0, 100)}%` }"
        >
          <!-- Shimmer effect -->
          <div
            class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
          ></div>
        </div>

        <!-- Graduation marker at 100% -->
        <div class="absolute right-0 top-0 h-full w-1 bg-yellow-400"></div>
      </div>

      <!-- Progress Labels -->
      <div
        class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2"
      >
        <span>${{ formatNumber(progressData?.currentMarketCap || 0) }}</span>
        <span class="text-yellow-600 dark:text-yellow-400 font-medium">
          🎯 ${{ formatNumber(progressData?.graduationThreshold || 69000) }}
        </span>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div
        class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"
      >
        <div
          class="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium"
        >
          {{ $t("token.marketCap") }}
        </div>
        <div class="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
          ${{ formatNumber(progressData?.currentMarketCap || 0) }}
        </div>
      </div>

      <div
        class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800"
      >
        <div
          class="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide font-medium"
        >
          Remaining
        </div>
        <div class="text-xl font-bold text-green-900 dark:text-green-100 mt-1">
          ${{ formatNumber(progressData?.remaining || 0) }}
        </div>
      </div>
    </div>

    <!-- Graduation Status -->
    <div v-if="progressData?.graduated" class="mb-6">
      <div
        class="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center"
          >
            🎓
          </div>
          <div>
            <div
              class="text-sm font-semibold text-yellow-800 dark:text-yellow-200"
            >
              {{ $t("token.graduated") }}!
            </div>
            <div class="text-xs text-yellow-700 dark:text-yellow-300">
              Token successfully graduated to Raydium DEX
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Graduation Info -->
    <div
      v-else
      class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
    >
      <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
        {{ $t("tokenDetail.graduationDescription") }}
      </h4>
      <div class="text-xs text-gray-600 dark:text-gray-400 space-y-2">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
          <span>$12K liquidity will be deposited to Raydium</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
          <span>LP tokens will be burned (permanent lock)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
          <span>Creator receives 0.5 SOL reward</span>
        </div>
      </div>
    </div>

    <!-- Real-time Updates -->
    <div class="mt-4 text-center">
      <div class="text-xs text-gray-500 dark:text-gray-400">
        Last updated: {{ lastUpdated }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { getBondingCurveProgress } from "@/services/backendApi";

interface Props {
  tokenId: string;
  initialProgress?: any;
}

const props = defineProps<Props>();

// State
const progressData = ref<any>(props.initialProgress || null);
const lastUpdated = ref<string>("");
const updateInterval = ref<NodeJS.Timeout | null>(null);

// Computed
const progressPercentage = computed(() => {
  return Math.min(progressData.value?.progress || 0, 100);
});

// Methods
const loadProgress = async () => {
  try {
    const progress = await getBondingCurveProgress(
      props.tokenId,
    );
    progressData.value = progress;
    lastUpdated.value = new Date().toLocaleTimeString();
  } catch (error) {
    console.error("Failed to load bonding curve progress:", error);
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toFixed(0);
};

// Lifecycle
onMounted(() => {
  // Load initial data if not provided
  if (!progressData.value) {
    loadProgress();
  }

  // Update progress every 10 seconds
  updateInterval.value = setInterval(() => {
    loadProgress();
  }, 10000);

  // Set initial last updated time
  lastUpdated.value = new Date().toLocaleTimeString();
});

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value);
  }
});
</script>

<style scoped>
/* Shimmer animation for progress bar */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

/* Progress bar animations */
.bonding-curve-progress {
  position: relative;
}

/* Pulse animation for live indicators */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Gradient background animation */
.bg-gradient-to-r {
  background-size: 200% 200%;
  animation: gradient-shift 3s ease-in-out infinite alternate;
}

@keyframes gradient-shift {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

/* Hover effects */
.bonding-curve-progress:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease-out;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .grid-cols-2 {
    grid-template-columns: 1fr;
  }
}
</style>
