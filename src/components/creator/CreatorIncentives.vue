<template>
  <div class="creator-incentives bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🚀 Creator Incentive Programs
        </h2>
        <p class="text-gray-600 dark:text-gray-400">
          Earn rewards for creating and promoting quality content
        </p>
      </div>
      <div v-if="creatorData" class="text-right">
        <div class="text-sm text-gray-500 dark:text-gray-400">Total Earned</div>
        <div class="text-2xl font-bold text-pump-green">
          {{ formatSOL(creatorData.totalEarned) }}
        </div>
      </div>
    </div>

    <!-- Creator Status -->
    <div v-if="authStore.isAuthenticated" class="mb-8">
      <div class="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Creator Badge -->
            <div class="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center">
              <span class="text-white text-2xl">{{ getCreatorBadge(creatorData?.tier || 'bronze') }}</span>
            </div>
            
            <!-- Creator Info -->
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ creatorData?.tier?.toUpperCase() || 'BRONZE' }} CREATOR
              </h3>
              <p class="text-gray-600 dark:text-gray-400">
                Level {{ creatorData?.level || 1 }} • {{ creatorData?.tokensCreated || 0 }} tokens created
              </p>
              
              <!-- Progress to Next Level -->
              <div class="mt-3">
                <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span>Progress to {{ getNextTier(creatorData?.tier || 'bronze').toUpperCase() }}</span>
                  <span>{{ Math.round(getProgressToNextTier()) }}%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    class="bg-gradient-to-r from-primary-500 to-purple-500 h-2 rounded-full transition-all duration-300" 
                    :style="`width: ${getProgressToNextTier()}%`"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Quick Stats -->
          <div class="text-right">
            <div class="grid grid-cols-2 gap-4 text-center">
              <div>
                <div class="text-lg font-bold text-gray-900 dark:text-white">{{ creatorData?.followers || 0 }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Followers</div>
              </div>
              <div>
                <div class="text-lg font-bold text-gray-900 dark:text-white">{{ creatorData?.monthlyRewards || 0 }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Monthly SOL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Connect Wallet Prompt -->
    <div v-else class="text-center py-8">
      <div class="text-6xl mb-4">🎨</div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Start Your Creator Journey
      </h3>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        Connect your wallet to access creator incentive programs
      </p>
      <button @click="connectWallet" class="btn-primary">
        Connect Wallet
      </button>
    </div>

    <!-- Active Programs -->
    <div v-if="authStore.isAuthenticated" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Token Creation Rewards -->
      <div class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
            <span class="text-white text-lg">🪙</span>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Token Creation Rewards</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Earn SOL for creating successful tokens</p>
          </div>
        </div>
        
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Tokens Created</span>
            <span class="font-medium text-gray-900 dark:text-white">{{ creatorData?.tokensCreated || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Graduation Bonus</span>
            <span class="font-medium text-pump-green">{{ formatSOL(creatorData?.graduationBonus || 0) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Volume Rewards</span>
            <span class="font-medium text-pump-green">{{ formatSOL(creatorData?.volumeRewards || 0) }}</span>
          </div>
        </div>
      </div>

      <!-- Community Engagement -->
      <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <span class="text-white text-lg">💬</span>
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-white">Community Engagement</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">Rewards for active community participation</p>
          </div>
        </div>
        
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Comments Posted</span>
            <span class="font-medium text-gray-900 dark:text-white">{{ creatorData?.commentsCount || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Helpful Votes</span>
            <span class="font-medium text-gray-900 dark:text-white">{{ creatorData?.helpfulVotes || 0 }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600 dark:text-gray-400">Engagement Rewards</span>
            <span class="font-medium text-pump-green">{{ formatSOL(creatorData?.engagementRewards || 0) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Available Programs -->
    <div v-if="authStore.isAuthenticated">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Available Programs</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div
          v-for="program in availablePrograms"
          :key="program.id"
          class="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
        >
          <div class="flex items-center gap-3 mb-4">
            <div :class="['w-12 h-12 rounded-lg flex items-center justify-center', program.bgColor]">
              <span class="text-white text-xl">{{ program.icon }}</span>
            </div>
            <div>
              <h4 class="font-semibold text-gray-900 dark:text-white">{{ program.title }}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ program.description }}</p>
            </div>
          </div>
          
          <div class="space-y-2 mb-4">
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Reward</span>
              <span class="font-medium text-pump-green">{{ program.reward }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Requirement</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ program.requirement }}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">Progress</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ program.progress }}%</span>
            </div>
          </div>
          
          <!-- Progress Bar -->
          <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-4">
            <div 
              :class="['h-2 rounded-full transition-all duration-300', program.progressColor]"
              :style="`width: ${program.progress}%`"
            ></div>
          </div>
          
          <button 
            :disabled="program.progress >= 100"
            :class="[
              'w-full py-2 px-4 rounded-lg font-medium transition-colors text-sm',
              program.progress >= 100 
                ? 'bg-green-500 text-white cursor-default' 
                : 'bg-primary-500 hover:bg-primary-600 text-white'
            ]"
          >
            {{ program.progress >= 100 ? '✓ Completed' : 'In Progress' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Leaderboard -->
    <div v-if="authStore.isAuthenticated">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">🏆 Creator Leaderboard</h3>
        <select v-model="leaderboardPeriod" class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>
      
      <div class="bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
        <div
          v-for="(creator, index) in leaderboard"
          :key="creator.id"
          :class="[
            'flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600',
            index === leaderboard.length - 1 ? 'border-b-0' : '',
            creator.id === authStore.user?.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
          ]"
        >
          <div class="flex items-center gap-4">
            <!-- Rank -->
            <div class="text-center">
              <div :class="[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                index === 0 ? 'bg-yellow-500 text-white' :
                index === 1 ? 'bg-gray-400 text-white' :
                index === 2 ? 'bg-amber-600 text-white' :
                'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              ]">
                {{ index + 1 }}
              </div>
            </div>
            
            <!-- Creator Info -->
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-white">{{ creator.username }}</span>
                <span class="text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full">
                  {{ creator.tier.toUpperCase() }}
                </span>
                <span v-if="creator.id === authStore.user?.id" class="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                  YOU
                </span>
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                {{ creator.tokensCreated }} tokens • {{ creator.followers }} followers
              </div>
            </div>
          </div>
          
          <!-- Earnings -->
          <div class="text-right">
            <div class="font-bold text-pump-green">{{ formatSOL(creator.earnings) }}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">earned</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Claim Rewards Modal -->
    <div 
      v-if="showClaimModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="showClaimModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">💰 Claim Rewards</h3>
        
        <div class="text-center mb-6">
          <div class="text-4xl mb-2">🎉</div>
          <div class="text-2xl font-bold text-pump-green">{{ formatSOL(pendingRewards) }}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Available to claim</div>
        </div>
        
        <div class="flex gap-3 justify-end">
          <button
            @click="showClaimModal = false"
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            @click="claimRewards"
            class="px-4 py-2 bg-pump-green text-white rounded-lg hover:bg-green-600"
            :disabled="claimingRewards"
          >
            {{ claimingRewards ? 'Claiming...' : 'Claim Now' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { SupabaseService } from '@/services/supabase'

interface CreatorData {
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  level: number
  totalEarned: number
  monthlyRewards: number
  tokensCreated: number
  followers: number
  commentsCount: number
  helpfulVotes: number
  graduationBonus: number
  volumeRewards: number
  engagementRewards: number
}

interface IncentiveProgram {
  id: string
  title: string
  description: string
  reward: string
  requirement: string
  progress: number
  icon: string
  bgColor: string
  progressColor: string
}

interface LeaderboardEntry {
  id: string
  username: string
  tier: string
  tokensCreated: number
  followers: number
  earnings: number
}

// Stores
const authStore = useAuthStore()
const walletStore = useWalletStore()

// State
const creatorData = ref<CreatorData | null>(null)
const leaderboardPeriod = ref('month')
const leaderboard = ref<LeaderboardEntry[]>([])
const showClaimModal = ref(false)
const pendingRewards = ref(0)
const claimingRewards = ref(false)

// Computed
const availablePrograms = computed((): IncentiveProgram[] => [
  {
    id: 'first-token',
    title: 'First Token Creator',
    description: 'Create your first token',
    reward: '0.1 SOL',
    requirement: '1 token',
    progress: Math.min((creatorData.value?.tokensCreated || 0) * 100, 100),
    icon: '🎯',
    bgColor: 'bg-purple-500',
    progressColor: 'bg-purple-500'
  },
  {
    id: 'token-master',
    title: 'Token Master',
    description: 'Create 10 successful tokens',
    reward: '1.0 SOL',
    requirement: '10 tokens',
    progress: Math.min((creatorData.value?.tokensCreated || 0) * 10, 100),
    icon: '👑',
    bgColor: 'bg-yellow-500',
    progressColor: 'bg-yellow-500'
  },
  {
    id: 'community-leader',
    title: 'Community Leader',
    description: 'Get 100 helpful votes',
    reward: '0.5 SOL',
    requirement: '100 votes',
    progress: Math.min((creatorData.value?.helpfulVotes || 0), 100),
    icon: '🌟',
    bgColor: 'bg-blue-500',
    progressColor: 'bg-blue-500'
  },
  {
    id: 'graduation-expert',
    title: 'Graduation Expert',
    description: 'Help 5 tokens graduate',
    reward: '2.0 SOL',
    requirement: '5 graduations',
    progress: Math.min((creatorData.value?.graduationBonus || 0) * 20, 100),
    icon: '🎓',
    bgColor: 'bg-green-500',
    progressColor: 'bg-green-500'
  },
  {
    id: 'volume-king',
    title: 'Volume King',
    description: 'Generate $100K in token volume',
    reward: '5.0 SOL',
    requirement: '$100K volume',
    progress: Math.min((creatorData.value?.volumeRewards || 0) * 2, 100),
    icon: '📈',
    bgColor: 'bg-red-500',
    progressColor: 'bg-red-500'
  },
  {
    id: 'social-butterfly',
    title: 'Social Butterfly',
    description: 'Get 1000 followers',
    reward: '1.5 SOL',
    requirement: '1000 followers',
    progress: Math.min((creatorData.value?.followers || 0) / 10, 100),
    icon: '🦋',
    bgColor: 'bg-pink-500',
    progressColor: 'bg-pink-500'
  }
])

// Methods
const connectWallet = async () => {
  try {
    await walletStore.connectWallet()
    if (walletStore.isConnected) {
      await authStore.initializeUser()
      await loadCreatorData()
    }
  } catch (error) {
    console.error('Failed to connect wallet:', error)
  }
}

const loadCreatorData = async () => {
  if (!authStore.user) return
  
  try {
    // This would normally fetch from your backend
    // For now, we'll simulate creator data
    creatorData.value = {
      tier: 'silver',
      level: 3,
      totalEarned: 2.5,
      monthlyRewards: 0.8,
      tokensCreated: 7,
      followers: 234,
      commentsCount: 89,
      helpfulVotes: 156,
      graduationBonus: 1.2,
      volumeRewards: 0.9,
      engagementRewards: 0.4
    }
    
    await loadLeaderboard()
  } catch (error) {
    console.error('Failed to load creator data:', error)
  }
}

const loadLeaderboard = async () => {
  try {
    // Simulate leaderboard data
    leaderboard.value = [
      { id: '1', username: 'pump_master', tier: 'diamond', tokensCreated: 45, followers: 2890, earnings: 25.7 },
      { id: '2', username: 'moon_maker', tier: 'gold', tokensCreated: 32, followers: 1650, earnings: 18.3 },
      { id: '3', username: 'gem_hunter', tier: 'gold', tokensCreated: 28, followers: 1420, earnings: 15.9 },
      { id: authStore.user?.id || '4', username: authStore.user?.username || 'you', tier: 'silver', tokensCreated: 7, followers: 234, earnings: 2.5 },
      { id: '5', username: 'crypto_cat', tier: 'silver', tokensCreated: 12, followers: 890, earnings: 6.8 }
    ]
  } catch (error) {
    console.error('Failed to load leaderboard:', error)
  }
}

const getCreatorBadge = (tier: string): string => {
  const badges = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    diamond: '💎'
  }
  return badges[tier as keyof typeof badges] || '🥉'
}

const getNextTier = (currentTier: string): string => {
  const tierOrder = ['bronze', 'silver', 'gold', 'diamond']
  const currentIndex = tierOrder.indexOf(currentTier)
  return tierOrder[currentIndex + 1] || 'diamond'
}

const getProgressToNextTier = (): number => {
  if (!creatorData.value) return 0
  
  const requirements = {
    bronze: { tokens: 1, followers: 10 },
    silver: { tokens: 5, followers: 100 },
    gold: { tokens: 20, followers: 500 },
    diamond: { tokens: 50, followers: 2000 }
  }
  
  const nextTier = getNextTier(creatorData.value.tier)
  if (nextTier === 'diamond' && creatorData.value.tier === 'diamond') return 100
  
  const req = requirements[nextTier as keyof typeof requirements]
  const tokenProgress = (creatorData.value.tokensCreated / req.tokens) * 100
  const followerProgress = (creatorData.value.followers / req.followers) * 100
  
  return Math.min((tokenProgress + followerProgress) / 2, 100)
}

const claimRewards = async () => {
  claimingRewards.value = true
  
  try {
    // Simulate claiming rewards
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    if (creatorData.value) {
      creatorData.value.totalEarned += pendingRewards.value
      pendingRewards.value = 0
    }
    
    showClaimModal.value = false
  } catch (error) {
    console.error('Failed to claim rewards:', error)
  } finally {
    claimingRewards.value = false
  }
}

const formatSOL = (amount: number): string => {
  return `${amount.toFixed(2)} SOL`
}

// Lifecycle
onMounted(() => {
  if (authStore.isAuthenticated) {
    loadCreatorData()
  }
})
</script> 