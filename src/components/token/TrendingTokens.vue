<template>
  <div class="card">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">👑 King of the Hill</h2>
        <p class="text-gray-600 dark:text-gray-400">Hottest tokens climbing the ranks</p>
      </div>
      <button 
        @click="refreshTrending" 
        :disabled="loading"
        class="text-primary-600 hover:text-primary-700 p-2"
      >
        🔄
      </button>
    </div>

    <!-- Trending Filters -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="filter in filters"
        :key="filter.value"
        @click="selectedFilter = filter.value"
        :class="[
          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          selectedFilter === filter.value
            ? 'bg-primary-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        ]"
      >
        {{ filter.label }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="spinner w-8 h-8"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8">
      <div class="text-4xl mb-2">⚠️</div>
      <p class="text-red-500 mb-4">{{ error }}</p>
      <button @click="refreshTrending" class="btn-primary">
        Try Again
      </button>
    </div>

    <!-- Trending Tokens List -->
    <div v-else-if="trendingTokens.length > 0" class="space-y-3">
      <div
        v-for="(token, index) in trendingTokens"
        :key="token.id"
        @click="navigateToToken(token.mint_address)"
        class="group relative p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 transition-all cursor-pointer hover:shadow-md"
      >
        <!-- Rank Badge -->
        <div class="absolute top-2 left-2">
          <div :class="[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
            index === 0 ? 'bg-yellow-500 text-white' :
            index === 1 ? 'bg-gray-400 text-white' :
            index === 2 ? 'bg-amber-600 text-white' :
            'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
          ]">
            {{ index === 0 ? '👑' : index + 1 }}
          </div>
        </div>

        <!-- Hot Badge -->
        <div v-if="token.volume_24h_change > 100" class="absolute top-2 right-2">
          <span class="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
            🔥 HOT
          </span>
        </div>

        <div class="flex items-center space-x-4 ml-10">
          <!-- Token Image -->
          <div class="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-purple-500 flex-shrink-0">
            <img 
              v-if="token.image_url" 
              :src="token.image_url" 
              :alt="token.name"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-white font-bold">
              {{ token.symbol.slice(0, 2) }}
            </div>
          </div>

          <!-- Token Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                {{ token.name }}
              </h3>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                ${{ token.symbol }}
              </span>
              <span v-if="token.is_featured" class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                Featured
              </span>
            </div>
            <div class="flex items-center space-x-4 text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                MC: ${{ formatNumber(token.market_cap) }}
              </span>
              <span :class="[
                'font-medium',
                token.price_change_24h >= 0 ? 'text-pump-green' : 'text-pump-red'
              ]">
                {{ token.price_change_24h >= 0 ? '+' : '' }}{{ token.price_change_24h?.toFixed(1) || 0 }}%
              </span>
            </div>
          </div>

          <!-- Metrics -->
          <div class="text-right space-y-1">
            <div class="text-lg font-bold text-gray-900 dark:text-white">
              ${{ formatPrice(token.current_price) }}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              Vol: ${{ formatNumber(token.volume_24h) }}
            </div>
          </div>

          <!-- Arrow -->
          <div class="text-gray-400 group-hover:text-primary-500 transition-colors">
            ➤
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mt-3 ml-10">
          <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Bonding Curve Progress</span>
            <span>{{ token.bonding_curve_progress || 0 }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              class="bg-gradient-to-r from-pump-green to-primary-500 h-2 rounded-full transition-all duration-300" 
              :style="`width: ${token.bonding_curve_progress || 0}%`"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <div class="text-4xl mb-2">🏆</div>
      <p class="text-gray-500 dark:text-gray-400">No trending tokens yet</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Create a token to get started!</p>
    </div>

    <!-- View All Button -->
    <div v-if="trendingTokens.length > 0" class="mt-6 text-center">
      <router-link 
        to="/?sort=trending" 
        class="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
      >
        View All Trending →
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { SupabaseService } from '@/services/supabase'
import { useUIStore } from '@/stores/ui'

interface TrendingToken {
  id: string
  mint_address: string
  name: string
  symbol: string
  image_url?: string
  current_price: number
  market_cap: number
  volume_24h: number
  volume_24h_change: number
  price_change_24h: number
  bonding_curve_progress: number
  holders_count: number
  is_featured: boolean
  created_at: string
}

// Props
interface Props {
  limit?: number
}

const props = withDefaults(defineProps<Props>(), {
  limit: 10
})

// Stores
const router = useRouter()
const uiStore = useUIStore()

// State
const trendingTokens = ref<TrendingToken[]>([])
const loading = ref(false)
const error = ref('')
const selectedFilter = ref('volume')

// Filter options
const filters = [
  { label: '🔥 Volume', value: 'volume' },
  { label: '📈 Price', value: 'price' },
  { label: '👥 Holders', value: 'holders' },
  { label: '🆕 New', value: 'new' },
  { label: '🎯 Featured', value: 'featured' }
]

// Methods
const loadTrendingTokens = async () => {
  loading.value = true
  error.value = ''

  try {
    const data = await SupabaseService.getTrendingTokens(selectedFilter.value, props.limit)
    trendingTokens.value = data
  } catch (err) {
    console.error('Failed to load trending tokens:', err)
    error.value = 'Failed to load trending tokens'
  } finally {
    loading.value = false
  }
}

const refreshTrending = () => {
  loadTrendingTokens()
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

// Watchers
watch(selectedFilter, () => {
  loadTrendingTokens()
})

// Lifecycle
onMounted(() => {
  loadTrendingTokens()
})
</script> 