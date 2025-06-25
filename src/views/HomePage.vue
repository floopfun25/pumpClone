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
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-white">{{ t('common.all') }} {{ t('token.tokens') }}</h2>
          </div>
          
          <!-- Controls -->
          <div class="flex flex-col sm:flex-row gap-4 mt-4 md:mt-0">
            <!-- Sort & Filter -->
            <div class="flex space-x-2">
              <select
                v-model="sortBy"
                class="input-field"
                @change="loadTokens()"
              >
                <option value="created_at">{{ t('search.newest') }}</option>
                <option value="market_cap">{{ t('search.marketCap') }}</option>
                <option value="volume_24h">{{ t('search.volume') }}</option>
              </select>
              
              <select
                v-model="filterBy"
                class="input-field"
                @change="loadTokens()"
              >
                <option value="all">{{ t('common.all') }}</option>
                <option value="trending">{{ t('token.trending') }}</option>
                <option value="graduated">{{ t('token.graduated') }}</option>
              </select>
            </div>
            
            <button
              @click="showAdvancedSearch = true"
              class="btn-secondary"
            >
              {{ t('search.filters') }}
            </button>
          </div>
        </div>
        
        <!-- Token Grid -->
        <div v-if="tokens.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <TokenCard
            v-for="token in tokens"
            :key="token.id"
            :token="token"
            class="trading-card"
          />
        </div>
        
        <!-- Loading State -->
        <div v-else-if="loading" class="text-center py-6">
          <div class="spinner w-12 h-12 mx-auto mb-4"></div>
          <p class="text-binance-gray">{{ t('common.loading') }}...</p>
        </div>
        
        <!-- Empty State -->
        <div v-else class="text-center py-6">
          <div class="text-6xl mb-4">🎭</div>
          <h3 class="text-xl font-semibold text-white mb-2">{{ t('messages.info.noTokensFound') }}</h3>
          <p class="text-binance-gray">{{ t('messages.info.tryDifferentFilters') }}</p>
        </div>
        
        <!-- Load More Button -->
        <div v-if="tokens.length > 0 && hasMore" class="text-center mt-4 mb-4">
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TokenCard from '@/components/token/TokenCard.vue'
import { SupabaseService } from '@/services/supabase'
import TrendingTokens from '@/components/token/TrendingTokens.vue'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'
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
}

const router = useRouter()

// Reactive state
const tokens = ref<Token[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const sortBy = ref<'created_at' | 'market_cap' | 'volume_24h'>('created_at')
const filterBy = ref('all')
const page = ref(1)
const hasMore = ref(true)
const showAdvancedSearch = ref(false)
const searchLoading = ref(false)
const searchResults = ref<any[]>([])
const simpleQuery = ref('')

/**
 * Load tokens from database
 */
const loadTokens = async (reset = true) => {
  try {
    if (reset) {
      loading.value = true
      page.value = 1
      tokens.value = []
    } else {
      loadingMore.value = true
    }
    
    const data = await SupabaseService.getTokens({
      page: page.value,
      limit: 20,
      sortBy: sortBy.value,
      sortOrder: 'desc',
      status: 'active'
    })
    
    console.log('🔍 Raw tokens from Supabase (HomePage):', data)
    
    // Transform and validate data
    const transformedData = data.map((token: any) => {
      const transformed = {
        id: token.id || '',
        name: token.name || '',
        symbol: token.symbol || '',
        imageUrl: token.image_url || null,
        price: Number(token.current_price) || 0, // Fix: use current_price instead of price
        priceChange24h: Number(token.price_change_24h) || 0,
        marketCap: (Number(token.market_cap) || 0) / 1e9, // Convert from lamports to SOL
        volume24h: Number(token.volume_24h) || 0, // Already in SOL, no conversion needed
        holders: Number(token.holders_count) || 0 // Fix: use holders_count
      }
      
      console.log(`📊 HomePage Token ${token.symbol}:`, {
        raw_market_cap: token.market_cap,
        converted_market_cap: transformed.marketCap,
        raw_volume_24h: token.volume_24h,
        converted_volume_24h: transformed.volume24h,
        raw_current_price: token.current_price,
        converted_price: transformed.price,
        raw_holders_count: token.holders_count,
        converted_holders: transformed.holders
      })
      
      return transformed
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

/**
 * Load more tokens for pagination
 */
const loadMoreTokens = async () => {
  if (loadingMore.value || !hasMore.value) return
  
  page.value += 1
  await loadTokens(false)
}

/**
 * Handle simple search
 */
const handleSimpleSearch = () => {
  if (!simpleQuery.value.trim()) return
  router.push({
    name: 'search',
    query: { q: simpleQuery.value }
  })
}

// Load initial data when component mounts
onMounted(async () => {
  await loadTokens()
})
</script>