<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4">
      <!-- Page Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          🔍 Search Tokens
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Find the perfect meme token with advanced filtering and search
        </p>
      </div>

      <!-- Advanced Search Component -->
      <div class="mb-8">
        <AdvancedSearch
          :loading="loading"
          :result-count="totalResults"
          @search="handleSearch"
          @filter-change="handleFilterChange"
        />
      </div>

      <!-- Search Results -->
      <div v-if="hasSearched">
        <!-- Results Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
            Search Results
            <span class="text-lg text-gray-500 dark:text-gray-400 font-normal">
              ({{ totalResults }} {{ totalResults === 1 ? 'token' : 'tokens' }})
            </span>
          </h2>
          
          <!-- View Toggle -->
          <div class="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button
              @click="viewMode = 'grid'"
              :class="[
                'px-3 py-1 text-sm rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              ]"
            >
              ⊞ Grid
            </button>
            <button
              @click="viewMode = 'list'"
              :class="[
                'px-3 py-1 text-sm rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              ]"
            >
              ☰ List
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="text-center">
            <div class="spinner w-12 h-12 mx-auto mb-4"></div>
            <p class="text-gray-500 dark:text-gray-400">Searching tokens...</p>
          </div>
        </div>

        <!-- Results Grid/List -->
        <div v-else-if="tokens.length > 0">
          <!-- Grid View -->
          <div 
            v-if="viewMode === 'grid'" 
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <TokenCard
              v-for="token in tokens"
              :key="token.id"
              :token="token"
              @click="navigateToToken(token.mint_address)"
            />
          </div>

          <!-- List View -->
          <div v-else class="space-y-4">
            <div
              v-for="token in tokens"
              :key="token.id"
              @click="navigateToToken(token.mint_address)"
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-primary-300 dark:hover:border-primary-600 transition-colors cursor-pointer"
            >
              <div class="flex items-center space-x-4">
                <!-- Token Image -->
                <div class="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-purple-500 flex-shrink-0">
                  <img 
                    v-if="token.image_url" 
                    :src="token.image_url" 
                    :alt="token.name"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                    {{ token.symbol.slice(0, 2) }}
                  </div>
                </div>

                <!-- Token Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-3 mb-2">
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white truncate">
                      {{ token.name }}
                    </h3>
                    <span class="text-gray-500 dark:text-gray-400">
                      ${{ token.symbol }}
                    </span>
                    <span v-if="token.is_featured" class="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                      ⭐ Featured
                    </span>
                  </div>
                  <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                    {{ token.description || 'No description available' }}
                  </p>
                  <div class="flex items-center space-x-6 text-sm">
                    <span class="text-gray-600 dark:text-gray-400">
                      MC: <span class="font-medium text-gray-900 dark:text-white">${{ formatNumber(token.market_cap) }}</span>
                    </span>
                    <span class="text-gray-600 dark:text-gray-400">
                      Vol: <span class="font-medium text-gray-900 dark:text-white">${{ formatNumber(token.volume_24h) }}</span>
                    </span>
                    <span class="text-gray-600 dark:text-gray-400">
                      Holders: <span class="font-medium text-gray-900 dark:text-white">{{ token.holders_count || 0 }}</span>
                    </span>
                    <span class="text-gray-600 dark:text-gray-400">
                      Progress: <span class="font-medium text-gray-900 dark:text-white">{{ token.bonding_curve_progress || 0 }}%</span>
                    </span>
                  </div>
                </div>

                <!-- Price Info -->
                <div class="text-right">
                  <div class="text-xl font-bold text-gray-900 dark:text-white">
                    ${{ formatPrice(token.current_price) }}
                  </div>
                  <div :class="[
                    'text-sm font-medium',
                    (token.price_change_24h || 0) >= 0 ? 'text-pump-green' : 'text-pump-red'
                  ]">
                    {{ (token.price_change_24h || 0) >= 0 ? '+' : '' }}{{ (token.price_change_24h || 0).toFixed(1) }}%
                  </div>
                </div>

                <!-- Arrow -->
                <div class="text-gray-400 text-xl">
                  →
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="mt-4">
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-gradient-to-r from-pump-green to-primary-500 h-2 rounded-full transition-all duration-300" 
                    :style="`width: ${token.bonding_curve_progress || 0}%`"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Load More Button -->
          <div v-if="hasMore" class="text-center mt-8">
            <button 
              @click="loadMore"
              :disabled="loadingMore"
              class="btn-secondary px-8 py-3"
            >
              <span v-if="loadingMore" class="flex items-center gap-2">
                <div class="spinner w-4 h-4"></div>
                Loading More...
              </span>
              <span v-else>Load More Results</span>
            </button>
          </div>
        </div>

        <!-- No Results -->
        <div v-else class="text-center py-12">
          <div class="text-6xl mb-4">🔍</div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No tokens found
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Try adjusting your search criteria or filters
          </p>
          <button @click="clearSearch" class="btn-primary">
            Clear Search
          </button>
        </div>
      </div>

      <!-- Initial State (No Search Performed) -->
      <div v-else class="text-center py-12">
        <div class="text-6xl mb-4">🚀</div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Ready to find your next gem?
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Use the search and filters above to discover amazing meme tokens
        </p>
        
        <!-- Popular Searches -->
        <div class="max-w-md mx-auto">
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Popular searches:</p>
          <div class="flex flex-wrap gap-2 justify-center">
            <button
              v-for="suggestion in popularSearches"
              :key="suggestion"
              @click="performPopularSearch(suggestion)"
              class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SupabaseService } from '@/services/supabase'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'
