<template>
  <!-- Token card component for displaying token information in a grid -->
  <div 
    class="bg-trading-surface border border-binance-border rounded-lg overflow-hidden hover:border-gray-600 transition-colors cursor-pointer"
    @click.stop="$emit('click')"
  >
    <!-- Token Header -->
    <div class="p-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <img 
            :src="getImageUrl(token.imageUrl)"
            :alt="token.name"
            class="w-8 h-8 rounded-full"
            @error="handleImageError"
          >
          <div>
            <h3 class="text-base font-semibold text-white">{{ token.name }}</h3>
            <p class="text-xs text-binance-gray">{{ token.symbol }}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-medium text-binance-yellow">${{ formatPrice(token.price) }}</p>
          <p :class="priceChangeClass">{{ formatPriceChange(token.priceChange24h) }}%</p>
        </div>
      </div>
    </div>

    <!-- Token Stats -->
    <div class="px-3 pb-3 space-y-1">
      <div class="flex justify-between text-xs">
        <span class="text-binance-gray">{{ t('token.marketCap') }}</span>
        <span class="text-white font-medium">${{ formatNumber(token.marketCap) }}</span>
      </div>
      <div class="flex justify-between text-xs">
        <span class="text-binance-gray">{{ t('token.volume24h') }}</span>
        <span class="text-white font-medium">${{ formatNumber(token.volume24h) }}</span>
      </div>
      <div class="flex justify-end text-xs">
        <span class="text-white font-medium">{{ formatHoldersCount(token.holders) }}</span>
      </div>
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
      imageUrl: fallbackImage.value,
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
    imageUrl: props.token?.imageUrl || fallbackImage.value,
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
    'text-xs font-medium': true,
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