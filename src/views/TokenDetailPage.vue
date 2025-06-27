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

        <!-- Token Header - Pump.fun Style -->
        <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-8">
          <div class="flex items-center gap-3 text-sm flex-wrap">
            <!-- Token Logo (small, inline with text) -->
            <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img 
                v-if="token?.image_url" 
                :src="token.image_url" 
                :alt="tokenName"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                {{ tokenSymbol.slice(0, 1) }}
              </div>
            </div>

            <!-- Token Name & Symbol -->
            <span class="font-medium text-gray-900 dark:text-white">
              {{ tokenName }} ({{ tokenSymbol }})
            </span>

            <span class="text-gray-400">|</span>

            <!-- Creator with link -->
            <router-link 
              v-if="token?.creator" 
              :to="`/profile/${token.creator.wallet_address}`"
              class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              {{ token.creator.username || formatWalletAddress(token.creator.wallet_address) }}
            </router-link>
            <span v-else class="text-gray-500">Unknown Creator</span>

            <span class="text-gray-400">|</span>

            <!-- Time ago -->
            <span class="text-gray-600 dark:text-gray-400">
              {{ formatTimeAgo(token?.created_at) }}
            </span>

            <span class="text-gray-400">|</span>

            <!-- Market Cap -->
            <span class="text-gray-900 dark:text-white">
              <span class="text-gray-600 dark:text-gray-400">market cap:</span>
              <span class="font-semibold ml-1">${{ formatMarketCap((token?.market_cap || 0) / 1e9) }}</span>
            </span>

            <span class="text-gray-400">|</span>

            <!-- Replies Count -->
            <span class="text-gray-900 dark:text-white">
              <span class="text-gray-600 dark:text-gray-400">replies:</span>
              <span class="font-semibold ml-1">{{ commentsCount }}</span>
            </span>
          </div>
        </div>

        <div v-if="!error" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column: Chart & Comments (2/3 width) -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Price Chart -->
            <TradingViewChart 
              v-if="token?.id" 
              :token-id="token.id"
              :token-symbol="token.symbol"
              :mint-address="token.mint_address"
            />

            <!-- Comments Section -->
            <TokenComments
              v-if="token?.id"
              :token-id="token.id"
              :token-creator="token.creator?.wallet_address"
              @connect-wallet="connectWallet"
            />
          </div>

          <!-- Right Sidebar: Trading & Token Info (1/3 width) -->
          <div class="space-y-4">
            <!-- Trading Interface - Pump.fun Style -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <!-- Buy/Sell Toggle -->
              <div class="grid grid-cols-2 gap-1 mb-4">
                <button 
                  :class="[
                    'py-2 px-4 text-sm font-medium rounded-lg transition-colors',
                    tradeType === 'buy' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                  @click="tradeType = 'buy'"
                >
                  buy
                </button>
                <button 
                  :class="[
                    'py-2 px-4 text-sm font-medium rounded-lg transition-colors',
                    tradeType === 'sell' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  ]"
                  @click="tradeType = 'sell'"
                >
                  sell
                </button>
              </div>

              <!-- Switch to Token -->
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                switch to {{ tokenSymbol }}
              </div>

              <!-- Slippage Setting -->
              <button class="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4">
                set max slippage
              </button>

              <!-- Balance -->
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">balance:</div>
              <div class="text-sm font-medium text-gray-900 dark:text-white mb-4">
                {{ walletStore.isConnected ? '0.0000 SOL' : 'Connect wallet' }}
              </div>

              <!-- Amount Input -->
              <div class="mb-4">
                <div class="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                  <input
                    v-model="tradeAmount"
                    type="number"
                    placeholder="0.00"
                    class="flex-1 px-3 py-2 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                    step="0.001"
                    min="0"
                  />
                  <span class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600">
                    SOL
                  </span>
                </div>
              </div>

              <!-- Quick Amount Buttons -->
              <div class="grid grid-cols-4 gap-2 mb-4">
                <button 
                  v-for="amount in ['0.1', '0.5', '1', 'max']" 
                  :key="amount"
                  @click="setQuickAmount(amount)"
                  class="py-2 px-2 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {{ amount }} {{ amount !== 'max' ? 'SOL' : '' }}
                </button>
              </div>

              <!-- Reset Button -->
              <button class="w-full py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
                reset
              </button>

              <!-- Place Trade Button -->
              <button 
                @click="executeTrade"
                :disabled="!canTrade"
                :class="[
                  'w-full py-3 px-4 font-medium rounded-lg transition-colors',
                  tradeType === 'buy' 
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white',
                  !canTrade ? 'opacity-50 cursor-not-allowed' : ''
                ]"
              >
                place trade
              </button>
            </div>

            <!-- Token Info Card -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <!-- Token Logo & Name -->
              <div class="flex items-center gap-3 mb-4">
                <div class="w-8 h-8 rounded-full overflow-hidden">
                  <img 
                    v-if="token?.image_url" 
                    :src="token.image_url" 
                    :alt="tokenName"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                    {{ tokenSymbol.slice(0, 1) }}
                  </div>
                </div>
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ tokenName.toLowerCase() }} ({{ tokenSymbol }})
                </span>
              </div>

              <!-- Bonding Curve Progress -->
              <div class="mb-4">
                <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  bonding curve progress: {{ progressPercentage.toFixed(0) }}%
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="h-full bg-green-500 rounded-full transition-all duration-500"
                    :style="{ width: `${progressPercentage}%` }"
                  ></div>
                </div>
              </div>

              <!-- Graduation Status -->
              <div v-if="progressPercentage >= 100" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div class="flex items-center gap-2 text-sm">
                  <span class="text-blue-600 dark:text-blue-400">🎉</span>
                  <span class="text-blue-800 dark:text-blue-200">PumpSwap pool seeded! view on PumpSwap</span>
                  <a href="#" class="text-blue-600 dark:text-blue-400 hover:underline">here</a>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="space-y-2">
                <button class="w-full py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  add to watchlist
                </button>
                <button class="w-full py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                  twitter
                </button>
              </div>
            </div>

            <!-- Contract Address -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">contract address:</div>
              <div class="flex items-center gap-2">
                <code class="text-xs font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                  {{ formatContractAddress(token?.mint_address || '') }}
                </code>
                <button 
                  @click="copyToClipboard(token?.mint_address || '')"
                  class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  copy
                </button>
              </div>
            </div>

            <!-- External Trading -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <button class="w-full py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors flex items-center justify-center gap-2">
                <span>📊</span>
                trade on MEXC
              </button>
            </div>

            <!-- Top Holders -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div class="flex items-center justify-between mb-4">
                <span class="text-sm font-medium text-gray-900 dark:text-white">top holders</span>
                <button class="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  generate bubble map
                </button>
              </div>
              
              <div class="space-y-2">
                <div 
                  v-for="(holder, index) in topHolders" 
                  :key="holder.address"
                  class="flex items-center justify-between text-sm"
                >
                  <div class="flex items-center gap-2">
                    <span class="text-gray-500 dark:text-gray-400">{{ index + 1 }}.</span>
                    <code class="text-xs font-mono text-gray-900 dark:text-white">{{ holder.address }}</code>
                  </div>
                  <span class="text-gray-600 dark:text-gray-400">{{ holder.percentage }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
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
import TradingViewChart from '@/components/charts/TradingViewChart.vue'
import EnhancedTradingInterface from '@/components/token/EnhancedTradingInterface.vue'
import BondingCurveProgress from '@/components/token/BondingCurveProgress.vue'
import { BondingCurveService } from '@/services/bondingCurve'

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
const topHolders = ref<any[]>([])

// Market analytics data
const tokenAnalytics = ref<TokenAnalytics | null>(null)
let analyticsSubscription: (() => void) | null = null

// Bonding curve state and progress
const bondingCurveState = ref<any>(null)
const bondingProgress = ref<any>(null)

// Computed properties for display
const tokenName = computed(() => token.value?.name || 'Unknown Token')
const tokenSymbol = computed(() => token.value?.symbol || 'N/A')
const tokenDescription = computed(() => token.value?.description || 'No description available.')

// Computed properties
const marketCapFormatted = computed(() => {
  if (!token.value?.market_cap) return '$0'
  const marketCapInSOL = (token.value.market_cap || 0) / 1e9 // Convert from lamports to SOL
  return `$${formatNumber(marketCapInSOL)}`
})

const progressPercentage = computed(() => {
  const marketCapInSOL = (token.value?.market_cap || 0) / 1e9 // Convert from lamports to SOL
  const graduationThreshold = 69000 // $69K
  return Math.min(100, (marketCapInSOL / graduationThreshold) * 100)
})

// Computed for comments count from token data
const commentsCount = computed(() => {
  // This would typically come from the token's comments relation
  // For now, we'll use a placeholder or fetch separately
  return token.value?.comments_count || 0
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

// Computed for trading validation
const canTrade = computed(() => {
  if (!walletStore.isConnected) return false
  if (!tradeAmount.value || parseFloat(tradeAmount.value) <= 0) return false
  return true
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
        title: 'Buy Order Successful! 🎉',
        message: `Successfully bought ${tokenSymbol.value} tokens (Simulation Mode)`
      })
    } else {
      // Execute sell transaction
      signature = await solanaProgram.sellTokens(mintAddress, amount)
      
      uiStore.showToast({
        type: 'success',
        title: 'Sell Order Successful! 💰',
        message: `Successfully sold ${tokenSymbol.value} tokens (Simulation Mode)`
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
 * Generate mock top holders data
 */
const generateMockHolders = () => {
  const mockAddresses = [
    '4LKAVY', 'EQBgro', '3uJLuZ', 'NW3NWn', '2K8PPq', 'GCBVFy', 'DS2VAo', 'Dp96KW',
    '35PhrV', '6qtArm', 'GbvbMa', 'EeuykU', '6rRT5V', 'CSeLLJ', 'DZZ7Wy', 'GkULz5',
    'J4r3df', '4u3cUs', 'AeNeGw', '3ApRom'
  ]
  
  const mockPercentages = [
    4.85, 2.14, 2.11, 1.98, 1.92, 1.19, 1.13, 1.08, 1.01, 0.96,
    0.88, 0.85, 0.82, 0.81, 0.80, 0.75, 0.73, 0.72, 0.70, 0.69
  ]
  
  return mockAddresses.map((address, index) => ({
    address,
    percentage: mockPercentages[index]
  }))
}

/**
 * Load token data from Supabase
 */
const loadTokenData = async () => {
  try {
    const mintAddress = route.params.mintAddress as string
    
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
    
    // Load comments count for display in header
    try {
      const commentsData = await SupabaseService.getTokenComments(tokenData.id, 1, 1)
      token.value.comments_count = commentsData.total || 0
    } catch (error) {
      console.warn('Failed to load comments count:', error)
      token.value.comments_count = 0
    }
    
    // Generate mock top holders data (would come from blockchain in real implementation)
    topHolders.value = generateMockHolders()
    
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

/**
 * Format wallet address for display
 */
const formatWalletAddress = (address: string): string => {
  if (!address) return 'Unknown'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Format market cap with proper formatting
 */
const formatMarketCap = (marketCap: number): string => {
  if (marketCap >= 1000000) {
    return (marketCap / 1000000).toFixed(2) + 'M'
  } else if (marketCap >= 1000) {
    return (marketCap / 1000).toFixed(0) + 'K'
  }
  return marketCap.toLocaleString()
}

/**
 * Set quick amount for trading
 */
const setQuickAmount = (amount: string) => {
  if (amount === 'max') {
    // TODO: Set to maximum available balance
    tradeAmount.value = '1.0'
  } else {
    tradeAmount.value = amount
  }
}

/**
 * Format contract address for display
 */
const formatContractAddress = (address: string): string => {
  if (!address) return 'N/A'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Copy text to clipboard
 */
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    uiStore.showToast({
      type: 'success',
      title: 'Copied!',
      message: 'Address copied to clipboard'
    })
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Copy Failed',
      message: 'Failed to copy address'
    })
  }
}

const handleTradeExecuted = (result: any) => {
  console.log('Trade executed:', result)
  // Refresh token data and bonding curve state
  loadTokenData()
}

const loadBondingCurveData = async () => {
  if (!token.value) return
  
  try {
    // Create bonding curve state (mock for now - would come from blockchain)
    bondingCurveState.value = BondingCurveService.createInitialState(token.value.mint_address)
    
    // Load bonding curve progress
    bondingProgress.value = await SupabaseService.getBondingCurveProgress(token.value.id)
  } catch (error) {
    console.error('Failed to load bonding curve data:', error)
  }
}

onMounted(() => {
  loadTokenData()
})

onUnmounted(() => {
  // Clean up analytics subscription
  analyticsSubscription?.()
})

// Load bonding curve data after token loads
watch(() => token.value, () => {
  if (token.value) {
    loadBondingCurveData()
  }
})
</script> 