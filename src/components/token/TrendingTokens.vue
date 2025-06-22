<template>
  <div class="card">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">👑 {{ $t('token.kingOfHill') }}</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ $t('token.kingOfHillDescription') }}</p>
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
        {{ $t('trading.retry') }}
      </button>
    </div>

    <!-- Trending Tokens List -->
    <div v-else-if="trendingTokens && trendingTokens.length > 0" class="space-y-3">
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
            🔥 {{ $t('token.hot') }}
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
                {{ $t('token.featured') }}
              </span>
            </div>
            <div class="flex items-center space-x-4 text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                {{ $t('token.marketCapShort') }}: ${{ formatNumber(token.market_cap) }}
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
              {{ $t('token.volumeShort') }}: ${{ formatNumber(token.volume_24h) }}
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
            <span>{{ $t('token.bondingCurveProgress') }}</span>
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
      <p class="text-gray-500 dark:text-gray-400">{{ $t('token.noTrendingTokens') }}</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">{{ $t('token.createTokenToStart') }}</p>
    </div>

    <!-- View All Button -->
    <div v-if="trendingTokens && trendingTokens.length > 0" class="mt-6 text-center">
      <router-link 
        to="/?sort=trending" 
        class="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
      >
        {{ $t('token.viewAllTrending') }} →
      </router-link>
    </div>
  </div>
</template>

<script>
import { SupabaseService } from '@/services/supabase'
import { useUIStore } from '@/stores/ui'

export default {
  name: 'TrendingTokens',
  props: {
    limit: {
      type: Number,
      default: 10
    }
  },
  data() {
    return {
      loading: true,
      error: null,
      trendingTokens: null,
      selectedFilter: 'all',
      filters: [
        { label: this.$t('common.all'), value: 'all' },
        { label: this.$t('token.graduated'), value: 'graduated' },
        { label: this.$t('token.active'), value: 'active' }
      ]
    }
  },
  methods: {
    formatNumber(value) {
      const num = Number(value)
      if (isNaN(num)) return '0'
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
      return num.toString()
    },
    formatPrice(value) {
      const num = Number(value)
      if (isNaN(num)) return '0.00'
      if (num >= 1) return num.toFixed(2)
      return num.toFixed(6)
    },
    async refreshTrending() {
      this.loading = true
      this.error = null
      this.trendingTokens = null
      
      try {
        const { data, error } = await SupabaseService.getTrendingTokens(this.limit)
        if (error) throw error
        
        this.trendingTokens = data || []
      } catch (error) {
        console.error('Failed to fetch trending tokens:', error)
        this.error = this.$t('error.failedToFetchTrending')
      } finally {
        this.loading = false
      }
    },
    navigateToToken(mintAddress) {
      if (!mintAddress) return
      this.$router.push(`/token/${mintAddress}`)
    }
  },
  async created() {
    await this.refreshTrending()
  },
  watch: {
    selectedFilter: {
      handler(newValue) {
        this.refreshTrending()
      }
    }
  }
}
</script>

<style scoped>
.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid #3498db;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 