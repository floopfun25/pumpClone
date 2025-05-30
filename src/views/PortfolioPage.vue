<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark">
    <!-- Header -->
    <div class="bg-white dark:bg-pump-black border-b border-gray-200 dark:border-pump-gray">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Portfolio</h1>
            <p class="mt-2 text-gray-600 dark:text-gray-300">
              Track your token holdings and performance
            </p>
          </div>
          
          <!-- Portfolio Value -->
          <div class="text-right">
            <div class="text-sm text-gray-500 dark:text-gray-400">Total Portfolio Value</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ totalValue.toFixed(4) }} SOL
            </div>
            <div class="text-sm font-medium" :class="totalPnLClass">
              {{ totalPnL >= 0 ? '+' : '' }}{{ totalPnL.toFixed(2) }}%
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-pump-orange"></div>
        <span class="ml-3 text-gray-600 dark:text-gray-300">Loading portfolio...</span>
      </div>

      <!-- Wallet Not Connected -->
      <div v-else-if="!walletStore.isConnected" class="text-center py-12">
        <div class="max-w-md mx-auto">
          <div class="text-6xl mb-4">🔐</div>
          <h3 class="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Connect Your Wallet
          </h3>
          <p class="text-gray-600 dark:text-gray-300 mb-6">
            Connect your wallet to view your token portfolio and track your investments.
          </p>
          <button 
            @click="connectWallet"
            class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-pump-orange hover:bg-pump-orange-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pump-orange transition-colors duration-200"
          >
            Connect Wallet
          </button>
        </div>
      </div>

      <!-- Portfolio Content -->
      <div v-else>
        <!-- Portfolio Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div class="bg-white dark:bg-pump-black rounded-lg p-6 border border-gray-200 dark:border-pump-gray">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tokens</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ portfolioTokens.length }}</div>
          </div>
          
          <div class="bg-white dark:bg-pump-black rounded-lg p-6 border border-gray-200 dark:border-pump-gray">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Value</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ totalValue.toFixed(4) }} SOL</div>
          </div>
          
          <div class="bg-white dark:bg-pump-black rounded-lg p-6 border border-gray-200 dark:border-pump-gray">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Best Performer</div>
            <div class="text-lg font-bold text-green-600">{{ bestPerformer }}</div>
          </div>
          
          <div class="bg-white dark:bg-pump-black rounded-lg p-6 border border-gray-200 dark:border-pump-gray">
            <div class="text-sm font-medium text-gray-500 dark:text-gray-400">24h Change</div>
            <div class="text-2xl font-bold" :class="totalPnLClass">
              {{ totalPnL >= 0 ? '+' : '' }}{{ totalPnL.toFixed(2) }}%
            </div>
          </div>
        </div>

        <!-- Token Holdings Table -->
        <div class="bg-white dark:bg-pump-black rounded-lg border border-gray-200 dark:border-pump-gray overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-pump-gray">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Token Holdings</h3>
          </div>
          
          <!-- Empty State -->
          <div v-if="portfolioTokens.length === 0" class="text-center py-12">
            <div class="text-6xl mb-4">📊</div>
            <h3 class="text-xl font-medium text-gray-900 dark:text-white mb-2">
              No Tokens Yet
            </h3>
            <p class="text-gray-600 dark:text-gray-300 mb-6">
              Start trading tokens to build your portfolio.
            </p>
            <router-link 
              to="/"
              class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-pump-orange hover:bg-pump-orange-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pump-orange transition-colors duration-200"
            >
              Explore Tokens
            </router-link>
          </div>

          <!-- Holdings List -->
          <div v-else class="divide-y divide-gray-200 dark:divide-pump-gray">
            <div 
              v-for="token in portfolioTokens" 
              :key="token.mint"
              class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-pump-gray/50 cursor-pointer transition-colors duration-200"
              @click="viewToken(token.mint)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <!-- Token Icon -->
                  <div class="w-12 h-12 bg-gradient-to-r from-pump-orange to-pump-yellow rounded-full flex items-center justify-center mr-4">
                    <span class="text-white font-bold text-lg">
                      {{ (token.symbol || 'TKN').charAt(0) }}
                    </span>
                  </div>
                  
                  <!-- Token Info -->
                  <div>
                    <div class="text-lg font-medium text-gray-900 dark:text-white">
                      {{ token.symbol || 'Unknown Token' }}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">
                      {{ formatTokenBalance(token.balance) }} tokens
                    </div>
                  </div>
                </div>

                <!-- Value and Change -->
                <div class="text-right">
                  <div class="text-lg font-medium text-gray-900 dark:text-white">
                    {{ (token.value || 0).toFixed(4) }} SOL
                  </div>
                  <div class="text-sm" :class="token.change >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ token.change >= 0 ? '+' : '' }}{{ token.change.toFixed(2) }}%
                  </div>
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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { PublicKey } from '@solana/web3.js'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { solanaProgram } from '@/services/solanaProgram'
import { SupabaseService } from '@/services/supabase'

