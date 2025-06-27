<template>
  <!-- Home page - main landing page with token listings -->
  <div class="bg-binance-dark">
    <!-- Trending Tokens Section -->
    <section class="bg-binance-dark">
      <TrendingTokens />
    </section>

    <!-- Main Tokens Section -->
    <section id="tokens" class="py-3 bg-trading-surface">
      <div class="container mx-auto px-4">
        <!-- Section Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 class="text-lg font-bold text-white">{{ t('common.all') }} {{ t('token.tokens') }}</h2>
            <p class="text-binance-gray text-sm mt-1">
              {{ t('token.discover') }}
            </p>
          </div>
          
          <!-- Quick Filters -->
          <div class="flex flex-wrap gap-2 mt-4 md:mt-0">
            <button
              v-for="filter in quickFilters"
              :key="filter.value"
              @click="setQuickFilter(filter.value)"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              :class="activeQuickFilter === filter.value
                ? 'bg-binance-yellow text-black' 
                : 'bg-trading-elevated text-binance-gray hover:text-white hover:bg-trading-surface border border-binance-border'"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>


        
        <!-- Token Grid -->
        <div v-if="tokens.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <TokenCard
            v-for="token in tokens"
            :key="token.id"
            :token="token"
            @click="handleTokenClick(token)"
            class="trading-card"
          />
        </div>
        
        <!-- Loading State -->
        <div v-else-if="loading" class="text-center py-12">
          <div class="spinner w-12 h-12 mx-auto mb-4"></div>
          <p class="text-binance-gray">{{ t('common.loading') }}...</p>
        </div>
        
        <!-- Empty State -->
        <div v-else class="text-center py-12">
          <div class="text-6xl mb-4">🎭</div>
          <h3 class="text-xl font-semibold text-white mb-2">{{ t('messages.info.noTokensFound') }}</h3>
          <p class="text-binance-gray mb-4">{{ t('messages.info.createFirstToken') }}</p>
          <router-link to="/create" class="btn-secondary">
            {{ t('token.createNew') }}
          </router-link>
        </div>
        
        <!-- Load More Button -->
        <div v-if="tokens.length > 0 && hasMore" class="text-center mt-6">
          <button 
            @click="loadMoreTokens"
            :disabled="loadingMore"
            class="btn-secondary px-8 py-3"
          >
            <span v-if="loadingMore" class="flex items-center gap-2">
              <div class="spinner w-4 h-4"></div>
              {{ t('common.loading') }}...
            </span>
            <span v-else>{{ t('common.loadMore') }}</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TokenCard from '@/components/token/TokenCard.vue'
import { SupabaseService } from '@/services/supabase'
import TrendingTokens from '@/components/token/TrendingTokens.vue'
import { useTypedI18n } from '@/i18n'

// Get i18n composable
const { t } = useTypedI18n()

// Define Token interface
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

const router = useRouter()

// Reactive state
const tokens = ref<Token[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const hasMore = ref(true)

// Filter state
const activeQuickFilter = ref('all')
const allTrendingData = ref<Token[]>([]) // Store full trending/featured data for pagination

// Quick filter options
const quickFilters = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: 'newest', label: t('search.newest') },
  { value: 'trending', label: t('token.trending') },
  { value: 'graduated', label: t('token.graduated') },
  { value: 'featured', label: t('search.featured') }
])

