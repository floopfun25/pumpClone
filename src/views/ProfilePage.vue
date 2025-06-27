<template>
  <div class="min-h-screen bg-binance-dark">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center min-h-screen">
      <div class="flex flex-col items-center">
        <div class="spinner w-12 h-12 mb-4"></div>
        <p class="text-binance-gray">{{ t('common.loading') }}...</p>
      </div>
    </div>

    <!-- Profile Content -->
    <div v-else class="py-8">
      <div class="container mx-auto px-4 max-w-7xl">
        <!-- Error State -->
        <div v-if="error" class="text-center py-12">
          <div class="text-6xl mb-4">❌</div>
          <h2 class="text-2xl font-semibold text-white mb-2">{{ error }}</h2>
          <router-link to="/" class="btn-primary">{{ t('common.back') }}</router-link>
        </div>

        <!-- Profile Header -->
        <div v-else class="bg-trading-surface border border-binance-border rounded-xl p-6 mb-6">
          <div class="flex flex-col lg:flex-row items-start justify-between gap-6">
            <!-- Avatar and Basic Info -->
            <div class="flex items-center gap-4">
              <!-- Avatar -->
              <div class="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-binance-yellow to-primary-600 flex items-center justify-center text-binance-dark font-bold text-2xl relative">
                <img 
                  v-if="user?.avatar_url" 
                  :src="user.avatar_url" 
                  :alt="userName"
                  class="w-full h-full object-cover"
                  @error="handleAvatarError"
                />
                <span v-else>{{ avatarInitials }}</span>
                
                <!-- Online Status -->
                <div class="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-2 border-trading-surface rounded-full"></div>
              </div>
              
              <!-- User Info -->
              <div>
                <h1 class="text-3xl font-bold text-white mb-1">
                  {{ userName }}
                </h1>
                <p class="text-binance-gray mb-2 font-mono text-sm">
                  {{ formatWalletAddress(user?.wallet_address || '') }}
                </p>
                <div v-if="user?.verified" class="mb-2">
                  <span class="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                    ✓ {{ t('profile.verified') }}
                  </span>
                </div>
                <p v-if="user?.bio" class="text-gray-300 max-w-md">
                  {{ user.bio }}
                </p>
              </div>
            </div>
            


            <!-- Action Buttons -->
            <div class="flex-shrink-0">
              <button
                v-if="isOwnProfile"
                @click="showEditModal = true"
                class="flex items-center gap-2 px-4 py-2 bg-binance-yellow hover:bg-binance-yellow-dark text-binance-dark font-medium rounded-lg transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {{ t('profile.editProfile') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="bg-trading-surface border border-binance-border rounded-xl mb-6">
          <div class="flex border-b border-binance-border">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="activeTab = tab.id"
              class="flex items-center gap-2 px-6 py-4 font-medium transition-colors relative"
              :class="activeTab === tab.id 
                ? 'text-binance-yellow border-b-2 border-binance-yellow' 
                : 'text-binance-gray hover:text-white'"
            >
              <span v-html="tab.icon"></span>
              {{ tab.label }}
              <span v-if="tab.count !== undefined" class="px-2 py-1 bg-binance-border text-xs rounded-full">
                {{ tab.count }}
              </span>
            </button>
          </div>

          <!-- Tab Content -->
          <div class="p-6">
            <!-- Created Tokens Tab -->
            <div v-if="activeTab === 'tokens'">
              <div v-if="userTokens.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TokenCard
                  v-for="token in userTokens"
                  :key="token.id"
                  :token="token"
                  @click="navigateToToken(token.mint_address || token.id)"
                  class="hover:border-binance-yellow/50 transition-colors cursor-pointer"
                />
              </div>
              
              <div v-else class="text-center py-12">
                <div class="text-6xl mb-4">🎭</div>
                <h3 class="text-xl font-semibold text-white mb-2">{{ t('profile.noTokensCreated') }}</h3>
                <p class="text-binance-gray mb-4">{{ t('profile.noTokensCreatedDesc') }}</p>
                <router-link v-if="isOwnProfile" to="/create" class="btn-primary">
                  {{ t('navigation.create') }}
                </router-link>
              </div>
            </div>

            <!-- Watchlist Tab -->
            <div v-else-if="activeTab === 'watchlist'">
              <div v-if="userWatchlist.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="item in userWatchlist"
                  :key="item.id"
                  class="bg-trading-elevated rounded-lg border border-binance-border p-4 hover:border-binance-yellow/50 transition-colors cursor-pointer"
                  @click="navigateToToken(item.mint_address)"
                >
                  <!-- Token Header -->
                  <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full overflow-hidden">
                      <img 
                        v-if="item.image_url" 
                        :src="item.image_url" 
                        :alt="item.name"
                        class="w-full h-full object-cover"
                      />
                      <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                        {{ item.symbol?.slice(0, 1) }}
                      </div>
                    </div>
                    <div class="flex-1">
                      <div class="text-white font-medium">{{ item.name }}</div>
                      <div class="text-binance-gray text-sm">${{ item.symbol }}</div>
                    </div>
                    <button 
                      @click.stop="removeFromWatchlist(item.id)"
                      class="text-red-400 hover:text-red-300 transition-colors"
                      title="Remove from watchlist"
                    >
                      ❤️
                    </button>
                  </div>

                  <!-- Token Stats -->
                  <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-binance-gray">Price:</span>
                      <span class="text-white">${{ formatNumber(item.current_price || 0) }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-binance-gray">Market Cap:</span>
                      <span class="text-white">${{ formatNumber(item.market_cap || 0) }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-binance-gray">24h Volume:</span>
                      <span class="text-white">${{ formatNumber(item.volume_24h || 0) }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-binance-gray">Progress:</span>
                      <span class="text-binance-yellow">{{ (item.bonding_curve_progress || 0).toFixed(1) }}%</span>
                    </div>
                    <div class="text-xs text-binance-gray">
                      Added {{ formatDate(item.addedAt) }}
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="text-center py-12">
                <div class="text-6xl mb-4">🤍</div>
                <h3 class="text-xl font-semibold text-white mb-2">No Watchlist Items</h3>
                <p class="text-binance-gray mb-4">
                  {{ loading ? 'Loading watchlist...' : 'Add tokens to your watchlist to track them here' }}
                </p>
                <div v-if="!loading" class="space-y-3">
                  <router-link to="/search" class="btn-primary inline-block">
                    🔍 Explore Tokens
                  </router-link>
                  <div class="text-xs text-binance-gray">
                    Note: If you're getting errors, you may need to run the database migration for watchlist functionality.
                  </div>
                </div>
              </div>
            </div>

            <!-- Trading History Tab -->
            <div v-else-if="activeTab === 'history'">
              <div v-if="tradingHistory.length > 0" class="space-y-3">
                <div
                  v-for="trade in tradingHistory"
                  :key="trade.id"
                  class="flex items-center justify-between p-4 bg-trading-elevated rounded-lg border border-binance-border"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
                      {{ trade.token_symbol }}
                    </div>
                    <div>
                      <div class="text-white font-medium">{{ trade.token_name }}</div>
                      <div class="text-binance-gray text-sm">{{ formatDate(trade.created_at) }}</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-white font-medium">
                      {{ trade.type === 'buy' ? '+' : '-' }}{{ formatNumber(trade.token_amount) }} {{ trade.token_symbol }}
                    </div>
                    <div class="text-binance-gray text-sm">
                      {{ formatNumber(trade.sol_amount) }} SOL
                    </div>
                  </div>
                  <div class="flex items-center">
                    <span class="px-2 py-1 rounded-full text-xs font-medium" :class="
                      trade.type === 'buy' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    ">
                      {{ trade.type.toUpperCase() }}
                    </span>
                  </div>
                </div>
              </div>
              
              <div v-else class="text-center py-12">
                <div class="text-6xl mb-4">📈</div>
                <h3 class="text-xl font-semibold text-white mb-2">{{ t('profile.noTradingHistory') }}</h3>
                <p class="text-binance-gray">{{ t('profile.noTradingHistoryDesc') }}</p>
              </div>
            </div>

            <!-- Holdings Tab -->
            <div v-else-if="activeTab === 'holdings'">
              <div v-if="userHoldings.length > 0" class="space-y-3">
                <div
                  v-for="holding in userHoldings"
                  :key="holding.token_id"
                  class="flex items-center justify-between p-4 bg-trading-elevated rounded-lg border border-binance-border"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-medium">
                      {{ holding.token_symbol }}
                    </div>
                    <div>
                      <div class="text-white font-medium">{{ holding.token_name }}</div>
                      <div class="text-binance-gray text-sm">{{ formatNumber(holding.amount) }} tokens</div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-white font-medium">
                      ${{ formatNumber(holding.value_usd || 0) }}
                    </div>
                    <div class="text-binance-gray text-sm">
                      {{ formatNumber(holding.amount * (holding.token_price || 0)) }} SOL
                    </div>
                  </div>
                </div>
              </div>
              
              <div v-else class="text-center py-12">
                <div class="text-6xl mb-4">💰</div>
                <h3 class="text-xl font-semibold text-white mb-2">{{ t('profile.noHoldings') }}</h3>
                <p class="text-binance-gray">{{ t('profile.noHoldingsDesc') }}</p>
              </div>
            </div>

            <!-- Activity Tab -->
            <div v-else-if="activeTab === 'activity'">
              <div v-if="userActivity.length > 0" class="space-y-3">
                <div
                  v-for="activity in userActivity"
                  :key="activity.id"
                  class="flex items-start gap-3 p-4 bg-trading-elevated rounded-lg border border-binance-border"
                >
                  <div class="w-8 h-8 rounded-full bg-binance-yellow/20 flex items-center justify-center text-binance-yellow text-sm">
                    {{ getActivityIcon(activity.type) }}
                  </div>
                  <div class="flex-1">
                    <div class="text-white font-medium">{{ getActivityDescription(activity) }}</div>
                    <div class="text-binance-gray text-sm">{{ formatDate(activity.created_at) }}</div>
                  </div>
                </div>
              </div>
              
              <div v-else class="text-center py-12">
                <div class="text-6xl mb-4">📝</div>
                <h3 class="text-xl font-semibold text-white mb-2">{{ t('profile.noActivity') }}</h3>
                <p class="text-binance-gray">{{ t('profile.noActivityDesc') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-trading-surface border border-binance-border rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-semibold text-white mb-4">{{ t('profile.editProfile') }}</h3>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-binance-gray mb-2">{{ t('profile.username') }}</label>
            <input
              v-model="editForm.username"
              type="text"
              class="input-field"
              :placeholder="t('profile.usernamePlaceholder')"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-binance-gray mb-2">{{ t('profile.bio') }}</label>
            <textarea
              v-model="editForm.bio"
              class="input-field resize-none"
              rows="3"
              :placeholder="t('profile.bioPlaceholder')"
            ></textarea>
          </div>
        </div>
        
        <div class="flex gap-3 mt-6">
          <button
            @click="saveProfile"
            :disabled="saving"
            class="flex-1 btn-primary"
          >
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
          <button
            @click="showEditModal = false"
            class="flex-1 btn-secondary"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTypedI18n } from '@/i18n'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { SupabaseService } from '@/services/supabase'
import TokenCard from '@/components/token/TokenCard.vue'
import { formatNumber, formatPrice } from '@/utils/formatters'

const { t } = useTypedI18n()
const route = useRoute()
const router = useRouter()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const loading = ref(true)
const error = ref('')
const user = ref<any>(null)
const userTokens = ref<any[]>([])
const tradingHistory = ref<any[]>([])
const userHoldings = ref<any[]>([])
const userActivity = ref<any[]>([])
const userWatchlist = ref<any[]>([])
const activeTab = ref('tokens')
const showEditModal = ref(false)
const saving = ref(false)

const editForm = ref({
  username: '',
  bio: ''
})

// Computed
const userName = computed(() => {
  return user.value?.username || formatWalletAddress(user.value?.wallet_address || '')
})

const avatarInitials = computed(() => {
  const name = userName.value
  return name.slice(0, 2).toUpperCase()
})

const isOwnProfile = computed(() => {
  // Check if this is the user's own profile
  // Compare the route address with the connected wallet address
  return walletStore.isConnected && walletStore.walletAddress === route.params.address
})

const tabs = computed(() => [
  {
    id: 'tokens',
    label: t('profile.createdTokens'),
    icon: '🎭',
    count: userTokens.value.length
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: '🤍',
    count: userWatchlist.value.length
  },
  {
    id: 'history',
    label: t('profile.tradingHistory'),
    icon: '📊',
    count: tradingHistory.value.length
  },
  {
    id: 'holdings',
    label: t('profile.holdings'),
    icon: '💰',
    count: userHoldings.value.length
  },
  {
    id: 'activity',
    label: t('profile.activity'),
    icon: '📝',
    count: userActivity.value.length
  }
])

// Methods
const formatWalletAddress = (address: string): string => {
  if (!address) return 'Unknown'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const getUserLevel = (): string => {
  const score = user.value?.reputation_score || 0
  if (score >= 1000) return t('profile.level.legendary')
  if (score >= 500) return t('profile.level.expert')
  if (score >= 100) return t('profile.level.advanced')
  if (score >= 10) return t('profile.level.intermediate')
  return t('profile.level.beginner')
}

const calculateTotalHolders = (): number => {
  return userTokens.value.reduce((total, token) => total + (token.holders || 0), 0)
}

const getActivityIcon = (type: string): string => {
  const icons: { [key: string]: string } = {
    token_created: '🎭',
    trade: '💱',
    comment: '💬',
    like: '❤️'
  }
  return icons[type] || '📝'
}

const getActivityDescription = (activity: any): string => {
  switch (activity.type) {
    case 'token_created':
      return t('profile.activity.tokenCreated', { name: activity.token_name })
    case 'trade':
      return t('profile.activity.trade', { type: activity.trade_type, token: activity.token_name })
    default:
      return activity.description || 'Unknown activity'
  }
}

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

const navigateToToken = (mintAddress: string) => {
  router.push(`/token/${mintAddress}`)
}

const shareProfile = async () => {
  try {
    await navigator.share({
      title: `${userName.value}'s Profile - FloppFun`,
      text: `Check out ${userName.value}'s profile on FloppFun`,
      url: window.location.href
    })
  } catch (error) {
    // Fallback to clipboard
    navigator.clipboard.writeText(window.location.href)
    uiStore.showToast({
      type: 'success',
      title: t('profile.profileLinkCopied'),
      message: t('profile.profileLinkCopiedDesc')
    })
  }
}

const saveProfile = async () => {
  if (!isOwnProfile.value) return
  
  saving.value = true
  try {
    await SupabaseService.updateUserProfile(user.value.id, {
      username: editForm.value.username,
      bio: editForm.value.bio
    })
    
    user.value.username = editForm.value.username
    user.value.bio = editForm.value.bio
    
    showEditModal.value = false
    uiStore.showToast({
      type: 'success',
      title: t('profile.profileUpdated'),
      message: t('profile.profileUpdatedDesc')
    })
  } catch (error) {
    uiStore.showToast({
      type: 'error',
      title: t('errors.updateFailed'),
      message: t('errors.tryAgain')
    })
  } finally {
    saving.value = false
  }
}

const loadUserProfile = async () => {
  try {
    const walletAddress = route.params.address as string
    
    if (!walletAddress) {
      throw new Error('No wallet address provided')
    }
    
    // Load user data
    const userData = await SupabaseService.getUserByWallet(walletAddress)
    
    if (!userData) {
      throw new Error(t('profile.userNotFound'))
    }
    
    user.value = userData
    editForm.value = {
      username: userData.username || '',
      bio: userData.bio || ''
    }
    
    // Debug: investigate token relationships (remove this later)
    // await SupabaseService.debugUserTokens(walletAddress)
    
    // Load user's data in parallel
    const [tokens, watchlist, history, holdings, activity] = await Promise.all([
      SupabaseService.getTokensByCreator(userData.id),
      SupabaseService.getUserWatchlist(userData.id),
      SupabaseService.getUserTradingHistory(userData.id),
      SupabaseService.getUserHoldings(userData.id),
      SupabaseService.getUserActivity(userData.id)
    ])
    
    userTokens.value = tokens || []
    userWatchlist.value = watchlist || []
    tradingHistory.value = history || []
    userHoldings.value = holdings || []
    userActivity.value = activity || []
    
  } catch (err) {
    console.error('Failed to load user profile:', err)
    error.value = err instanceof Error ? err.message : t('profile.loadError')
  } finally {
    loading.value = false
  }
}

/**
 * Remove token from watchlist
 */
const removeFromWatchlist = async (tokenId: string) => {
  if (!user.value?.id) return
  
  try {
    await SupabaseService.removeFromWatchlist(user.value.id, tokenId)
    
    // Remove from local state
    userWatchlist.value = userWatchlist.value.filter(item => item.id !== tokenId)
    
    uiStore.showToast({
      type: 'success',
      title: 'Removed from Watchlist',
      message: 'Token has been removed from your watchlist'
    })
  } catch (error) {
    console.error('Failed to remove from watchlist:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Error',
      message: 'Failed to remove token from watchlist'
    })
  }
}

onMounted(() => {
  loadUserProfile()
})
</script> 