// Store
const walletStore = useWalletStore()
const uiStore = useUIStore()
const router = useRouter()

// Reactive state
const loading = ref(false)
const portfolioTokens = ref<Array<{
  mint: string
  symbol: string
  balance: number
  decimals: number
  value: number
  change: number
}>>([])

// Computed properties
const totalValue = computed(() => {
  return portfolioTokens.value.reduce((sum, token) => sum + (token.value || 0), 0)
})

const totalPnL = computed(() => {
  if (portfolioTokens.value.length === 0) return 0
  return portfolioTokens.value.reduce((sum, token, _, arr) => 
    sum + token.change, 0) / portfolioTokens.value.length
})

const totalPnLClass = computed(() => ({
  'text-green-600': totalPnL.value >= 0,
  'text-red-600': totalPnL.value < 0
}))

const bestPerformer = computed(() => {
  if (portfolioTokens.value.length === 0) return 'N/A'
  const best = portfolioTokens.value.reduce((best, current) => 
    current.change > best.change ? current : best, portfolioTokens.value[0])
  return best.symbol || 'Unknown'
})

// Methods
const connectWallet = async () => {
  try {
    await walletStore.connectWallet()
    await loadPortfolio()
  } catch (error) {
    console.error('Failed to connect wallet:', error)
  }
}

const loadPortfolio = async () => {
  if (!walletStore.isConnected || !walletStore.publicKey) return

  try {
    loading.value = true
    
    // Get user's token accounts from blockchain
    const tokenAccounts = await solanaProgram.getUserTokenAccounts(
      new PublicKey(walletStore.publicKey)
    )

    // Fetch token metadata from database for each token
    const enrichedTokens = await Promise.all(
      tokenAccounts.map(async (account) => {
        try {
          // Get token info from database
          const tokenInfo = await SupabaseService.getTokenByMint(account.mint)
          
          // Calculate mock values (in real implementation, you'd get from price oracle)
          const mockPrice = Math.random() * 0.001 // Mock price in SOL
          const mockChange = (Math.random() - 0.5) * 20 // Mock 24h change %
          
          return {
            mint: account.mint,
            symbol: tokenInfo?.symbol || 'UNKNOWN',
            balance: account.balance,
            decimals: account.decimals,
            value: account.balance * mockPrice,
            change: mockChange
          }
        } catch (error) {
          console.error('Failed to fetch token info for', account.mint, error)
          return {
            mint: account.mint,
            symbol: 'UNKNOWN',
            balance: account.balance,
            decimals: account.decimals,
            value: 0,
            change: 0
          }
        }
      })
    )

    portfolioTokens.value = enrichedTokens
    
  } catch (error) {
    console.error('Failed to load portfolio:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Portfolio Load Failed',
      message: 'Failed to load portfolio data'
    })
  } finally {
    loading.value = false
  }
}

const formatTokenBalance = (balance: number): string => {
  if (balance >= 1000000) {
    return (balance / 1000000).toFixed(2) + 'M'
  } else if (balance >= 1000) {
    return (balance / 1000).toFixed(2) + 'K'
  }
  return balance.toFixed(2)
}

const viewToken = (mint: string) => {
  router.push(`/token/${mint}`)
}

// Lifecycle
onMounted(async () => {
  if (walletStore.isConnected) {
    await loadPortfolio()
  }
})
</script> 