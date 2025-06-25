<template>
  <div v-if="kingToken" class="king-of-hill-container mb-8">
    <!-- Crown Header -->
    <div class="text-center mb-6">
      <div class="inline-flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-6 py-3 rounded-full text-lg font-bold shadow-lg">
        👑 {{ $t('token.kingOfHill') }} 👑
      </div>
      <p class="text-gray-400 text-sm mt-2">{{ $t('token.kingOfHillDescription') }}</p>
    </div>

    <!-- King Token Card -->
    <div class="king-token-card relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20 border-2 border-yellow-400/50 shadow-2xl">
      <!-- Animated Background -->
      <div class="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 animate-pulse"></div>
      
      <!-- Crown Badge -->
      <div class="absolute top-4 right-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold animate-bounce">
        👑 KING
      </div>

      <div class="relative z-10 p-8">
        <div class="flex flex-col lg:flex-row items-center gap-8">
          <!-- Token Image & Info -->
          <div class="flex items-center gap-6">
            <div class="w-24 h-24 rounded-full overflow-hidden ring-4 ring-yellow-400/50">
              <img 
                v-if="kingToken.image_url" 
                :src="kingToken.image_url" 
                :alt="kingToken.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-black font-bold text-3xl">
                {{ kingToken.symbol.slice(0, 2) }}
              </div>
            </div>
            
            <div>
              <h3 class="text-3xl font-bold text-white mb-2 flex items-center gap-2">
                {{ kingToken.name }}
                <span class="text-yellow-400 text-lg">👑</span>
              </h3>
              <p class="text-xl text-yellow-400 font-semibold mb-2">
                ${{ kingToken.symbol }}
              </p>
              <p class="text-gray-300 max-w-md">
                {{ kingToken.description }}
              </p>
            </div>
          </div>

          <!-- King Stats -->
          <div class="flex-1 lg:ml-8">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div class="text-center">
                <div class="text-2xl font-bold text-yellow-400 mb-1">
                  ${{ formatPrice(kingToken.current_price) }}
                </div>
                <div class="text-sm text-gray-400 uppercase tracking-wide">{{ $t('token.price') }}</div>
              </div>
              
              <div class="text-center">
                <div class="text-2xl font-bold text-green-400 mb-1">
                  ${{ formatMarketCap((kingToken.market_cap || 0) / 1e9) }}
                </div>
                <div class="text-sm text-gray-400 uppercase tracking-wide">{{ $t('token.marketCapShort') }}</div>
              </div>
              
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-400 mb-1">
                  {{ kingToken.kingScore?.toFixed(0) || '0' }}
                </div>
                <div class="text-sm text-gray-400 uppercase tracking-wide">King Score</div>
              </div>
              
              <div class="text-center">
                <div class="text-2xl font-bold text-purple-400 mb-1">
                  {{ commentsCount }}
                </div>
                <div class="text-sm text-gray-400 uppercase tracking-wide">{{ $t('token.comments') }}</div>
              </div>
            </div>

            <!-- Bonding Curve Progress -->
            <div class="mt-6">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm text-gray-400">{{ $t('tokenDetail.progressToDEX') }}</span>
                <span class="text-sm text-yellow-400 font-semibold">
                  {{ bondingProgress?.progress.toFixed(1) || 0 }}%
                </span>
              </div>
              <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div 
                  class="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-500 ease-out"
                  :style="{ width: `${bondingProgress?.progress || 0}%` }"
                ></div>
              </div>
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>${{ formatNumber((kingToken.market_cap || 0) / 1e9) }}</span>
                <span>${{ formatNumber(69000) }}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-4 mt-6">
              <router-link 
                :to="`/token/${kingToken.id}`"
                class="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-3 px-6 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-200 text-center shadow-lg"
              >
                🚀 {{ $t('token.trade') }}
              </router-link>
              
              <button 
                @click="$emit('buy-token', kingToken)"
                class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 shadow-lg"
              >
                💰 {{ $t('token.buy') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Creator Info -->
        <div v-if="kingToken.creator" class="mt-6 pt-6 border-t border-yellow-400/30">
          <div class="flex items-center gap-3">
            <span class="text-gray-400">{{ $t('token.createdBy') }}</span>
            <span class="text-yellow-400 font-semibold">
              {{ kingToken.creator.username || `${kingToken.creator.wallet_address.slice(0, 6)}...${kingToken.creator.wallet_address.slice(-4)}` }}
            </span>
            <span class="text-gray-500 text-sm">
              {{ formatTimeAgo(kingToken.created_at) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hot Indicator -->
    <div class="text-center mt-4">
      <span class="inline-flex items-center bg-red-500/20 text-red-400 px-4 py-2 rounded-full text-sm font-semibold animate-pulse">
        🔥 {{ $t('token.hot') }} 🔥
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { SupabaseService } from '@/services/supabase'

interface KingToken {
  id: string
  name: string
  symbol: string
  description: string
  image_url?: string
  current_price: number
  market_cap: number
  volume_24h: number
  created_at: string
  creator?: {
    id: string
    username?: string
    wallet_address: string
  }
  kingScore?: number
  comments?: any[]
}

// Emits
defineEmits<{
  'buy-token': [token: KingToken]
}>()

// State
const kingToken = ref<KingToken | null>(null)
const bondingProgress = ref<any>(null)
const loading = ref(true)
const updateInterval = ref<NodeJS.Timeout | null>(null)

// Computed
const commentsCount = computed(() => {
  if (!kingToken.value?.comments) return 0
  return Array.isArray(kingToken.value.comments) 
    ? kingToken.value.comments.length 
    : (kingToken.value.comments as any)?.count || 0
})

// Methods
const loadKingOfTheHill = async () => {
  try {
    const token = await SupabaseService.getKingOfTheHillToken()
    kingToken.value = token
    
    if (token) {
      // Load bonding curve progress
      const progress = await SupabaseService.getBondingCurveProgress(token.id)
      bondingProgress.value = progress
    }
  } catch (error) {
    console.error('Failed to load King of the Hill:', error)
  } finally {
    loading.value = false
  }
}

const formatPrice = (price: number): string => {
  if (price >= 1) return price.toFixed(4)
  if (price >= 0.001) return price.toFixed(6)
  return price.toExponential(2)
}

const formatMarketCap = (marketCap: number): string => {
  if (marketCap >= 1000000) {
    return (marketCap / 1000000).toFixed(1) + 'M'
  } else if (marketCap >= 1000) {
    return (marketCap / 1000).toFixed(1) + 'K'
  }
  return marketCap.toFixed(0)
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num)
}

const formatTimeAgo = (timestamp: string): string => {
  const now = Date.now()
  const time = new Date(timestamp).getTime()
  const diff = now - time
  
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Lifecycle
onMounted(() => {
  loadKingOfTheHill()
  
  // Update every 30 seconds
  updateInterval.value = setInterval(() => {
    loadKingOfTheHill()
  }, 30000)
})

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
})
</script>

<style scoped>
.king-of-hill-container {
  position: relative;
}

.king-token-card {
  position: relative;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(251, 191, 36, 0.3);
}

.king-token-card::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #fbbf24, #f97316, #dc2626, #fbbf24);
  border-radius: inherit;
  z-index: -1;
  animation: glow 3s ease-in-out infinite alternate;
}

@keyframes glow {
  0% {
    opacity: 0.5;
    transform: scale(1);
  }
  100% {
    opacity: 0.8;
    transform: scale(1.02);
  }
}

.text-shadow {
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .king-token-card {
    margin: 0 1rem;
  }
  
  .king-token-card .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}
</style> 