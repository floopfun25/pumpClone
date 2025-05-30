<template>
  <!-- Token Detail Page -->
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center min-h-screen">
      <div class="spinner w-12 h-12"></div>
    </div>

    <!-- Token Content -->
    <div v-else class="py-8">
      <div class="container mx-auto px-4">
        <!-- Error State -->
        <div v-if="error" class="text-center py-12">
          <div class="text-6xl mb-4">❌</div>
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{{ error }}</h2>
          <router-link to="/" class="btn-primary">Back to Home</router-link>
        </div>

        <!-- Token Header -->
        <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div class="flex flex-col md:flex-row items-start gap-6">
            <!-- Token Image -->
            <div class="w-20 h-20 rounded-full overflow-hidden">
              <img 
                v-if="token?.image_url" 
                :src="token.image_url" 
                :alt="tokenName"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
                {{ tokenSymbol.slice(0, 2) }}
              </div>
            </div>
            
            <!-- Token Info -->
            <div class="flex-1">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {{ tokenName }}
              </h1>
              <p class="text-lg text-gray-600 dark:text-gray-400 mb-4">
                ${{ tokenSymbol }}
              </p>
              <p class="text-gray-700 dark:text-gray-300">
                {{ tokenDescription }}
              </p>
              
              <!-- Creator Info -->
              <div v-if="token?.creator" class="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>Created by</span>
                <span class="font-medium text-primary-600 dark:text-primary-400">
                  {{ token.creator.username || `${token.creator.wallet_address.slice(0, 4)}...${token.creator.wallet_address.slice(-4)}` }}
                </span>
              </div>
            </div>
            
            <!-- Token Stats -->
            <div class="grid grid-cols-2 gap-4 text-center">
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                  ${{ token?.current_price?.toFixed(6) || '0.000000' }}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Price</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-500">-</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">24h Change</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!error" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column: Chart & Trading -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Price Chart -->
            <TokenChart 
              v-if="token?.id" 
              :token-id="token.id"
              :token-symbol="token.symbol"
            />

            <!-- Trading Interface -->
            <div class="card">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Trade</h2>
              
              <div class="grid grid-cols-2 gap-4 mb-6">
                <button 
                  :class="[
                    'py-3 px-6 rounded-lg font-medium transition-colors',
                    tradeType === 'buy' 
                      ? 'bg-pump-green text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  ]"
                  @click="tradeType = 'buy'"
                >
                  Buy
                </button>
                <button 
                  :class="[
                    'py-3 px-6 rounded-lg font-medium transition-colors',
                    tradeType === 'sell' 
                      ? 'bg-pump-red text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  ]"
                  @click="tradeType = 'sell'"
                >
                  Sell
                </button>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount (SOL)
                  </label>
                  <input
                    v-model="tradeAmount"
                    type="number"
                    placeholder="0.1"
                    class="input-field"
                    step="0.001"
                    min="0"
                  />
                </div>

                <button 
                  :class="[
                    'w-full py-3 px-6 rounded-lg font-medium',
                    tradeType === 'buy' ? 'btn-success' : 'btn-danger'
                  ]"
                  @click="executeTrade"
                >
                  {{ tradeType === 'buy' ? '🚀 Buy' : '💰 Sell' }} {{ tokenSymbol }}
                </button>
              </div>
            </div>

            <!-- Comments Section -->
            <TokenComments
              v-if="token?.id"
              :token-id="token.id"
              :token-creator="token.creator?.wallet_address"
              @connect-wallet="connectWallet"
            />
          </div>

          <!-- Right Column: Token Info & Activity -->
          <div class="space-y-6">
            <!-- Token Stats -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Token Stats</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Market Cap</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ token?.market_cap ? formatNumber(token.market_cap) : '0' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">24h Volume</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ token?.volume_24h ? formatNumber(token.volume_24h) : '0' }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Holders</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ token?.holders_count || 0 }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Total Supply</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ token?.total_supply ? formatNumber(token.total_supply) : '0' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Bonding Curve Progress -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Progress</h3>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Bonding Curve Progress</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ token?.bonding_curve_progress || 0 }}%
                  </span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    class="bg-gradient-to-r from-pump-green to-primary-500 h-3 rounded-full transition-all duration-300" 
                    :style="`width: ${token?.bonding_curve_progress || 0}%`"
                  ></div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  When the market cap reaches $69K, all liquidity will be deposited to DEX.
                </p>
              </div>
            </div>

            <!-- Recent Trades -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Trades</h3>
              <div v-if="recentTrades.length > 0" class="space-y-3">
                <div v-for="trade in recentTrades" :key="trade.id" class="flex justify-between items-center">
                  <div class="flex items-center space-x-2">
                    <span :class="trade.type === 'buy' ? 'text-pump-green' : 'text-pump-red'" class="text-sm font-medium">
                      {{ trade.type.toUpperCase() }}
                    </span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">
                      {{ trade.amount }}
                    </span>
                    <span v-if="trade.user" class="text-xs text-gray-400">
                      by {{ trade.user }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ trade.time }}
                  </span>
                </div>
              </div>
              <div v-else class="text-center py-8">
                <div class="text-4xl mb-2">📊</div>
                <p class="text-gray-500 dark:text-gray-400">No trades yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SupabaseService } from '@/services/supabase'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import TokenChart from '@/components/token/TokenChart.vue'
