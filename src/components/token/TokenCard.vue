<template>
  <!-- Token card component for displaying token information in a grid -->
  <div 
    class="bg-trading-surface border border-binance-border rounded-lg overflow-hidden hover:border-gray-600 transition-colors cursor-pointer"
    :class="[
      'mobile-token-card',
      'hover:shadow-lg hover:scale-[1.02] transition-all duration-200'
    ]"
    @click.stop="$emit('click')"
  >
    <!-- Token Header -->
    <div class="p-3 md:p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2 md:space-x-2">
          <img 
            :src="getImageUrl(token.imageUrl)"
            :alt="token.name"
            class="w-10 h-10 md:w-8 md:h-8 rounded-full flex-shrink-0"
            @error="handleImageError"
          >
          <div class="min-w-0 flex-1">
            <h3 class="text-base md:text-base font-semibold text-white truncate">{{ token.name }}</h3>
            <p class="text-sm md:text-xs text-binance-gray">{{ token.symbol }}</p>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-base md:text-sm font-medium text-binance-yellow">${{ formatPrice(token.price) }}</p>
          <p :class="priceChangeClass">{{ formatPriceChange(token.priceChange24h) }}%</p>
        </div>
      </div>
    </div>

    <!-- Token Stats -->
    <div class="px-3 pb-3 md:px-3 md:pb-3 space-y-2 md:space-y-1">
      <div class="flex justify-between text-sm md:text-xs">
        <span class="text-binance-gray">{{ t('token.marketCap') }}</span>
        <span class="text-white font-medium">${{ formatNumber(token.marketCap) }}</span>
      </div>
      <div class="flex justify-between text-sm md:text-xs">
        <span class="text-binance-gray">{{ t('token.volume24h') }}</span>
        <span class="text-white font-medium">${{ formatNumber(token.volume24h) }}</span>
      </div>
      <div class="flex justify-between text-sm md:text-xs">
        <span class="text-binance-gray">{{ t('token.holders') }}</span>
        <span class="text-white font-medium">{{ formatHoldersCount(token.holders) }}</span>
      </div>
    </div>

    <!-- Mobile touch indicator -->
    <div class="md:hidden absolute bottom-2 right-2 opacity-30">
      <svg class="h-4 w-4 text-binance-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTypedI18n } from '@/i18n'
import { getTokenFallbackImage, getTokenImagePath } from '@/utils/paths'
import { formatNumber, formatPrice, formatPriceChange } from '@/utils/formatters'

// Define token interface
interface Token {
  id: string
  name: string
  symbol: string
  imageUrl?: string
  price: number
  priceChange24h: number
  marketCap: number
  volume24h: number
  holders: number
}

// Define props
const props = defineProps<{
  token: Token
}>()

// Define emits
const emit = defineEmits<{
  (e: 'click'): void
}>()

// Setup i18n
const { t } = useTypedI18n()

// Setup fallback image and loading state
const fallbackImage = ref(getTokenFallbackImage())
const imageError = ref(false)

// Set default values for token properties
const token = computed(() => {
  // Handle case where entire token prop is undefined
  if (!props.token) {
    return {
      id: '',
      name: '',
      symbol: '',
      imageUrl: undefined,
      price: 0,
      priceChange24h: 0,
      marketCap: 0,
      volume24h: 0,
      holders: 0
    }
  }

  return {
    id: props.token?.id || '',
    name: props.token?.name || '',
    symbol: props.token?.symbol || '',
    imageUrl: props.token?.imageUrl,
    price: props.token?.price || 0,
    priceChange24h: props.token?.priceChange24h || 0,
    marketCap: props.token?.marketCap || 0,
    volume24h: props.token?.volume24h || 0,
    holders: props.token?.holders || 0
  }
})

// Computed properties
const priceChangeClass = computed(() => {
  return {
    'text-sm md:text-xs font-medium': true,
    'text-green-500': token.value.priceChange24h > 0,
    'text-red-500': token.value.priceChange24h < 0,
    'text-binance-gray': token.value.priceChange24h === 0
  }
})

// Methods
function handleImageError(event: Event) {
  imageError.value = true
  const img = event.target as HTMLImageElement
  img.src = fallbackImage.value
}

function getImageUrl(url: string | undefined): string {
  if (!url) return fallbackImage.value
  if (url.startsWith('http')) return url
  return getTokenImagePath(url)
}

function formatHoldersCount(count: number): string {
  if (!count || count === 0) return '0'
  
  // Format as whole numbers with K, M, B suffixes if needed
  if (count >= 1_000_000_000) {
    return `${Math.floor(count / 1_000_000_000)}B`
  }
  if (count >= 1_000_000) {
    return `${Math.floor(count / 1_000_000)}M`
  }
  if (count >= 1_000) {
    return `${Math.floor(count / 1_000)}K`
  }
  
  // For smaller numbers, just return the whole number
  return Math.floor(count).toString()
}

// Formatting functions are now imported from @/utils/formatters
</script>

<style scoped>
/* Mobile-specific improvements */
@media (max-width: 768px) {
  .mobile-token-card {
    /* Better touch target */
    @apply min-h-[120px] relative;
    
    /* Improve mobile interactions */
    @apply active:scale-[0.98] active:bg-trading-elevated/50;
    
    /* Better spacing on mobile */
    @apply mx-1;
  }
  
  .mobile-token-card:hover {
    @apply transform-gpu;
  }
  
  /* Improve text readability on mobile */
  .mobile-token-card h3 {
    @apply leading-tight;
  }
  
  /* Better touch feedback */
  .mobile-token-card:active {
    @apply duration-75;
  }
}

/* Desktop styles remain unchanged */
@media (min-width: 769px) {
  .mobile-token-card {
    @apply hover:shadow-lg;
  }
}
</style> 