<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Portfolio</h1>
      
      <!-- Not Authenticated State -->
      <div v-if="!authStore.isAuthenticated" class="text-center py-12">
        <div class="text-6xl mb-4">🔐</div>
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Connect Your Wallet</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Connect your wallet to view your token portfolio
        </p>
        <button @click="() => walletStore.connectWallet()" class="btn-primary">
          Connect Wallet
        </button>
      </div>

      <!-- Portfolio Content -->
      <div v-else>
        <!-- Loading State -->
        <div v-if="loading" class="flex justify-center py-12">
          <div class="spinner w-8 h-8"></div>
        </div>

        <!-- Portfolio Content -->
        <div v-else>
          <!-- Portfolio Summary -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="card text-center">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Total Value</h3>
              <p class="text-2xl font-bold text-pump-green">
                ${{ portfolio.totalValue.toFixed(2) }}
              </p>
            </div>
            <div class="card text-center">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Total Tokens</h3>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ portfolio.totalTokens }}
              </p>
            </div>
            <div class="card text-center">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">24h Change</h3>
              <p class="text-2xl font-bold text-gray-500">
                {{ portfolio.change24h === 0 ? '-' : `${portfolio.change24h > 0 ? '+' : ''}${portfolio.change24h.toFixed(2)}%` }}
              </p>
            </div>
          </div>

          <!-- Holdings -->
          <div class="card">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Your Holdings</h2>
            
            <!-- Holdings List -->
            <div v-if="portfolio.holdings.length > 0" class="space-y-4">
              <div v-for="holding in portfolio.holdings" :key="holding.id" class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <!-- Token Image -->
                    <div class="w-12 h-12 rounded-full overflow-hidden">
                      <img 
                        v-if="holding.token.image_url" 
                        :src="holding.token.image_url" 
                        :alt="holding.token.name"
                        class="w-full h-full object-cover"
                      />
                      <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold">
                        {{ holding.token.symbol.slice(0, 2) }}
                      </div>
                    </div>
                    
                    <!-- Token Info -->
                    <div>
                      <h3 class="font-semibold text-gray-900 dark:text-white">
                        {{ holding.token.name }}
                      </h3>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        ${{ holding.token.symbol }}
                      </p>
                    </div>
                  </div>
                  
                  <!-- Holdings Stats -->
                  <div class="text-right">
                    <div class="font-semibold text-gray-900 dark:text-white">
                      {{ formatTokenAmount(holding.amount, holding.token.decimals) }} {{ holding.token.symbol }}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      Value: ${{ holding.currentValue.toFixed(2) }}
                    </div>
                    <div class="text-xs text-gray-500">
                      Price: ${{ holding.token.current_price.toFixed(6) }}
                    </div>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="mt-4 flex gap-2">
                  <router-link 
                    :to="`/token/${holding.token.mint_address}`"
                    class="btn-primary text-sm px-4 py-2"
                  >
                    View Token
                  </router-link>
                  <button class="btn-secondary text-sm px-4 py-2">
                    Trade
                  </button>
                </div>
              </div>
            </div>
            
            <!-- Empty State -->
            <div v-else class="text-center py-12">
              <div class="text-6xl mb-4">💼</div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No tokens in portfolio</h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">Start trading to build your portfolio!</p>
              <router-link to="/" class="btn-primary">Browse Tokens</router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { SupabaseService } from '@/services/supabase'

// Stores
const authStore = useAuthStore()
const walletStore = useWalletStore()

// State
const loading = ref(false)
const portfolio = ref<{
  totalValue: number
  totalTokens: number
  holdings: Array<{
    id: string
    amount: number
    currentValue: number
    token: {
      id: string
      name: string
      symbol: string
      image_url?: string
      mint_address: string
      current_price: number
      decimals: number
    }
  }>
  change24h: number
}>({
  totalValue: 0,
  totalTokens: 0,
  holdings: [],
  change24h: 0
})

/**
 * Load user portfolio data
 */
const loadPortfolio = async () => {
  if (!authStore.user?.id) return
  
  try {
    loading.value = true
    
    const portfolioData = await SupabaseService.getUserPortfolio(authStore.user.id)
    portfolio.value = portfolioData
    
  } catch (error) {
    console.error('Failed to load portfolio:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Format token amount for display
 */
const formatTokenAmount = (amount: number, decimals: number): string => {
  const formattedAmount = amount / Math.pow(10, decimals)
  if (formattedAmount >= 1e6) return (formattedAmount / 1e6).toFixed(2) + 'M'
  if (formattedAmount >= 1e3) return (formattedAmount / 1e3).toFixed(2) + 'K'
  return formattedAmount.toFixed(2)
}

// Watch for authentication changes
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated) {
    loadPortfolio()
  } else {
    portfolio.value = {
      totalValue: 0,
      totalTokens: 0,
      holdings: [],
      change24h: 0
    }
  }
})

// Load portfolio on mount if user is authenticated
onMounted(() => {
  if (authStore.isAuthenticated) {
    loadPortfolio()
  }
})
</script> 