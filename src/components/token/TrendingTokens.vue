<template>
  <div class="bg-trading-surface border border-binance-border rounded-lg p-6">
    <!-- Section Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-white">{{ t('token.trending') }}</h2>
        <p class="text-binance-gray mt-1">{{ t('messages.info.trendingDescription') }}</p>
      </div>
      <button 
        @click="$emit('viewAll')"
        class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
      >
        {{ t('common.viewAll') }} →
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-binance-yellow"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-red-500 mb-2">{{ t('error.failedToLoad') }}</p>
      <button 
        @click="loadTrendingTokens"
        class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
      >
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Token Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <TokenCard
        v-for="token in trendingTokens"
        :key="token.id"
        :token="token"
        @trade="handleTrade"
        @view="handleView"
      />
    </div>

    <!-- Empty State -->
    <div v-if="!loading && !error && trendingTokens.length === 0" class="text-center py-12">
      <p class="text-binance-gray">{{ t('token.noTrendingTokens') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import TokenCard from './TokenCard.vue'

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

// Define emits
const emit = defineEmits<{
  (e: 'viewAll'): void
  (e: 'trade', token: Token): void
  (e: 'view', token: Token): void
}>()

// Setup i18n
const { t } = useI18n()

// State
const loading = ref(true)
const error = ref(false)
const trendingTokens = ref<Token[]>([])

// Methods
async function loadTrendingTokens() {
  loading.value = true
  error.value = false
  
  try {
    // Simulated API call - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    trendingTokens.value = [
      {
        id: '1',
        name: 'Pepe',
        symbol: 'PEPE',
        imageUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png',
        price: 0.000001234,
        priceChange24h: 15.6,
        marketCap: 1_200_000_000,
        volume24h: 450_000_000,
        holders: 125_000
      },
      {
        id: '2',
        name: 'Wojak',
        symbol: 'WOJ',
        imageUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        price: 0.00000789,
        priceChange24h: -8.3,
        marketCap: 800_000_000,
        volume24h: 250_000_000,
        holders: 85_000
      },
      {
        id: '3',
        name: 'Doge',
        symbol: 'DOGE',
        imageUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/74.png',
        price: 0.12345,
        priceChange24h: 5.2,
        marketCap: 15_000_000_000,
        volume24h: 2_500_000_000,
        holders: 4_500_000
      }
    ]
  } catch (err) {
    console.error('Failed to load trending tokens:', err)
    error.value = true
  } finally {
    loading.value = false
  }
}

function handleTrade(token: Token) {
  emit('trade', token)
}

function handleView(token: Token) {
  emit('view', token)
}

// Lifecycle hooks
onMounted(() => {
  loadTrendingTokens()
})
</script>

<style scoped>
.hover\:text-binance-yellow-dark:hover {
  color: #F0B90B;
  filter: brightness(0.9);
}
</style> 