import TokenCard from '@/components/token/TokenCard.vue'

const router = useRouter()
const route = useRoute()

// State
const tokens = ref<any[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const hasSearched = ref(false)
const totalResults = ref(0)
const hasMore = ref(false)
const page = ref(1)
const viewMode = ref<'grid' | 'list'>('grid')

// Current search parameters
const currentQuery = ref('')
const currentFilters = ref<any>({})

// Popular searches
const popularSearches = [
  'pepe', 'doge', 'meme', 'moon', 'pump', 'trending', 'new'
]

// Methods
const handleSearch = async (query: string, filters: any) => {
  currentQuery.value = query
  currentFilters.value = filters
  page.value = 1
  hasSearched.value = true
  
  await performSearch()
}

const handleFilterChange = async (filters: any) => {
  currentFilters.value = filters
  if (hasSearched.value) {
    page.value = 1
    await performSearch()
  }
}

const performSearch = async () => {
  loading.value = true
  
  try {
    const result = await SupabaseService.searchTokens({
      query: currentQuery.value,
      filters: currentFilters.value,
      page: page.value,
      limit: 20
    })
    
    if (page.value === 1) {
      tokens.value = result.tokens
    } else {
      tokens.value.push(...result.tokens)
    }
    
    totalResults.value = result.total
    hasMore.value = result.hasMore
    
  } catch (error) {
    console.error('Search failed:', error)
    tokens.value = []
    totalResults.value = 0
    hasMore.value = false
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return
  
  loadingMore.value = true
  page.value += 1
  await performSearch()
}

const clearSearch = () => {
  hasSearched.value = false
  tokens.value = []
  totalResults.value = 0
  currentQuery.value = ''
  currentFilters.value = {}
}

const performPopularSearch = (searchTerm: string) => {
  currentQuery.value = searchTerm
  currentFilters.value = { sortBy: 'volume_24h' }
  hasSearched.value = true
  performSearch()
}

const navigateToToken = (mintAddress: string) => {
  router.push(`/token/${mintAddress}`)
}

const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

const formatPrice = (price: number): string => {
  if (price === 0) return '0.000000'
  if (price < 0.000001) return price.toExponential(2)
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  return price.toFixed(2)
}

// Handle URL parameters for direct search links
onMounted(() => {
  const urlQuery = route.query.q as string
  if (urlQuery) {
    currentQuery.value = urlQuery
    hasSearched.value = true
    performSearch()
  }
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 