<template>
  <div class="bg-trading-surface border-y border-binance-border">
    <div class="container mx-auto">
      <!-- Section Header -->
      <div class="flex items-center justify-between mb-3 px-3 pt-3">
        <div>
          <h2 class="text-lg font-semibold text-white">Trending Tokens</h2>
        </div>
        <button
          @click="$emit('viewAll')"
          class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
        >
          {{ t("common.viewAll") }} →
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-6">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-binance-yellow"
        ></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-6">
        <p class="text-red-500 mb-2">{{ error }}</p>
        <button
          @click="loadTrendingTokens"
          class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
        >
          {{ t("common.retry") }}
        </button>
      </div>

      <!-- Token Horizontal Scroll -->
      <div v-else class="flex items-center">
        <!-- Left Arrow -->
        <div class="w-12 flex-shrink-0 flex justify-center">
          <button
            v-if="canScrollLeft"
            @click="scrollLeft"
            class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>

        <!-- Token List Container -->
        <div
          ref="scrollContainer"
          class="overflow-x-auto hide-scrollbar flex-grow"
          @scroll="handleScroll"
        >
          <div class="flex gap-4 py-2 min-w-max px-4">
            <TokenCard
              v-for="token in trendingTokens"
              :key="token.id"
              :token="token"
              @click="handleTokenClick(token)"
              class="flex-shrink-0 w-[280px]"
            />
          </div>
        </div>

        <!-- Right Arrow -->
        <div class="w-12 flex-shrink-0 flex justify-center">
          <button
            v-if="canScrollRight"
            @click="scrollRight"
            class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="!loading && !error && trendingTokens.length === 0"
        class="text-center py-6"
      >
        <p class="text-binance-gray">{{ t("token.noTrendingTokens") }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useTypedI18n } from "@/i18n";
import TokenCard from "./TokenCard.vue";
import { useRouter } from "vue-router";
import { SupabaseService } from "@/services/supabase";

// Define token interface
interface Token {
  id: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  mint_address?: string;
  trending_score?: number;
  rank?: number;
}

// Define emits
const emit = defineEmits<{
  (e: "viewAll"): void;
}>();

// Setup i18n and router
const { t } = useTypedI18n();
const router = useRouter();

// Component state
const loading = ref(false);
const error = ref<string | null>(null);
const trendingTokens = ref<Token[]>([]);
const scrollContainer = ref<HTMLElement | null>(null);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

// Methods
const loadTrendingTokens = async () => {
  loading.value = true;
  error.value = null;

  try {
    // Get trending tokens from Supabase with enhanced sorting
    const tokens = await SupabaseService.getTrendingTokensEnhanced(12); // Get more tokens for scrolling

    // Map the response to our Token interface
    trendingTokens.value = tokens.map((token: any, index: number) => {
      return {
        id: token.id,
        name: token.name,
        symbol: token.symbol,
        imageUrl: token.image_url,
        price: token.current_price || 0,
        priceChange24h: token.price_change_24h || 0,
        marketCap: token.market_cap || 0, // Market cap is already in USD
        volume24h: token.volume_24h || 0,
        holders: token.holders_count || 0,
        mint_address: token.mint_address,
        trending_score: token.trendingScore,
        rank: index + 1,
      };
    });

    // Check scroll state after data is loaded
    setTimeout(checkScroll, 100);
  } catch (err) {
    console.error("Failed to load trending tokens:", err);
    error.value = t("errors.failedToLoadTrending");
  } finally {
    loading.value = false;
  }
};

const handleTokenClick = (token: Token) => {
  router.push(`/token/${token.mint_address || token.id}`);
};

const checkScroll = () => {
  if (!scrollContainer.value) return;

  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
  canScrollLeft.value = scrollLeft > 0;
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 10;
};

const handleScroll = () => {
  checkScroll();
};

const scrollLeft = () => {
  if (!scrollContainer.value) return;
  scrollContainer.value.scrollBy({
    left: -300,
    behavior: "smooth",
  });
};

const scrollRight = () => {
  if (!scrollContainer.value) return;
  scrollContainer.value.scrollBy({
    left: 300,
    behavior: "smooth",
  });
};

// Watch for changes in trending tokens
watch(
  trendingTokens,
  () => {
    setTimeout(checkScroll, 100);
  },
  { deep: true },
);

// Lifecycle hooks
onMounted(() => {
  loadTrendingTokens();
  window.addEventListener("resize", checkScroll);
});
</script>

<style scoped>
.hover\:text-binance-yellow-dark:hover {
  color: #f0b90b;
  filter: brightness(0.9);
}

/* Hide scrollbar but keep functionality */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Container styles */
.overflow-x-auto {
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;
  scroll-behavior: smooth;
}
</style>
