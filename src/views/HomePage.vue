<template>
  <!-- Home page - main landing page with token listings -->
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark">
    <!-- Hero Section -->
    <section class="bg-gradient-to-br from-primary-600 to-purple-700 text-white py-20">
      <div class="container mx-auto px-4 text-center">
        <h1 class="text-5xl font-bold mb-6">
          Create & Trade 
          <span class="text-gradient">Meme Tokens</span>
        </h1>
        <p class="text-xl mb-8 max-w-2xl mx-auto opacity-90">
          Launch your own token with fair launch bonding curves. 
          No presales, no team allocations - just pure community-driven tokens on Solana.
        </p>
        
        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <router-link 
            to="/create" 
            class="btn-success px-8 py-4 text-lg font-semibold"
          >
            🚀 Create Token
          </router-link>
          <button 
            @click="scrollToTokens"
            class="btn-secondary px-8 py-4 text-lg font-semibold bg-white/20 text-white border-white/30"
          >
            📈 Browse Tokens
          </button>
        </div>
      </div>
    </section>
    
    <!-- Stats Section -->
    <section class="py-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div class="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {{ formatNumber(stats.totalTokens) }}
            </div>
            <div class="text-gray-600 dark:text-gray-400">Tokens Created</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-pump-green">
              {{ formatNumber(stats.totalVolume) }} SOL
            </div>
            <div class="text-gray-600 dark:text-gray-400">Total Volume</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-purple-600">
              {{ formatNumber(stats.totalUsers) }}
            </div>
            <div class="text-gray-600 dark:text-gray-400">Active Users</div>
          </div>
          <div>
            <div class="text-3xl font-bold text-orange-600">
              {{ formatNumber(stats.graduatedTokens) }}
            </div>
            <div class="text-gray-600 dark:text-gray-400">Graduated</div>
          </div>
        </div>
      </div>
    </section>
    
    <!-- Trending Section -->
    <section class="py-12 bg-white dark:bg-gray-800">
      <div class="container mx-auto px-4">
        <TrendingTokens :limit="5" />
      </div>
    </section>
    
    <!-- Search Section -->
    <div class="container mx-auto px-4 mb-12">
      <div class="max-w-2xl mx-auto">
        <!-- Toggle Advanced Search -->
        <div class="text-center mb-6">
          <button
            @click="showAdvancedSearch = !showAdvancedSearch"
            class="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
          >
            {{ showAdvancedSearch ? '🔍 Hide Advanced Search' : '🎯 Show Advanced Search' }}
          </button>
        </div>
        
        <!-- Advanced Search Panel -->
        <div v-if="showAdvancedSearch" class="mb-8">
          <AdvancedSearch
            :loading="searchLoading"
            :result-count="searchResults.length"
            @search="handleSearch"
            @filter-change="handleFilterChange"
          />
        </div>
        
        <!-- Simple Search (when advanced is hidden) -->
        <div v-else class="relative">
          <input 
            v-model="simpleQuery"
            @input="handleSimpleSearch"
            type="text" 
            placeholder="Search tokens by name, symbol, or creator..."
            class="w-full px-6 py-4 pl-14 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Main Content: Token Listings -->
    <section id="tokens" class="py-12">
      <div class="container mx-auto px-4">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Explore Tokens
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              Discover the latest meme tokens on Solana
            </p>
          </div>
          
          <!-- Filter and Sort Controls -->
          <div class="flex flex-wrap gap-4">
            <select 
              v-model="sortBy" 
              class="input-field text-sm"
              @change="loadTokens"
            >
              <option value="created_at">Newest</option>
              <option value="market_cap">Market Cap</option>
              <option value="volume_24h">Volume</option>
            </select>
            
            <select 
              v-model="filterBy" 
              class="input-field text-sm"
              @change="loadTokens"
            >
              <option value="all">All Tokens</option>
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>
        </div>
        
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="spinner w-8 h-8"></div>
        </div>
        
        <!-- Token Grid -->
        <div v-else-if="tokens.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <TokenCard
            v-for="token in tokens"
            :key="token.id"
            :token="token"
            @click="goToToken(token.mint_address)"
          />
        </div>
        
        <!-- Empty State -->
        <div v-else class="text-center py-12">
          <div class="text-6xl mb-4">🎭</div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No tokens found
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Be the first to create a meme token!
          </p>
          <router-link to="/create" class="btn-primary">
            Create First Token
          </router-link>
        </div>
        
        <!-- Load More Button -->
        <div v-if="tokens.length > 0 && hasMore" class="text-center mt-8">
          <button 
            @click="loadMoreTokens"
            :disabled="loadingMore"
            class="btn-secondary px-8 py-3"
          >
            <span v-if="loadingMore" class="flex items-center gap-2">
              <div class="spinner w-4 h-4"></div>
              Loading...
            </span>
            <span v-else>Load More</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import TokenCard from '@/components/token/TokenCard.vue'