import TokenComments from '@/components/token/TokenComments.vue'

const route = useRoute()
const router = useRouter()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const loading = ref(true)
const tradeType = ref<'buy' | 'sell'>('buy')
const tradeAmount = ref('')
const error = ref('')

// Real token data from Supabase
const token = ref<any>(null)
const recentTrades = ref<any[]>([])

// Computed properties for display
const tokenName = computed(() => token.value?.name || 'Unknown Token')
const tokenSymbol = computed(() => token.value?.symbol || 'N/A')
const tokenDescription = computed(() => token.value?.description || 'No description available.')

/**
 * Connect wallet handler
 */
const connectWallet = async () => {
  try {
    // Open wallet modal using the correct UI store method
    uiStore.showModal('wallet')
  } catch (error) {
    console.error('Failed to connect wallet:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Connection Failed',
      message: 'Failed to connect wallet. Please try again.'
    })
  }
}

/**
 * Execute trade
 * TODO: Integrate with Solana blockchain
 */
const executeTrade = async () => {
  try {
    console.log(`${tradeType.value} ${tradeAmount.value} SOL worth of ${tokenSymbol.value}`)
    // TODO: Implement actual trading logic with bonding curve
  } catch (error) {
    console.error('Trade failed:', error)
  }
}

/**
 * Load token data from Supabase
 */
const loadTokenData = async () => {
  try {
    const mintAddress = route.params.mintAddress as string
    console.log('Loading token:', mintAddress)
    
    if (!mintAddress) {
      throw new Error('No mint address provided')
    }
    
    // Fetch token data from Supabase
    const tokenData = await SupabaseService.getTokenByMint(mintAddress)
    
    if (!tokenData) {
      throw new Error('Token not found')
    }
    
    token.value = tokenData
    
    // Load recent transactions for this token
    const transactions = await SupabaseService.getTokenTransactions(tokenData.id, 10)
    
    // Format transactions for display
    recentTrades.value = transactions.map((tx: any) => ({
      id: tx.id,
      type: tx.transaction_type,
      amount: `${(tx.sol_amount / 1e9).toFixed(3)} SOL`,
      time: formatTimeAgo(tx.created_at),
      user: tx.user?.username || `${tx.user?.wallet_address?.slice(0, 4)}...${tx.user?.wallet_address?.slice(-4)}`
    }))
    
  } catch (err) {
    console.error('Failed to load token:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load token'
    
    // Redirect to 404 if token not found
    if (err instanceof Error && err.message.includes('not found')) {
      router.push('/404')
    }
  } finally {
    loading.value = false
  }
}

/**
 * Format time ago helper
 */
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

/**
 * Format number helper for large numbers
 */
const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

onMounted(() => {
  loadTokenData()
})
</script> 