// Methods
const loadTokens = async (reset = true) => {
  try {
    if (reset) {
      loading.value = true
      page.value = 1
      tokens.value = []
    } else {
      loadingMore.value = true
    }
    
    let data
    
    // Handle different filter types
    if (activeQuickFilter.value === 'trending') {
      // For trending, we get all at once and handle pagination client-side
      if (reset) {
        data = await SupabaseService.getTrendingTokens('volume', 100) // Get more for pagination
        
        // Transform and store all data
        allTrendingData.value = data.map((token: any) => ({
          id: token.id || '',
          name: token.name || '',
          symbol: token.symbol || '',
          imageUrl: token.image_url || null,
          price: Number(token.current_price) || 0,
          priceChange24h: Number(token.price_change_24h) || 0,
          marketCap: Number(token.market_cap) || 0,
          volume24h: Number(token.volume_24h) || 0,
          holders: Number(token.holders_count) || 0,
          mint_address: token.mint_address || undefined
        }))
        
        // Show first 20 items
        tokens.value = allTrendingData.value.slice(0, 20)
        hasMore.value = allTrendingData.value.length > 20
        
        loading.value = false
        return
      } else {
        // Load next 20 items from stored data
        const currentLength = tokens.value.length
        const nextItems = allTrendingData.value.slice(currentLength, currentLength + 20)
        tokens.value.push(...nextItems)
        hasMore.value = currentLength + 20 < allTrendingData.value.length
        
        loadingMore.value = false
        return
      }
    } else if (activeQuickFilter.value === 'featured') {
      // For featured, we get all at once and handle pagination client-side  
      if (reset) {
        data = await SupabaseService.getTrendingTokens('featured', 100) // Get more for pagination
        
        // Transform and store all data
        allTrendingData.value = data.map((token: any) => ({
          id: token.id || '',
          name: token.name || '',
          symbol: token.symbol || '',
          imageUrl: token.image_url || null,
          price: Number(token.current_price) || 0,
          priceChange24h: Number(token.price_change_24h) || 0,
          marketCap: Number(token.market_cap) || 0,
          volume24h: Number(token.volume_24h) || 0,
          holders: Number(token.holders_count) || 0,
          mint_address: token.mint_address || undefined
        }))
        
        // Show first 20 items
        tokens.value = allTrendingData.value.slice(0, 20)
        hasMore.value = allTrendingData.value.length > 20
        
        loading.value = false
        return
      } else {
        // Load next 20 items from stored data
        const currentLength = tokens.value.length
        const nextItems = allTrendingData.value.slice(currentLength, currentLength + 20)
        tokens.value.push(...nextItems)
        hasMore.value = currentLength + 20 < allTrendingData.value.length
        
        loadingMore.value = false
        return
      }
    } else {
      // Clear trending data when switching to other filters
      allTrendingData.value = []
      
      // Build query options based on filter
      const queryOptions: any = {
        page: page.value,
        limit: 20,
        sortBy: 'created_at',
        sortOrder: 'desc',
        status: 'active'
      }
      
      // Apply quick filter logic
      if (activeQuickFilter.value === 'graduated') {
        queryOptions.status = 'graduated'
      } else if (activeQuickFilter.value === 'newest') {
        queryOptions.sortBy = 'created_at'
        queryOptions.sortOrder = 'desc'
      }
      
      data = await SupabaseService.getTokens(queryOptions)
    }
    
    // Transform and validate data (for non-trending/featured)
    const transformedData = data.map((token: any) => {
      return {
        id: token.id || '',
        name: token.name || '',
        symbol: token.symbol || '',
        imageUrl: token.image_url || null,
        price: Number(token.current_price) || 0,
        priceChange24h: Number(token.price_change_24h) || 0,
        marketCap: Number(token.market_cap) || 0,
        volume24h: Number(token.volume_24h) || 0,
        holders: Number(token.holders_count) || 0,
        mint_address: token.mint_address || undefined
      }
    })
    
    if (reset) {
      tokens.value = transformedData
    } else {
      tokens.value.push(...transformedData)
    }
    
    hasMore.value = data.length === 20
    
  } catch (error) {
    console.error('Failed to load tokens:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMoreTokens = async () => {
  if (loadingMore.value || !hasMore.value) return
  
  page.value += 1
  await loadTokens(false)
}

const handleTokenClick = (token: Token) => {
  router.push(`/token/${token.mint_address || token.id}`)
}

const setQuickFilter = (filterValue: string) => {
  activeQuickFilter.value = filterValue
  loadTokens()
}

// Load initial data when component mounts
onMounted(async () => {
  await loadTokens()
})
</script>

<style scoped>
.trading-card {
  @apply transition-all duration-200 hover:scale-105 hover:shadow-lg;
}

.btn-secondary {
  @apply px-4 py-2 bg-trading-surface border border-binance-border text-white rounded-lg hover:bg-trading-elevated hover:border-binance-yellow transition-all duration-200;
}

.spinner {
  @apply animate-spin rounded-full border-2 border-binance-border border-t-binance-yellow;
}
</style>