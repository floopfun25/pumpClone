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
          {{ t('common.viewAll') }} →
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-binance-yellow"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-500 mb-2">{{ error }}</p>
        <button 
          @click="loadTrendingTokens"
          class="text-binance-yellow hover:text-binance-yellow-dark transition-colors"
        >
          {{ t('common.retry') }}
        </button>
      </div>

      <!-- Token Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-3 pb-3">
        <TokenCard
          v-for="token in trendingTokens"
          :key="token.id"
          :token="token"
          @click="handleTokenClick(token)"
        />
      </div>

      <!-- Empty State -->
      <div v-if="!loading && !error && trendingTokens.length === 0" class="text-center py-12">
        <p class="text-binance-gray">{{ t('token.noTrendingTokens') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTypedI18n } from '@/i18n'
import TokenCard from './TokenCard.vue'
import { useRouter } from 'vue-router'

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
  mint_address?: string
}

// Define emits
const emit = defineEmits<{
  (e: 'viewAll'): void
}>()

// Setup i18n
const { t } = useTypedI18n()
const router = useRouter()

// Component state
const loading = ref(false)
const error = ref<string | null>(null)
const trendingTokens = ref<Token[]>([])

// Methods
const loadTrendingTokens = async () => {
  loading.value = true
  error.value = null
  
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
        holders: 125_000,
        mint_address: 'pepe123'
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
        holders: 85_000,
        mint_address: 'wojak456'
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
        holders: 4_500_000,
        mint_address: 'doge789'
      }
    ]
  } catch (err) {
    console.error('Failed to load trending tokens:', err)
    error.value = 'Failed to load trending tokens'
  } finally {
    loading.value = false
  }
}

const handleTokenClick = (token: Token) => {
  router.push(`/token/${token.mint_address || token.id}`)
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