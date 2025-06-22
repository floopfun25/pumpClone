<template>
  <!-- Token card component for displaying token information in a grid -->
  <div class="bg-trading-surface border border-binance-border rounded-lg overflow-hidden hover:border-binance-yellow transition-colors">
    <!-- Token Header -->
    <div class="p-4 border-b border-binance-border">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <img 
            :src="token.imageUrl || fallbackImage" 
            :alt="token.name"
            class="w-10 h-10 rounded-full"
            @error="handleImageError"
          >
          <div>
            <h3 class="text-lg font-semibold text-white">{{ token.name }}</h3>
            <p class="text-sm text-binance-gray">{{ token.symbol }}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-medium text-binance-yellow">${{ formatPrice(token.price) }}</p>
          <p :class="priceChangeClass">{{ formatPriceChange(token.priceChange24h) }}%</p>
        </div>
      </div>
    </div>

    <!-- Token Stats -->
    <div class="p-4 space-y-3">
      <div class="flex justify-between text-sm">
        <span class="text-binance-gray">{{ t('token.marketCap') }}</span>
        <span class="text-white font-medium">${{ formatNumber(token.marketCap) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-binance-gray">{{ t('token.volume24h') }}</span>
        <span class="text-white font-medium">${{ formatNumber(token.volume24h) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-binance-gray">{{ t('token.holders') }}</span>
        <span class="text-white font-medium">{{ formatNumber(token.holders) }}</span>
      </div>
    </div>

    <!-- Token Actions -->
    <div class="p-4 bg-trading-elevated border-t border-binance-border">
      <div class="flex space-x-2">
        <button 
          @click="$emit('trade', token)"
          class="flex-1 bg-binance-yellow text-black font-medium py-2 px-4 rounded-lg hover:bg-binance-yellow-dark transition-colors"
        >
          {{ t('trading.trade') }}
        </button>
        <button 
          @click="$emit('view', token)"
          class="flex-1 border border-binance-border text-white font-medium py-2 px-4 rounded-lg hover:bg-trading-surface transition-colors"
        >
          {{ t('common.view') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
  (e: 'trade', token: Token): void
  (e: 'view', token: Token): void
}>()

// Setup i18n
const { t } = useI18n()

// Setup fallback image
const fallbackImage = ref('/images/token-fallback.svg')

// Computed properties
const priceChangeClass = computed(() => {
  return {
    'text-sm font-medium': true,
    'text-green-500': props.token.priceChange24h > 0,
    'text-red-500': props.token.priceChange24h < 0,
    'text-binance-gray': props.token.priceChange24h === 0
  }
})

// Methods
function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = fallbackImage.value
}

function formatPrice(price: number): string {
  if (price < 0.01) {
    return price.toFixed(8)
  }
  if (price < 1) {
    return price.toFixed(4)
  }
  return price.toFixed(2)
}

function formatPriceChange(change: number): string {
  return change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2)
}

function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`
  }
  return num.toString()
}
</script>

<style scoped>
.hover\:bg-binance-yellow-dark:hover {
  background-color: #F0B90B;
  filter: brightness(0.9);
}
</style> 