import { SupabaseService } from '@/services/supabase'
import TrendingTokens from '@/components/token/TrendingTokens.vue'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'

const router = useRouter()

// Reactive state
const tokens = ref<any[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const sortBy = ref('created_at')
const filterBy = ref('all')
const page = ref(1)
const hasMore = ref(true)
const showAdvancedSearch = ref(false)
const searchLoading = ref(false)
const searchResults = ref<any[]>([])
const simpleQuery = ref('')

// Real stats data from Supabase
const stats = ref({
  totalTokens: 0,
  totalVolume: 0,
  totalUsers: 0,
  graduatedTokens: 0
})

/**
 * Format numbers for display with K/M suffixes
 */
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

/**
 * Load dashboard statistics from database
 */
const loadStats = async () => {
  try {
    const dashboardStats = await SupabaseService.getDashboardStats()
    stats.value = dashboardStats
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
  }
}

/**
 * Load tokens from the database
 * Fetches tokens based on current sort and filter settings
 */
const loadTokens = async () => {
  try {
    loading.value = true
    page.value = 1
    
    const tokenData = await SupabaseService.getTokens({
      page: page.value,
      limit: 20,
      sortBy: sortBy.value as 'created_at' | 'market_cap' | 'volume_24h',
      status: filterBy.value === 'all' ? undefined : filterBy.value
    })
    
    tokens.value = tokenData
    hasMore.value = tokenData.length === 20 // If we got a full page, there might be more
    
  } catch (error) {
    console.error('Failed to load tokens:', error)
    tokens.value = []
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

/**
 * Load more tokens for pagination
 */
const loadMoreTokens = async () => {
  try {
    loadingMore.value = true
    page.value += 1
    
    const moreTokens = await SupabaseService.getTokens({
      page: page.value,
      limit: 20,
      sortBy: sortBy.value as 'created_at' | 'market_cap' | 'volume_24h',
      status: filterBy.value === 'all' ? undefined : filterBy.value
    })
    
    tokens.value.push(...moreTokens)
    hasMore.value = moreTokens.length === 20
    
  } catch (error) {
    console.error('Failed to load more tokens:', error)
  } finally {
    loadingMore.value = false
  }
}

/**
 * Navigate to token detail page
 */
const goToToken = (mintAddress: string) => {
  router.push(`/token/${mintAddress}`)
}

/**
 * Smooth scroll to tokens section
 */
const scrollToTokens = () => {
  const element = document.getElementById('tokens')
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

/**
 * Handle search
 */
const handleSearch = async (query: string, filters: any) => {
  try {
    searchLoading.value = true
    const result = await SupabaseService.searchTokens({ query, filters })
    searchResults.value = result.tokens
  } catch (error) {
    console.error('Failed to search tokens:', error)
    searchResults.value = []
  } finally {
    searchLoading.value = false
  }
}

/**
 * Handle filter change
 */
const handleFilterChange = (filters: any) => {
  // Update filters and reload if needed
  console.log('Filter changed:', filters)
}

/**
 * Handle simple search
 */
const handleSimpleSearch = () => {
  // Implement simple search logic
}

// Load initial data when component mounts
onMounted(async () => {
  await Promise.all([
    loadStats(),
    loadTokens()
  ])
})
</script>

<style scoped>
/* Component-specific styles */
.text-gradient {
  background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style> 