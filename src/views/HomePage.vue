<template>
  <!-- Home page - main landing page with token listings -->
  <div class="min-h-screen bg-binance-dark">
    <!-- Hero Section with Binance styling -->
    <section class="bg-binance-gradient text-white py-20 relative overflow-hidden">
      <!-- Background pattern -->
      <div class="absolute inset-0 bg-binance-pattern opacity-30"></div>
      
      <div class="container mx-auto px-4 text-center relative z-10">
        <h1 class="text-5xl font-bold mb-6 text-shadow">
          Create & Trade 
          <span class="text-binance-gradient">Meme Tokens</span>
        </h1>
        <p class="text-xl mb-8 max-w-2xl mx-auto opacity-90">
          Launch your own token with fair launch bonding curves. 
          No presales, no team allocations - just pure community-driven tokens on Solana.
        </p>
        
        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <router-link 
            to="/create" 
            class="btn-success px-8 py-4 text-lg font-semibold glow-green"
          >
            🚀 Create Token
          </router-link>
          <button 
            @click="scrollToTokens"
            class="btn-secondary px-8 py-4 text-lg font-semibold bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            📈 Browse Tokens
          </button>
        </div>
      </div>
      
      <!-- Floating elements -->
      <div class="absolute top-20 left-10 w-20 h-20 bg-binance-yellow/20 rounded-full animate-pulse"></div>
      <div class="absolute bottom-20 right-10 w-16 h-16 bg-trading-buy/20 rounded-full animate-bounce"></div>
    </section>
    
    <!-- Stats Section -->
    <section class="py-16 bg-trading-surface border-b border-binance-border">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div class="text-center">
            <div class="text-3xl font-bold text-binance-yellow mb-2">{{ formatNumber(stats.totalTokens) }}</div>
            <div class="text-binance-gray text-sm uppercase tracking-wide">Total Tokens</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-trading-buy mb-2">{{ formatNumber(stats.totalVolume) }}</div>
            <div class="text-binance-gray text-sm uppercase tracking-wide">Volume (SOL)</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-white mb-2">{{ formatNumber(stats.totalUsers) }}</div>
            <div class="text-binance-gray text-sm uppercase tracking-wide">Total Users</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-binance-yellow mb-2">{{ formatNumber(stats.graduatedTokens) }}</div>
            <div class="text-binance-gray text-sm uppercase tracking-wide">Graduated</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Trending Tokens Section -->
    <section class="py-16 bg-binance-dark">
      <div class="container mx-auto px-4">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-white mb-4">🔥 Trending Tokens</h2>
          <p class="text-binance-gray max-w-2xl mx-auto">
            Discover the hottest meme tokens with the highest trading volume and community engagement
          </p>
        </div>
        
        <TrendingTokens />
      </div>
    </section>

    <!-- Main Tokens Section -->
    <section id="tokens" class="py-16 bg-trading-surface">
      <div class="container mx-auto px-4">
        <!-- Section Header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h2 class="text-3xl font-bold text-white mb-2">All Tokens</h2>
            <p class="text-binance-gray">Browse all available tokens in the ecosystem</p>
          </div>
          
          <!-- Controls -->
          <div class="flex flex-col sm:flex-row gap-4 mt-4 md:mt-0">
            <!-- Search -->
            <div class="relative">
              <input
                v-model="simpleQuery"
                @keyup.enter="handleSimpleSearch"
                type="text"
                placeholder="Search tokens..."
                class="input-field pl-10 w-full sm:w-64"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-binance-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <!-- Sort & Filter -->
            <div class="flex gap-2">
              <select 
                v-model="sortBy" 
                @change="() => loadTokens()"
                class="input-field px-3 py-2 min-w-0"
              >
                <option value="created_at">Latest</option>
                <option value="market_cap">Market Cap</option>
                <option value="volume_24h">Volume</option>
              </select>
              
              <button
                @click="showAdvancedSearch = !showAdvancedSearch"
                class="btn-secondary px-4 py-2 whitespace-nowrap"
              >
                {{ showAdvancedSearch ? 'Hide' : 'Advanced' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Advanced Search -->
        <div v-if="showAdvancedSearch" class="mb-8">
          <AdvancedSearch 
            @search="handleSearch"
            @filter-change="handleFilterChange"
            :loading="searchLoading"
          />
        </div>
        
        <!-- Tokens Grid -->
        <div v-if="tokens.length > 0" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TokenCard
              v-for="token in tokens"
              :key="token.id"
              :token="token"
              class="trading-card hover:glow-gold"
            />
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-else class="text-center py-12">
          <div class="text-6xl mb-4">🎭</div>
          <h3 class="text-xl font-semibold text-white mb-2">
            No tokens found
          </h3>
          <p class="text-binance-gray mb-6">
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
const sortBy = ref<'created_at' | 'market_cap' | 'volume_24h'>('created_at')
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
  } else {
    return num.toString()
  }
}

/**
 * Load dashboard statistics
 */
const loadStats = async () => {
  try {
    const data = await SupabaseService.getDashboardStats()
    stats.value = data
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

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
    
    if (reset) {
      tokens.value = data
    } else {
      tokens.value.push(...data)
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
  background: linear-gradient(135deg, #f0b90b 0%, #fcd34d 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Binance-specific animations */
@keyframes glow {
  0%, 100% { 
    box-shadow: 0 0 5px rgba(240, 185, 11, 0.3); 
  }
  50% { 
    box-shadow: 0 0 20px rgba(240, 185, 11, 0.6); 
  }
}

.glow-gold:hover {
  animation: glow 2s ease-in-out infinite;
}
</style> 