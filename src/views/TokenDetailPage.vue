<template>
  <!-- Token Detail Page -->
  <div class="min-h-screen bg-binance-dark">
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
          <h2 class="text-2xl font-semibold text-white mb-2">{{ error }}</h2>
          <router-link to="/" class="btn-primary">{{ $t('common.back') }}</router-link>
        </div>

        <!-- Token Header - Binance Style -->
        <div v-else class="bg-binance-card rounded-xl shadow-sm border border-binance-border p-4 mb-8">
          <div class="flex items-center gap-3 text-sm flex-wrap">
            <!-- Token Logo (small, inline with text) -->
            <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
              <img 
                v-if="token?.image_url" 
                :src="token.image_url" 
                :alt="tokenName"
                class="w-full h-full object-cover"
                @load="() => console.log('✅ [TOKEN DETAIL] Small logo loaded successfully:', token.image_url)"
                @error="(e: Event) => console.error('❌ [TOKEN DETAIL] Small logo failed to load:', token.image_url, e)"
              />
              <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                {{ tokenSymbol.slice(0, 1) }}
              </div>
            </div>

            <!-- Token Name & Symbol -->
            <span class="font-medium text-white">
              {{ tokenName }} ({{ tokenSymbol }})
            </span>

            <span class="text-binance-gray">|</span>

            <!-- Creator with link -->
            <router-link 
              v-if="token?.creator" 
              :to="`/profile/${token.creator.wallet_address}`"
              class="text-binance-blue hover:text-blue-300 font-medium transition-colors"
            >
              {{ token.creator.username || formatWalletAddress(token.creator.wallet_address) }}
            </router-link>
            <span v-else class="text-binance-gray">Unknown Creator</span>

            <span class="text-binance-gray">|</span>

            <!-- Time ago -->
            <span class="text-binance-gray">
              {{ formatTimeAgo(token?.created_at) }}
            </span>

            <span class="text-binance-gray">|</span>

            <!-- Market Cap -->
            <span class="text-white">
              <span class="text-binance-gray">market cap:</span>
              <span class="font-semibold ml-1">{{ formattedMarketCap }}</span>
            </span>

            <span class="text-binance-gray">|</span>

            <!-- Replies Count -->
            <span class="text-white">
              <span class="text-binance-gray">replies:</span>
              <span class="font-semibold ml-1">{{ commentsCount }}</span>
            </span>
          </div>
        </div>

        <div v-if="!error" class="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-8 gap-4">
          <!-- Left Column: Chart & Comments (2/3 width) -->
          <div class="lg:col-span-2 space-y-6 md:space-y-6 space-y-4">
            <!-- Price Chart -->
            <ErrorBoundary 
              title="Chart Loading Error" 
              message="The price chart couldn't load properly."
              show-reload
            >
              <TradingViewChart 
                v-if="token?.id" 
                :token-id="token.id"
                :token-symbol="token.symbol"
                :mint-address="token.mint_address"
                class="mobile-chart"
              />
            </ErrorBoundary>

            <!-- Mobile Trading Interface - Show under chart on mobile only -->
            <div class="lg:hidden mobile-trading-section">
              <ErrorBoundary 
                title="Trading Interface Error" 
                message="The trading interface couldn't load properly."
              >
                <TradingInterface
                  :token-symbol="tokenSymbol"
                  :bonding-curve-state="bondingCurveState"
                  :wallet-balance="walletStore.balance"
                  :token-balance="userTokenBalance"
                  @trade="handleTrade"
                  @connect-wallet="connectWallet"
                />
              </ErrorBoundary>
            </div>

            <!-- Comments Section -->
            <ErrorBoundary 
              title="Comments Loading Error" 
              message="The comments section couldn't load properly."
            >
              <TokenComments
                v-if="token?.id"
                :token-id="token.id"
                :token-creator="token.creator?.wallet_address"
                @connect-wallet="connectWallet"
                class="mobile-comments"
              />
            </ErrorBoundary>
          </div>

          <!-- Right Sidebar: Trading & Token Info (1/3 width) - Desktop Only -->
          <div class="hidden lg:block space-y-4 mobile-sidebar">
            <!-- Trading Interface -->
            <ErrorBoundary 
              title="Trading Interface Error" 
              message="The trading interface couldn't load properly."
            >
              <TradingInterface
                :token-symbol="tokenSymbol"
                :bonding-curve-state="bondingCurveState"
                :wallet-balance="walletStore.balance"
                :token-balance="userTokenBalance"
                @trade="handleTrade"
                @connect-wallet="connectWallet"
              />
            </ErrorBoundary>

            <!-- Token Info Card -->
            <div class="bg-binance-card rounded-xl border border-binance-border p-6 md:p-4 mobile-info-card">
              <h3 class="text-lg md:text-base font-semibold text-white mb-4">Token Info</h3>
              <div class="space-y-3 md:space-y-2 text-base md:text-sm">
                                 <div class="flex justify-between">
                   <span class="text-binance-gray">Price:</span>
                   <span class="font-medium text-white">${{ currentPrice?.toFixed(8) || '0.00000000' }}</span>
                 </div>
                <div class="flex justify-between">
                  <span class="text-binance-gray">Market Cap:</span>
                  <span class="font-medium text-white">{{ formattedMarketCap }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-binance-gray">Holders:</span>
                  <span class="font-medium text-white">{{ token?.holder_count || 0 }}</span>
                </div>
                <div v-if="token?.website" class="flex justify-between">
                  <span class="text-binance-gray">Website:</span>
                  <a 
                    :href="token.website" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="text-binance-blue hover:underline"
                  >
                    Visit
                  </a>
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
import { ref, onMounted, onUnmounted, computed, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PublicKey } from '@solana/web3.js'
import { SupabaseService } from '@/services/supabase'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { solanaProgram } from '@/services/solanaProgram'
import { marketAnalyticsService, type TokenAnalytics } from '@/services/marketAnalytics'
import TokenComments from '@/components/token/TokenComments.vue'
import TradingViewChart from '@/components/charts/TradingViewChart.vue'
import TradingInterface from '@/components/token/TradingInterface.vue'
import ErrorBoundary from '@/components/common/ErrorBoundary.vue'
import { BondingCurveService } from '@/services/bondingCurve'
import { RealTimePriceService, type RealPriceData } from '@/services/realTimePriceService'

const route = useRoute()
const router = useRouter()
const walletStore = useWalletStore()
const uiStore = useUIStore()
const authStore = useAuthStore()

// State
const loading = ref(true)
const error = ref('')

// Real token data from Supabase
const token = ref<any>(null)
const recentTrades = ref<any[]>([])
const topHolders = ref<any[]>([])

// Market analytics data
const tokenAnalytics = ref<TokenAnalytics | null>(null)
let analyticsSubscription: (() => void) | null = null

// Real-time bonding curve state
const bondingCurveState = ref<any>(null)
const bondingProgress = ref<any>(null)
const lastPriceUpdate = ref<Date>(new Date())
const priceUnsubscribe = ref<(() => void) | null>(null)

// Watchlist state
const isInWatchlist = ref(false)
const watchlistLoading = ref(false)

// User token balance (for trading)
const userTokenBalance = ref(0)

// Computed properties for display
const tokenName = computed(() => token.value?.name || 'Unknown Token')
const tokenSymbol = computed(() => token.value?.symbol || 'N/A')
const tokenDescription = computed(() => token.value?.description || 'No description available.')

// Computed properties
const formattedMarketCap = computed(() => {
  // Use bonding curve state market cap if available, otherwise fall back to token data
  const marketCap = bondingCurveState.value?.marketCap || token.value?.market_cap || 0
  return `$${formatNumber(marketCap)}`
})

const progressPercentage = computed(() => {
  if (!bondingProgress.value) return 0
  return Math.min(100, bondingProgress.value.progress || 0)
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



/**
 * Connect wallet handler
 */
const connectWallet = async () => {
  try {
    // Open wallet modal using the correct UI store method
    uiStore.showModal('wallet')
    
    // Set up listener for successful wallet connection
    const unwatch = watchEffect(() => {
      if (walletStore.isConnected && walletStore.walletAddress) {
        // Authenticate user with Supabase when wallet connects
        authenticateUserWithWallet()
        unwatch() // Remove watcher after first execution
      }
    })
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
 * Simple authentication for trading (mobile-friendly)
 */
const authenticateForTrading = async () => {
  if (!walletStore.walletAddress) {
    throw new Error('Wallet not connected')
  }

  try {
    console.log('🔐 [AUTH] Starting simple authentication for trading...')
    console.log('🔍 [AUTH] Wallet address:', walletStore.walletAddress)
    
    // Use the simpler SupabaseAuth.signInWithWallet method directly
    // This bypasses the complex crypto challenge flow which can fail on mobile
    const { SupabaseAuth } = await import('@/services/supabase')
    console.log('🔍 [AUTH] Calling SupabaseAuth.signInWithWallet...')
    const result = await SupabaseAuth.signInWithWallet(walletStore.walletAddress)
    console.log('🔍 [AUTH] SupabaseAuth result:', {
      hasUser: !!result.user,
      hasSession: !!result.session,
      userId: result.user?.id
    })
    
    // Ensure user record exists after successful authentication
    if (result.session?.user?.id) {
      try {
        const { supabase } = await import('@/services/supabase')
        console.log('🔍 [AUTH] Ensuring user record exists...')
        
        const { data: ensuredUserId, error: ensureError } = await supabase
          .rpc('get_or_create_user_by_wallet', {
            wallet_address: walletStore.walletAddress
          })
        
        if (ensureError) {
          console.warn('⚠️ [AUTH] Failed to ensure user exists via RPC, trying direct method...')
          
          // Fallback method
          const { error: createError } = await supabase
            .from('users')
            .upsert({
              id: result.session.user.id,
              wallet_address: walletStore.walletAddress,
              username: `user_${walletStore.walletAddress.slice(0, 8)}`
            })
          
          if (createError) {
            console.warn('⚠️ [AUTH] User record creation failed:', createError)
          } else {
            console.log('✅ [AUTH] User record created via fallback method')
          }
        } else {
          console.log('✅ [AUTH] User record ensured via RPC:', ensuredUserId)
        }
      } catch (userCreationError) {
        console.warn('⚠️ [AUTH] User record creation failed, trading may not work:', userCreationError)
      }
    }
    
    if (result.user && result.session) {
      // Update auth store state manually
      authStore.user = result.user
      authStore.isAuthenticated = true
      authStore.supabaseUser = result.user
      authStore.supabaseSession = result.session
      
      console.log('✅ [AUTH] Simple authentication successful')
      console.log('🔍 [AUTH] Session details:', {
        sessionUserId: result.session?.user?.id,
        userRecordId: result.user?.id,
        walletAddress: walletStore.walletAddress,
        idsMatch: result.session?.user?.id === result.user?.id
      })
      
      // Verify the session is valid for database operations
      try {
        const { SupabaseAuth } = await import('@/services/supabase')
        const sessionCheck = await SupabaseAuth.getSession()
        console.log('🔍 [AUTH] Current session check:', {
          hasSession: !!sessionCheck,
          sessionUserId: sessionCheck?.user?.id,
          isAuthenticated: !!sessionCheck?.user
        })
      } catch (sessionError) {
        console.warn('⚠️ [AUTH] Session verification failed:', sessionError)
      }
      
      // Load user token balance after authentication
      await loadUserTokenBalance()
      
      return result
    } else {
      throw new Error('Authentication failed - no user data returned')
    }
    
  } catch (error: any) {
    console.error('❌ [AUTH] Simple authentication failed:', error)
    
    // If simple auth fails, try the full crypto challenge method as fallback
    try {
      console.log('🔄 [AUTH] Falling back to secure authentication...')
      await authStore.signInWithWallet(walletStore.walletAddress)
      await loadUserTokenBalance()
      console.log('✅ [AUTH] Fallback authentication successful')
    } catch (fallbackError: any) {
      console.error('❌ [AUTH] Both authentication methods failed:', fallbackError)
      throw new Error(`Authentication failed: ${fallbackError.message || 'Unknown error'}`)
    }
  }
}

/**
 * Authenticate user with wallet for trading and commenting
 */
const authenticateUserWithWallet = async () => {
  try {
    if (!walletStore.walletAddress) return
    
    // Check if already authenticated with the same wallet
    if (authStore.isAuthenticated && 
        authStore.user?.wallet_address === walletStore.walletAddress) {
      console.log('✅ User already authenticated')
      return
    }
    
    console.log('🔐 Authenticating user with Supabase...')
    
    // Use the simple authentication method for better mobile compatibility
    await authenticateForTrading()
    
    console.log('✅ User authenticated for trading and commenting')
    
  } catch (error) {
    console.error('❌ Failed to authenticate user:', error)
    // Show info message about authentication being optional for viewing
    uiStore.showToast({
      type: 'info',
      title: 'Authentication Optional',
      message: 'You can view token info without authentication. Authentication is required for trading and commenting.'
    })
  }
}

/**
 * Handle trade from TradingInterface component
 */
const handleTrade = async (tradeData: { type: 'buy' | 'sell', amount: number, preview: any }) => {
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

  // Check if user is authenticated with Supabase (required for trading)
  if (!authStore.isAuthenticated || !authStore.supabaseUser) {
    try {
      console.log('🔐 [TRADE] User not authenticated, starting authentication process...')
      console.log('🔍 [TRADE] Auth state:', {
        isAuthenticated: authStore.isAuthenticated,
        hasSupabaseUser: !!authStore.supabaseUser,
        walletAddress: walletStore.walletAddress
      })
      
      uiStore.showToast({
        type: 'info',
        title: 'Setting up trading...',
        message: 'Preparing your wallet for trading...'
      })
      
      // Try the simple authentication method first (better for mobile)
      await authenticateForTrading()
      
      uiStore.showToast({
        type: 'success',
        title: 'Ready to Trade!',
        message: 'Your wallet is now set up for trading.'
      })
    } catch (authError: any) {
      console.error('❌ Failed to authenticate for trading:', authError)
      uiStore.showToast({
        type: 'error',
        title: 'Setup Failed',
        message: authError.message || 'Failed to set up trading. Please try again.'
      })
      return
    }
  }

  // Check if token has graduated
  if (bondingCurveState.value?.isGraduated) {
    uiStore.showToast({
      type: 'error',
      title: 'Token Graduated',
      message: 'This token has graduated to DEX. Trade on PumpSwap instead.'
    })
    return
  }

  try {
    uiStore.setLoading(true)
    
    // Make sure balance is fresh before trade
    await walletStore.updateBalance()

    const mintAddress = new PublicKey(token.value.mint_address)
    const { type, amount, preview } = tradeData

    // Check if price impact is too high (>10%)
    if (preview && Math.abs(preview.priceImpact) > 10) {
      const confirmed = confirm(
        `Warning: High price impact of ${preview.priceImpact.toFixed(2)}%. Continue?`
      )
      if (!confirmed) {
        uiStore.setLoading(false)
        return
      }
    }

    let signature: string

    if (type === 'buy') {
      // Execute buy transaction
      signature = await solanaProgram.buyTokens(mintAddress, amount)
      
      uiStore.showToast({
        type: 'success',
        title: 'Buy Order Successful! 🎉',
        message: `Bought ${preview?.tokensReceived?.toFixed(6) || 'tokens'} ${tokenSymbol.value} for ${amount} SOL`
      })
    } else {
      // Execute sell transaction
      signature = await solanaProgram.sellTokens(mintAddress, amount)
      
      uiStore.showToast({
        type: 'success',
        title: 'Sell Order Successful! 💰',
        message: `Sold ${amount} ${tokenSymbol.value} for ${Math.abs(preview?.solSpent || 0).toFixed(6)} SOL`
      })
    }

    // Trigger immediate price update
    await RealTimePriceService.forceUpdate(token.value.id)
    
    // Refresh bonding curve data immediately after trade
    await loadBondingCurveData()

    // Refresh chart data
    if (token.value?.id) {
      RealTimePriceService.clearCacheForToken(token.value.id)
    }
    
    // Refresh token data to show updated stats
    await loadTokenData()
    
    // Update user token balance
    await loadUserTokenBalance()
    
    // 💰 CRITICAL: Refresh wallet SOL balance after transaction
    await walletStore.updateBalance()
    console.log('💰 Wallet balance refreshed after trade')
    
    console.log(`✅ ${type} transaction completed:`, signature)
    
  } catch (error: any) {
    console.error('❌ [TRADE] Trade failed:', error)
    console.error('❌ [TRADE] Error details:', {
      code: error.code,
      message: error.message,
      status: error.status,
      details: error.details
    })
    
    let errorMessage = 'An unexpected error occurred during the trade'
    let errorTitle = 'Trade Failed'
    
    // Handle specific error types
    if (error.code === '42501' || error.message.includes('row-level security')) {
      errorTitle = 'Database Permission Error'
      errorMessage = 'Your wallet session has expired. Please refresh the page and try again.'
      console.log('🔄 [TRADE] RLS error detected - clearing auth state')
      // Clear auth state to force fresh authentication
      await authStore.signOut()
    } else if (error.message.includes('Insufficient')) {
      errorMessage = error.message
    } else if (error.message.includes('Slippage')) {
      errorMessage = 'Price moved too much during trade. Try again with higher slippage tolerance.'
    } else if (error.message.includes('graduated')) {
      errorMessage = 'This token has graduated to DEX trading.'
    } else if (error.message.includes('Forbidden') || error.status === 403) {
      errorTitle = 'Permission Denied'
      errorMessage = 'Database access denied. Please refresh the page and reconnect your wallet.'
      console.log('🔄 [TRADE] 403 error detected - clearing auth state')
      await authStore.signOut()
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorTitle = 'Network Error'
      errorMessage = 'Failed to connect to the trading service. Please check your internet connection and try again.'
    }
    
    uiStore.showToast({
      type: 'error',
      title: errorTitle,
      message: errorMessage
    })
    
  } finally {
    uiStore.setLoading(false)
  }
}

/**
 * Load real top holders data from database
 */
const loadTopHolders = async () => {
  if (!token.value?.id) {
    console.warn('No token ID available for loading top holders')
    return
  }

  try {
    console.log('🔄 Loading top holders for token:', token.value.id)
    const holders = await SupabaseService.getTokenTopHolders(token.value.id, 20)
    
    if (holders.length > 0) {
      topHolders.value = holders
      console.log('✅ Loaded top holders:', holders.length)
    } else {
      // Show empty state if no holders found
      topHolders.value = []
      console.log('ℹ️ No holders found for this token')
    }
  } catch (error) {
    console.error('❌ Failed to load top holders:', error)
    // Keep empty array on error
    topHolders.value = []
  }
}

/**
 * Load user's token balance for trading
 */
const loadUserTokenBalance = async () => {
  if (!walletStore.isConnected || !token.value?.mint_address) {
    userTokenBalance.value = 0
    return
  }

  // Skip loading if user is not authenticated with Supabase
  if (!authStore.isAuthenticated || !authStore.supabaseUser) {
    console.log('📊 Skipping token balance loading - user not authenticated with Supabase')
    userTokenBalance.value = 0
    return
  }

  try {
    // TODO: Implement actual token balance loading from blockchain
    // For now, try to get user holdings from database as a starting point
    try {
      const holdings = await SupabaseService.getUserHoldings(authStore.supabaseUser.id)
      const tokenHolding = holdings.find(h => h.token_id === token.value?.id)
      userTokenBalance.value = tokenHolding?.balance || 0
      console.log('📊 User token balance loaded from database:', userTokenBalance.value)
    } catch (dbError) {
      console.warn('Failed to load balance from database, using 0:', dbError)
      userTokenBalance.value = 0
    }
  } catch (error) {
    console.error('❌ Failed to load user token balance:', error)
    userTokenBalance.value = 0
  }
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
    
    // Debug: Log token data to see what image_url we got
    console.log('🔍 [TOKEN DETAIL] Token data loaded:', {
      id: tokenData.id,
      name: tokenData.name,
      symbol: tokenData.symbol,
      mint_address: tokenData.mint_address,
      image_url: tokenData.image_url,
      metadata_uri: tokenData.metadata_uri
    })
    
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
    
    // Load real top holders data from database
    await loadTopHolders()
    
    // Load user token balance for trading
    await loadUserTokenBalance()
    
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
  // Refresh token data, bonding curve state, and top holders
  loadTokenData()
  // Also refresh top holders since holdings may have changed
  loadTopHolders()
  // Refresh user token balance
  loadUserTokenBalance()
}

const loadBondingCurveData = async () => {
  if (!token.value) return
  
  try {
    console.log('🔄 Loading bonding curve data for token:', token.value.id)
    
    // Load real bonding curve state using the service
    const curveState = await BondingCurveService.getTokenBondingCurveState(token.value.id)
    bondingCurveState.value = curveState
    
    // Load progress data
    bondingProgress.value = await SupabaseService.getBondingCurveProgress(token.value.id)
    
    // Update last price update time
    lastPriceUpdate.value = new Date()
    
    console.log('✅ Bonding curve data loaded:', {
      price: curveState.currentPrice,
      progress: curveState.progress,
      marketCap: curveState.marketCap,
      graduated: curveState.isGraduated
    })
    
    // Set up real-time price updates every 10 seconds
    if (priceUnsubscribe.value) {
      priceUnsubscribe.value()
    }
    
    priceUnsubscribe.value = RealTimePriceService.subscribe(
      token.value.id,
      (updatedPrice: RealPriceData) => {
        bondingCurveState.value = {
          ...bondingCurveState.value,
          currentPrice: updatedPrice.price,
          marketCap: updatedPrice.marketCap
        }
        bondingProgress.value = {
          ...bondingProgress.value,
          progress: updatedPrice.progress
        }
        lastPriceUpdate.value = new Date()
        console.log('🔄 Price updated:', {
          price: updatedPrice.price,
          progress: updatedPrice.progress
        })
      }
    )
    
  } catch (error) {
    console.error('Failed to load bonding curve data:', error)
    
    // Fallback to basic progress calculation
    bondingProgress.value = await SupabaseService.getBondingCurveProgress(token.value.id)
  }
}

/**
 * Force chart to reload data
 */
const refreshChart = () => {
  if (!token.value?.id) return
  // Clear cache and force re-fetch
  RealTimePriceService.clearCacheForToken(token.value.id)
  
  // Find chart component and call its reload method
  // This is a bit of a hack, a better way would be to use an event bus
  // or a shared state management solution for this.
  const chart = document.querySelector('.tradingview-chart-container')
  if (chart && (chart as any).__vue_app__) {
    const chartInstance = (chart as any).__vue_app__.config.globalProperties.$parent
    if (chartInstance && typeof chartInstance.setTimeframe === 'function') {
      chartInstance.setTimeframe(chartInstance.selectedTimeframe)
    }
  }
}



/**
 * Computed property for real-time price display
 */
const currentPrice = computed(() => {
  if (bondingCurveState.value?.currentPrice) {
    return Number(bondingCurveState.value.currentPrice)
  }
  return Number(token.value?.current_price) || 0
})



/**
 * Check if token is in user's watchlist
 */
const checkWatchlistStatus = async () => {
  if (!authStore.isAuthenticated || !authStore.supabaseUser?.id || !token.value?.id) {
    isInWatchlist.value = false
    return
  }

  try {
    isInWatchlist.value = await SupabaseService.isTokenInWatchlist(
      authStore.supabaseUser.id,
      token.value.id
    )
  } catch (error) {
    console.error('Failed to check watchlist status:', error)
    isInWatchlist.value = false
  }
}

/**
 * Toggle token in/out of watchlist
 */
const toggleWatchlist = async () => {
  if (!authStore.isAuthenticated) {
    uiStore.showToast({
      type: 'error',
      title: 'Authentication Required',
      message: 'Please connect your wallet to use watchlist'
    })
    return
  }

  if (!authStore.supabaseUser?.id || !token.value?.id) {
    uiStore.showToast({
      type: 'error',
      title: 'Error',
      message: 'Unable to update watchlist at this time'
    })
    return
  }

  watchlistLoading.value = true

  try {
    if (isInWatchlist.value) {
      // Remove from watchlist
      await SupabaseService.removeFromWatchlist(authStore.supabaseUser.id, token.value.id)
      isInWatchlist.value = false
      
      uiStore.showToast({
        type: 'success',
        title: 'Removed from Watchlist',
        message: `${token.value.name} has been removed from your watchlist`
      })
    } else {
      // Add to watchlist
      await SupabaseService.addToWatchlist(authStore.supabaseUser.id, token.value.id)
      isInWatchlist.value = true
      
      uiStore.showToast({
        type: 'success',
        title: 'Added to Watchlist',
        message: `${token.value.name} has been added to your watchlist`
      })
    }
  } catch (error: any) {
    console.error('Failed to toggle watchlist:', error)
    
    let errorMessage = 'Failed to update watchlist'
    let errorTitle = 'Watchlist Error'
    
    if (error.message.includes('already in your watchlist')) {
      errorMessage = 'Token is already in your watchlist'
      isInWatchlist.value = true
    } else if (error.message.includes('not yet available') || error.message.includes('database migration')) {
      errorTitle = 'Feature Not Available'
      errorMessage = 'Watchlist feature requires database setup. Please run the SQL migration first.'
    }
    
    uiStore.showToast({
      type: 'error',
      title: errorTitle,
      message: errorMessage
    })
  } finally {
    watchlistLoading.value = false
  }
}

onMounted(async () => {
  console.log('🚀 [MOUNT] TokenDetailPage mounted')
  console.log('🔍 [MOUNT] Initial auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    hasSupabaseUser: !!authStore.supabaseUser,
    hasWalletAddress: !!walletStore.walletAddress,
    isWalletConnected: walletStore.isConnected
  })
  
  await loadTokenData()
  
  // Debug auth state after loading
  console.log('🔍 [MOUNT] Post-load auth state:', {
    isAuthenticated: authStore.isAuthenticated,
    hasSupabaseUser: !!authStore.supabaseUser,
    hasUser: !!authStore.user
  })
})

onUnmounted(() => {
  // Clean up analytics subscription
  analyticsSubscription?.()
  
  // Clean up price update interval
  if (priceUnsubscribe.value) {
    priceUnsubscribe.value()
    priceUnsubscribe.value = null
  }
})

// Load bonding curve data after token loads
watch(() => token.value, () => {
  if (token.value) {
    loadBondingCurveData()
    checkWatchlistStatus()
  }
})

// Check watchlist status when authentication changes
watch(() => authStore.isAuthenticated, () => {
  checkWatchlistStatus()
})

// Load user token balance when wallet connection changes
watch(() => walletStore.isConnected, () => {
  if (walletStore.isConnected) {
    loadUserTokenBalance()
  } else {
    userTokenBalance.value = 0
  }
})

// Component cleanup will be handled by Vue's lifecycle
</script>

<style scoped>
/* Mobile-specific optimizations */
@media (max-width: 768px) {
  /* Fix mobile content spacing to account for mobile create button */
  .container {
    @apply px-3 pt-4;
  }
  
  .mobile-chart {
    @apply rounded-lg;
    min-height: 300px;
  }
  
  .mobile-comments {
    @apply rounded-lg;
  }
  
  .mobile-trading-section {
    @apply order-none;
  }
  
  .mobile-trading-card {
    @apply shadow-lg;
    /* No sticky positioning needed since it's now in the flow */
  }
  
  .mobile-info-card {
    @apply mt-4;
  }
  
  /* Improve mobile grid layout */
  .grid {
    @apply gap-4;
  }
  
  /* Better mobile button interactions */
  button:active {
    @apply scale-95;
  }
  
  /* Improve mobile touch targets */
  button {
    @apply min-h-[44px];
  }
  
  /* Better mobile form elements */
  input[type="number"] {
    -webkit-appearance: none;
    -moz-appearance: textfield;
  }
  
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  /* Mobile-optimized header */
  .token-header {
    @apply flex-col space-y-2 space-x-0 text-center;
  }
  
  /* Mobile responsive header text */
  .token-header .flex {
    @apply flex-col space-y-2 space-x-0 text-center;
  }
  
  /* Better mobile text sizing */
  .token-header span {
    @apply text-sm;
  }
  
  /* Improve mobile touch interactions */
  .mobile-trading-card button {
    @apply min-h-[48px];
  }
  
  .mobile-trading-card input {
    @apply min-h-[48px];
  }
}

/* Desktop styles remain unchanged */
@media (min-width: 769px) {
  .mobile-trading-section {
    @apply hidden;
  }
  
  .mobile-trading-card {
    @apply static shadow-none z-10;
  }
}
</style> 