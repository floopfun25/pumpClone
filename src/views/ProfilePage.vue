<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center min-h-screen">
      <div class="spinner w-12 h-12"></div>
    </div>

    <!-- Profile Content -->
    <div v-else class="py-8">
      <div class="container mx-auto px-4">
        <!-- Error State -->
        <div v-if="error" class="text-center py-12">
          <div class="text-6xl mb-4">❌</div>
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">{{ error }}</h2>
          <router-link to="/" class="btn-primary">{{ $t('common.back') }}</router-link>
        </div>

        <!-- Profile Header -->
        <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div class="flex items-center gap-6">
            <!-- Avatar -->
            <div class="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
              <img 
                v-if="user?.avatar_url" 
                :src="user.avatar_url" 
                :alt="userName"
                class="w-full h-full object-cover"
              />
              <span v-else>{{ userName.slice(0, 2).toUpperCase() }}</span>
            </div>
            
            <!-- User Info -->
            <div class="flex-1">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {{ userName }}
              </h1>
              <p class="text-gray-600 dark:text-gray-400 mb-2">
                {{ formatWalletAddress(user?.wallet_address || '') }}
              </p>
              <p v-if="user?.bio" class="text-gray-700 dark:text-gray-300">
                {{ user.bio }}
              </p>
            </div>
            
            <!-- Stats -->
            <div class="grid grid-cols-3 gap-6 text-center">
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ user?.tokens_created || 0 }}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Tokens Created</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ formatNumber(user?.total_volume_traded || 0) }}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">SOL Traded</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ user?.reputation_score || 0 }}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Reputation</div>
              </div>
            </div>
          </div>
        </div>

        <!-- User's Tokens -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Created Tokens</h3>
          
          <div v-if="userTokens.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TokenCard
              v-for="token in userTokens"
              :key="token.id"
              :token="token"
              class="trading-card hover:glow-gold"
            />
          </div>
          
          <div v-else class="text-center py-12">
            <div class="text-6xl mb-4">🎭</div>
            <h3 class="text-xl font-semibold text-white mb-2">No tokens created yet</h3>
            <p class="text-gray-400">This user hasn't created any tokens.</p>
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
import TokenCard from '@/components/token/TokenCard.vue'

const route = useRoute()
const router = useRouter()

// State
const loading = ref(true)
const error = ref('')
const user = ref<any>(null)
const userTokens = ref<any[]>([])

// Computed
const userName = computed(() => {
  return user.value?.username || formatWalletAddress(user.value?.wallet_address || '')
})

// Methods
const formatWalletAddress = (address: string): string => {
  if (!address) return 'Unknown'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toString()
}

const loadUserProfile = async () => {
  try {
    const walletAddress = route.params.address as string
    console.log('Loading user profile:', walletAddress)
    
    if (!walletAddress) {
      throw new Error('No wallet address provided')
    }
    
    // Fetch user data from Supabase
    const userData = await SupabaseService.getUserByWallet(walletAddress)
    
    if (!userData) {
      throw new Error('User not found')
    }
    
    user.value = userData
    
    // Load user's created tokens
    const tokens = await SupabaseService.getTokens({
      page: 1,
      limit: 20,
      sortBy: 'created_at',
      sortOrder: 'desc'
    })
    
    // Filter tokens created by this user
    userTokens.value = tokens.filter((token: any) => 
      token.creator_id === userData.id
    )
    
  } catch (err) {
    console.error('Failed to load user profile:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load user profile'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadUserProfile()
})
</script> 