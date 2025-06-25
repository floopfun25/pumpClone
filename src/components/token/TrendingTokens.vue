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
import { SupabaseService } from '@/services/supabase'

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
  trending_score?: number
  rank?: number
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
    // Get trending tokens from Supabase with enhanced sorting
    const tokens = await SupabaseService.getTrendingTokensEnhanced(8) // Limit to 8 tokens for the grid
    
    // Map the response to our Token interface
    trendingTokens.value = tokens.map((token: any, index: number) => ({
      id: token.id,
      name: token.name,
      symbol: token.symbol,
      imageUrl: token.image_url,
      price: token.current_price || 0,
      priceChange24h: token.price_change_24h || 0,
      marketCap: token.market_cap || 0,
      volume24h: token.volume_24h || 0,
      holders: token.holders_count || 0,
      mint_address: token.mint_address,
      trending_score: token.trendingScore,
      rank: index + 1
    }))
  } catch (err) {
    console.error('Failed to load trending tokens:', err)
    error.value = t('errors.failedToLoadTrending')
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