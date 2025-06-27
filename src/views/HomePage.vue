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
            <!-- Pagination Info -->
            <div v-if="tokens.length > 0" class="text-binance-gray text-xs mt-2 flex items-center gap-4">
              <span>{{ t('pagination.showing') }} {{ currentPageInfo.currentCount }} {{ t('token.tokens') }}</span>
              <span v-if="currentPageInfo.currentPage > 1">{{ t('pagination.page') }} {{ currentPageInfo.currentPage }} {{ t('pagination.of') }} {{ currentPageInfo.totalPages }}</span>
              <span v-if="currentPageInfo.hasNextPage" class="text-binance-yellow">{{ t('pagination.moreAvailable') }}</span>
            </div>
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
        <div v-if="tokens.length > 0" class="relative">
          <!-- Loading overlay for page navigation -->
          <div v-if="loading" class="absolute inset-0 bg-trading-surface bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
            <div class="flex items-center gap-3 bg-trading-elevated px-6 py-3 rounded-lg border border-binance-border">
              <div class="spinner w-5 h-5"></div>
              <span class="text-white text-sm">{{ t('pagination.loading') }}...</span>
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" :class="{ 'opacity-50': loading }">
            <TokenCard
              v-for="token in tokens"
              :key="token.id"
              :token="token"
              @click="handleTokenClick(token)"
              class="trading-card"
            />
          </div>
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
        
        <!-- Page Navigation -->
        <div v-if="tokens.length > 0 && totalPages > 1" class="flex items-center justify-center mt-8 gap-4">
          <!-- Previous Button -->
          <button 
            @click="goToPrevPage"
            :disabled="!currentPageInfo.hasPrevPage || loading"
            class="btn-secondary px-4 py-2 flex items-center gap-2"
            :class="{ 'opacity-50 cursor-not-allowed': !currentPageInfo.hasPrevPage || loading }"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            {{ t('pagination.previous') }}
          </button>
          
          <!-- Page Info -->
          <div class="px-4 py-2 bg-trading-elevated rounded-lg border border-binance-border">
            <span class="text-white text-sm">
              {{ t('pagination.page') }} {{ currentPageInfo.currentPage }} {{ t('pagination.of') }} {{ currentPageInfo.totalPages }}
            </span>
          </div>
          
          <!-- Next Button -->
          <button 
            @click="goToNextPage"
            :disabled="!currentPageInfo.hasNextPage || loading"
            class="btn-secondary px-4 py-2 flex items-center gap-2"
            :class="{ 'opacity-50 cursor-not-allowed': !currentPageInfo.hasNextPage || loading }"
          >
            {{ t('pagination.next') }}
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
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
const page = ref(1)
const totalPages = ref(1)
const totalTokens = ref(0)

// Filter state
const activeQuickFilter = ref('all')
const allTrendingData = ref<Token[]>([]) // Store full trending/featured data for pagination

// Computed properties
const currentPageInfo = computed(() => {
  const ITEMS_PER_PAGE = 100
  const currentCount = tokens.value.length
  return {
    currentCount,
    currentPage: page.value,
    totalPages: totalPages.value,
    itemsPerPage: ITEMS_PER_PAGE,
    hasNextPage: page.value < totalPages.value,
    hasPrevPage: page.value > 1
  }
})

// Quick filter options
const quickFilters = computed(() => [
  { value: 'all', label: t('common.all') },
  { value: 'newest', label: t('search.newest') },
  { value: 'trending', label: t('token.trending') },
  { value: 'graduated', label: t('token.graduated') },
  { value: 'featured', label: t('search.featured') }
])

// Methods
const loadTokens = async () => {
  try {
    loading.value = true
    tokens.value = [] // Always clear previous tokens for page-based navigation
    
    let data
    const ITEMS_PER_PAGE = 100
    
    // Handle different filter types
    if (activeQuickFilter.value === 'trending') {
      // For trending, we get all at once and handle pagination client-side
      if (allTrendingData.value.length === 0) {
        // First time loading trending data
        const allData = await SupabaseService.getTrendingTokens('volume', 1000) // Get more for pagination
        
        // Transform and store all data
        allTrendingData.value = allData.map((token: any) => ({
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
        
        totalTokens.value = allTrendingData.value.length
        totalPages.value = Math.ceil(allTrendingData.value.length / ITEMS_PER_PAGE)
      }
      
      // Get tokens for current page
      const startIndex = (page.value - 1) * ITEMS_PER_PAGE
      const endIndex = startIndex + ITEMS_PER_PAGE
      tokens.value = allTrendingData.value.slice(startIndex, endIndex)
      
    } else if (activeQuickFilter.value === 'featured') {
      // For featured, we get all at once and handle pagination client-side  
      if (allTrendingData.value.length === 0) {
        // First time loading featured data
        const allData = await SupabaseService.getTrendingTokens('featured', 1000) // Get more for pagination
        
        // Transform and store all data
        allTrendingData.value = allData.map((token: any) => ({
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
        
        totalTokens.value = allTrendingData.value.length
        totalPages.value = Math.ceil(allTrendingData.value.length / ITEMS_PER_PAGE)
      }
      
      // Get tokens for current page
      const startIndex = (page.value - 1) * ITEMS_PER_PAGE
      const endIndex = startIndex + ITEMS_PER_PAGE
      tokens.value = allTrendingData.value.slice(startIndex, endIndex)
      
    } else {
      // Clear trending data when switching to other filters
      allTrendingData.value = []
      
      // Build query options based on filter
      const queryOptions: any = {
        page: page.value,
        limit: ITEMS_PER_PAGE,
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
      
      const result = await SupabaseService.getTokens(queryOptions)
      
      // Transform and validate data
      tokens.value = result.data.map((token: any) => ({
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
      
      // Use proper pagination metadata from Supabase
      totalPages.value = result.totalPages
      totalTokens.value = result.total
    }
    
  } catch (error) {
    console.error('Failed to load tokens:', error)
  } finally {
    loading.value = false
  }
}

const handleTokenClick = (token: Token) => {
  router.push(`/token/${token.mint_address || token.id}`)
}

const setQuickFilter = (filterValue: string) => {
  activeQuickFilter.value = filterValue
  page.value = 1 // Reset to first page when switching filters
  totalTokens.value = 0 // Reset total count when switching filters
  allTrendingData.value = [] // Clear cached data when switching filters
  loadTokens()
}

// Page navigation functions
const goToNextPage = async () => {
  if (currentPageInfo.value.hasNextPage) {
    page.value += 1
    await loadTokens()
  }
}

const goToPrevPage = async () => {
  if (currentPageInfo.value.hasPrevPage) {
    page.value -= 1
    await loadTokens()
  }
}

const goToPage = async (pageNumber: number) => {
  if (pageNumber >= 1 && pageNumber <= totalPages.value) {
    page.value = pageNumber
    await loadTokens()
  }
}

// Load initial data when component mounts
onMounted(() => {
  loadTokens()
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