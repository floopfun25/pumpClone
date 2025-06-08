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
          <router-link to="/" class="btn-primary">{{ $t('common.back') }}</router-link>
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
                <span>{{ $t('token.createdBy') }}</span>
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
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('token.price') }}</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-500">-</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.change24h') }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!error" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column: Chart & Trading -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Price Chart -->
            <SimpleTokenChart 
              v-if="token?.id" 
              :token-id="token.id"
              :token-symbol="token.symbol"
              :mint-address="token.mint_address"
            />

            <!-- Trading Interface -->
            <div class="card">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('token.trade') }}</h2>
              
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
                  {{ $t('token.buy') }}
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
                  {{ $t('token.sell') }}
                </button>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ $t('tokenDetail.amountSOL') }}
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
                  {{ tradeType === 'buy' ? '🚀 ' + $t('token.buy') : '💰 ' + $t('token.sell') }} {{ tokenSymbol }}
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

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3">
              <button class="btn-primary flex-1">
                🚀 {{ $t('tokenDetail.buyToken') }}
              </button>
              <button class="btn-secondary">
                📊 {{ $t('token.trade') }}
              </button>
              
              <!-- Social Share -->
              <SocialShare
                content-type="token"
                :share-data="shareData"
                :button-text="$t('common.share')"
                button-class="btn-secondary"
              />
              
              <!-- Direct Message Creator -->
              <DirectMessages
                v-if="token.creator"
                :recipient-address="token.creator.wallet_address"
                :button-text="$t('tokenDetail.messageCreator')"
                button-class="btn-secondary"
              />
            </div>
          </div>

          <!-- Right Column: Token Info & Activity -->
          <div class="space-y-6">
            <!-- Real-time Market Analytics -->
            <div v-if="tokenAnalytics" class="card">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ $t('tokenDetail.liveAnalytics') }}</h3>
                <div class="flex items-center space-x-2">
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span class="text-xs text-green-600">{{ $t('tokenDetail.realTime') }}</span>
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div class="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">RSI</div>
                  <div class="text-lg font-bold text-blue-900 dark:text-blue-100">
                    {{ formatRSI(tokenAnalytics.technicalIndicators.rsi) }}
                  </div>
                </div>
                
                <div class="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div class="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wide">{{ $t('tokenDetail.volatility') }}</div>
                  <div class="text-lg font-bold text-purple-900 dark:text-purple-100">
                    {{ tokenAnalytics.technicalIndicators.volatility.toFixed(1) }}%
                  </div>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.sentiment') }}</span>
                  <span :class="formatSentiment(tokenAnalytics.socialMetrics.sentiment_score).color" class="font-medium">
                    {{ formatSentiment(tokenAnalytics.socialMetrics.sentiment_score).text }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.riskLevel') }}</span>
                  <span :class="formatRiskLevel(tokenAnalytics.riskMetrics.volatility_score).color" class="font-medium">
                    {{ formatRiskLevel(tokenAnalytics.riskMetrics.volatility_score).text }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.transactions24h') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ tokenAnalytics.marketData.transactions24h }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Enhanced Token Stats -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('tokenDetail.tokenStats') }}</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.currentPrice') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ token?.current_price?.toFixed(8) || '0.00000000' }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('token.marketCap') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ marketCapFormatted }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('token.volume24h') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ tokenAnalytics ? formatVolume(tokenAnalytics.marketData.volume24h) : formatNumber(token?.volume_24h || 0) }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('token.holders') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ tokenAnalytics ? tokenAnalytics.marketData.holders : (token?.holders_count || 0) }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.totalSupply') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ token?.total_supply ? formatNumber(token.total_supply) : '0' }}
                  </span>
                </div>
                
                <div v-if="tokenAnalytics" class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.liquidity') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ formatNumber(tokenAnalytics.marketData.liquidity) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Technical Indicators -->
            <div v-if="tokenAnalytics" class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('tokenDetail.technicalAnalysis') }}</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.sma7d') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ tokenAnalytics.technicalIndicators.price_sma_7d.toFixed(8) }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.sma30d') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    ${{ tokenAnalytics.technicalIndicators.price_sma_30d.toFixed(8) }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.momentum') }}</span>
                  <span :class="[
                    'font-medium',
                    tokenAnalytics.technicalIndicators.momentum >= 0 ? 'text-green-600' : 'text-red-600'
                  ]">
                    {{ tokenAnalytics.technicalIndicators.momentum >= 0 ? '+' : '' }}{{ tokenAnalytics.technicalIndicators.momentum.toFixed(2) }}%
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.volumeSMA') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ formatVolume(tokenAnalytics.technicalIndicators.volume_sma) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Bonding Curve Progress -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('tokenDetail.progressToDEX') }}</h3>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('token.bondingCurveProgress') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ progressPercentage }}%
                  </span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    class="bg-gradient-to-r from-pump-green to-primary-500 h-3 rounded-full transition-all duration-300" 
                    :style="`width: ${progressPercentage}%`"
                  ></div>
                </div>
                <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>${{ formatNumber(token?.market_cap || 0) }}</span>
                  <span>{{ $t('tokenDetail.goal69K') }}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {{ $t('tokenDetail.graduationDescription') }}
                </p>
              </div>
            </div>

            <!-- Social Metrics (if available) -->
            <div v-if="tokenAnalytics" class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('tokenDetail.socialActivity') }}</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.mentions24h') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ tokenAnalytics.socialMetrics.mentions_24h }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.trendingRank') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    #{{ tokenAnalytics.socialMetrics.trending_rank }}
                  </span>
                </div>
                
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">{{ $t('tokenDetail.communityActivity') }}</span>
                  <span class="font-medium text-gray-900 dark:text-white">
                    {{ tokenAnalytics.socialMetrics.community_activity.toFixed(1) }}/100
                  </span>
                </div>
              </div>
            </div>

            <!-- Recent Trades -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ $t('tokenDetail.recentTrades') }}</h3>
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
                      {{ $t('tokenDetail.by') }} {{ trade.user }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ trade.time }}
                  </span>
                </div>
              </div>
              <div v-else class="text-center py-8">
                <div class="text-4xl mb-2">📊</div>
                <p class="text-gray-500 dark:text-gray-400">{{ $t('tokenDetail.noTradesYet') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PublicKey } from '@solana/web3.js'
import { SupabaseService } from '@/services/supabase'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { solanaProgram } from '@/services/solanaProgram'
import { marketAnalyticsService, formatRSI, formatSentiment, formatRiskLevel, type TokenAnalytics } from '@/services/marketAnalytics'
import { formatVolume } from '@/services/priceOracle'
import TokenComments from '@/components/token/TokenComments.vue'
import SocialShare from '@/components/social/SocialShare.vue'
import DirectMessages from '@/components/social/DirectMessages.vue'
import SimpleTokenChart from '@/components/charts/SimpleTokenChart.vue'

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

// Market analytics data
const tokenAnalytics = ref<TokenAnalytics | null>(null)
let analyticsSubscription: (() => void) | null = null

// Computed properties for display
const tokenName = computed(() => token.value?.name || 'Unknown Token')
const tokenSymbol = computed(() => token.value?.symbol || 'N/A')
const tokenDescription = computed(() => token.value?.description || 'No description available.')

// Computed properties
const marketCapFormatted = computed(() => {
  if (!token.value?.market_cap) return '$0'
  return `$${formatNumber(token.value.market_cap)}`
})

const progressPercentage = computed(() => {
  const marketCap = token.value?.market_cap || 0
  const graduationThreshold = 69000 // $69K
  return Math.min(100, (marketCap / graduationThreshold) * 100)
})

const shareData = computed(() => ({
  title: token.value ? `${token.value.name} ($${token.value.symbol})` : '',
  description: token.value?.description || 'Check out this amazing meme token on FloppFun!',
  url: `${window.location.origin}/token/${token.value?.mint_address || ''}`,
  hashtags: ['FloppFun', 'memecoins', 'Solana', token.value?.symbol || ''].filter(Boolean)
}))

const priceChangeColor = computed(() => {
  const change = token.value?.price_change_24h || 0
  return change >= 0 ? 'text-pump-green' : 'text-pump-red'
})

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
 * Integrated with Solana blockchain via solanaProgram service
 */
const executeTrade = async () => {
  if (!walletStore.isConnected) {
    uiStore.showToast({
      type: 'error',
      title: 'Wallet Not Connected',
      message: 'Please connect your wallet to trade'
    })
    return
  }

  if (!token.value?.mint_address) {
    uiStore.showToast({
      type: 'error',
      title: 'Token Not Found',
      message: 'Token information is not available'
    })
    return
  }

  const amount = parseFloat(tradeAmount.value)
  if (!amount || amount <= 0) {
    uiStore.showToast({
      type: 'error',
      title: 'Invalid Amount',
      message: 'Please enter a valid amount'
    })
    return
  }

  try {
    uiStore.setLoading(true)
    
    const mintAddress = new PublicKey(token.value.mint_address)
    let signature: string

    if (tradeType.value === 'buy') {
      // Execute buy transaction
      signature = await solanaProgram.buyTokens(mintAddress, amount)
      
      uiStore.showToast({
        type: 'success',
        title: 'Buy Order Successful!',
        message: `Successfully bought ${tokenSymbol.value} tokens`
      })
    } else {
      // Execute sell transaction
      signature = await solanaProgram.sellTokens(mintAddress, amount)
      
      uiStore.showToast({
        type: 'success',
        title: 'Sell Order Successful!',
        message: `Successfully sold ${tokenSymbol.value} tokens`
      })
    }

    // Clear the trade amount
    tradeAmount.value = ''
    
    // Refresh token data to show updated stats
    await loadTokenData()
    
    console.log(`${tradeType.value} transaction completed:`, signature)
    
  } catch (error: any) {
    console.error('Trade failed:', error)
    
    uiStore.showToast({
      type: 'error',
      title: 'Trade Failed',
      message: error.message || 'An unexpected error occurred during the trade'
    })
  } finally {
    uiStore.setLoading(false)
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
    
    // Load market analytics
    try {
      const analytics = await marketAnalyticsService.getTokenAnalytics(mintAddress)
      tokenAnalytics.value = analytics
      
      // Set up real-time analytics subscription
      if (analyticsSubscription) {
        analyticsSubscription()
      }
      
      analyticsSubscription = marketAnalyticsService.subscribeToTokenAnalytics(
        mintAddress,
        (updatedAnalytics) => {
          tokenAnalytics.value = updatedAnalytics
        }
      )
      
    } catch (analyticsError) {
      console.warn('Failed to load token analytics:', analyticsError)
      // Continue without analytics - not critical
    }
    
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

onUnmounted(() => {
  // Clean up analytics subscription
  analyticsSubscription?.()
})
</script> 