<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark">
    <!-- Portfolio Header -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{{ t('portfolio.title') }}</h1>
            <p class="text-gray-600 dark:text-gray-400 mt-1">{{ t('portfolio.description') }}</p>
          </div>
          
          <!-- Refresh Button -->
          <button
            @click="refreshPortfolio"
            :disabled="loading"
            class="flex items-center gap-2 px-4 py-2 bg-pump-purple text-white rounded-lg hover:bg-pump-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="refresh" :class="{ 'animate-spin': loading }" class="w-4 h-4" />
            {{ t('portfolio.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Portfolio Content -->
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading && !portfolioData" class="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>

      <!-- Portfolio Stats -->
      <div v-else-if="portfolioData" class="space-y-8">
        <!-- Portfolio Overview Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Total Portfolio Value -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('portfolio.totalPortfolioValue') }}</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  ${{ formatNumber(portfolioData.totalValue) }}
                </p>
                <p class="text-sm mt-1" :class="getTotalChangeColor()">
                  {{ formatPriceChange(portfolioData.totalChange24h) }}
                </p>
              </div>
              <div class="p-3 bg-pump-purple/10 rounded-lg">
                <Icon name="wallet" class="w-6 h-6 text-pump-purple" />
              </div>
            </div>
          </div>

          <!-- SOL Holdings -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('portfolio.solBalance') }}</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ formatNumber(portfolioData.solBalance) }} SOL
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  ${{ formatNumber(portfolioData.solValue) }}
                </p>
              </div>
              <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Icon name="sol" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <!-- Token Count -->
          <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('portfolio.tokenHoldings') }}</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ portfolioData.tokenHoldings.length }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  ${{ formatNumber(portfolioData.tokenValue) }}
                </p>
              </div>
              <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Icon name="coins" class="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        <!-- Token Holdings Table -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('portfolio.tokenHoldings') }}</h2>
          </div>
          
          <div v-if="portfolioData.tokenHoldings.length === 0" class="text-center py-12">
            <Icon name="coins" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p class="text-gray-600 dark:text-gray-400">{{ t('portfolio.noTokenHoldings') }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {{ t('portfolio.createFirstToken') }}
            </p>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ t('portfolio.token') }}
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ t('portfolio.price') }}
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ t('portfolio.balance') }}
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ t('portfolio.value') }}
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ t('portfolio.change24h') }}
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {{ t('portfolio.actions') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr v-for="holding in portfolioData.tokenHoldings" :key="holding.mint" 
                    class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <!-- Token Info -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <img 
                        :src="holding.metadata?.image || getTokenFallbackImage()" 
                        :alt="holding.metadata?.name || 'Token'"
                        class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600"
                        @error="(e: Event) => { if (e.target) (e.target as HTMLImageElement).src = getTokenFallbackImage() }"
                      />
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          {{ holding.metadata?.name || 'Unknown Token' }}
                          <span v-if="holding.metadata?.verified" class="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                            ✓
                          </span>
                        </p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                          {{ holding.metadata?.symbol || 'UNKNOWN' }}
                          <span v-if="holding.metadata?.source && holding.metadata.source !== 'database'" class="text-xs opacity-60 ml-1">
                            ({{ holding.metadata.source }})
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>

                  <!-- Price -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ formatPrice(holding.price) }}
                    </p>
                  </td>

                  <!-- Balance -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ formatTokenBalance(holding.balance, holding.decimals) }}
                    </p>
                  </td>

                  <!-- Value -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      ${{ formatNumber(holding.value) }}
                    </p>
                  </td>

                  <!-- 24h Change -->
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          :class="getPriceChangeColor(holding.priceChange24h)">
                      {{ formatPriceChange(holding.priceChange24h) }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <router-link 
                      :to="`/token/${holding.mint}`"
                      class="text-pump-purple hover:text-pump-purple/80 transition-colors"
                    >
                      {{ t('portfolio.viewDetails') }}
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>


      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <Icon name="exclamation-triangle" class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('portfolio.failedToLoadPortfolio') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">{{ error }}</p>
        <button
          @click="refreshPortfolio"
          class="px-4 py-2 bg-pump-purple text-white rounded-lg hover:bg-pump-purple/90 transition-colors"
        >
          {{ t('portfolio.tryAgain') }}
        </button>
      </div>

      <!-- Wallet Not Connected -->
      <div v-else class="text-center py-12">
        <Icon name="wallet" class="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {{ t('portfolio.connectYourWallet') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ t('portfolio.connectWalletToViewPortfolio') }}
        </p>
        <WalletConnectButton />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { PublicKey } from '@solana/web3.js'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { solanaProgram } from '@/services/solanaProgram'
import { priceOracleService, formatPrice, formatPriceChange } from '@/services/priceOracle'
import { tokenMetadataService } from '@/services/tokenMetadataService'
import { portfolioTrackingService } from '@/services/portfolioTrackingService'
import { SupabaseService } from '@/services/supabase'
import Icon from '@/components/common/Icon.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import WalletConnectButton from '@/components/common/WalletConnectButton.vue'

import { getTokenFallbackImage } from '@/utils/paths'

// Types
interface TokenHolding {
  mint: string
  balance: number
  decimals: number
  metadata: {
    name: string
    symbol: string
    image: string | null
    verified?: boolean
    source?: string
  }
  price: number
  value: number
  priceChange24h: number
}

interface PortfolioData {
  totalValue: number
  solBalance: number
  solValue: number
  tokenValue: number
  tokenHoldings: TokenHolding[]
  totalChange24h: number
}

// Store
const router = useRouter()
const walletStore = useWalletStore()
const uiStore = useUIStore()
const { t } = useI18n()

// Reactive state
const loading = ref(false)
const error = ref<string | null>(null)
const portfolioData = ref<PortfolioData | null>(null)

// Computed properties
const totalValue = computed(() => {
  return portfolioData.value?.totalValue || 0
})

const totalPnL = computed(() => {
  if (!portfolioData.value?.tokenHoldings.length) return 0
  return portfolioData.value.tokenHoldings.reduce((sum, token) => 
    sum + token.priceChange24h, 0) / portfolioData.value.tokenHoldings.length
})

const totalPnLClass = computed(() => ({
  'text-green-600': totalPnL.value >= 0,
  'text-red-600': totalPnL.value < 0
}))

const bestPerformer = computed(() => {
  if (!portfolioData.value?.tokenHoldings.length) return 'N/A'
  const best = portfolioData.value.tokenHoldings.reduce((best, current) => 
    current.priceChange24h > best.priceChange24h ? current : best, portfolioData.value.tokenHoldings[0])
  return best.metadata?.name || 'Unknown'
})

// Methods
const connectWallet = async () => {
  // This will be handled by the WalletConnectButton component
}

const loadPortfolio = async (): Promise<void> => {
  if (!walletStore.isConnected || !walletStore.publicKey) {
    return
  }

  try {
    loading.value = true
    error.value = null

    // Get token accounts
    const tokenAccounts = await solanaProgram.getUserTokenAccounts(new PublicKey(walletStore.publicKey.toBase58()))
    
    // Get SOL balance
    const solBalance = walletStore.balance

    // Prepare holdings for price calculation
    const holdings = [
      {
        mint: 'SOL',
        balance: solBalance * 1e9, // Convert to lamports
        decimals: 9
      },
      ...tokenAccounts.map(account => ({
        mint: account.mint,
        balance: account.balance,
        decimals: account.decimals
      }))
    ]

    // Calculate real portfolio value using price oracle
    const portfolioValue = await priceOracleService.calculatePortfolioValue(holdings)
    
    // Get token metadata and prices
    const tokenHoldings = await Promise.all(
      tokenAccounts.map(async (account): Promise<TokenHolding> => {
        const [tokenPrice, tokenMetadata] = await Promise.all([
          priceOracleService.getTokenPrice(account.mint),
          tokenMetadataService.getTokenMetadata(account.mint)
        ])

        const metadata = {
          name: tokenMetadata?.name || tokenPrice?.name || 'Unknown Token',
          symbol: tokenMetadata?.symbol || tokenPrice?.symbol || 'UNKNOWN',
          image: tokenMetadata?.image || null,
          verified: tokenMetadata?.verified || false,
          source: tokenMetadata?.source || 'fallback'
        }
        
        // Note: account.balance is already converted to UI amount in getUserTokenAccounts
        const balance = account.balance
        const value = balance * (tokenPrice?.price || 0)
        
        return {
          mint: account.mint,
          balance: account.balance,
          decimals: account.decimals,
          metadata,
          price: tokenPrice?.price || 0,
          value,
          priceChange24h: tokenPrice?.priceChangePercent24h || 0
        }
      })
    )

    // Calculate real 24h change using portfolio tracking service
    let totalChange24h = 0
    try {
      // Get user ID from database
      const user = await SupabaseService.getUserByWallet(walletStore.publicKey.toBase58())
      if (user) {
        const portfolioChange = await portfolioTrackingService.getPortfolio24hChange(
          user.id, 
          portfolioValue.totalValue
        )
        totalChange24h = portfolioChange.valuePercentage24h

        // Store current portfolio snapshot for future tracking
        await portfolioTrackingService.storePortfolioSnapshot(user.id, {
          totalValue: portfolioValue.totalValue,
          solBalance,
          solValue: portfolioValue.solValue,
          tokenValue: portfolioValue.tokenValues.reduce((sum, token) => sum + token.value, 0),
          tokenCount: tokenHoldings.length
        })
      }
    } catch (trackingError) {
      console.warn('Failed to calculate 24h change:', trackingError)
      // Keep default value of 0
    }

    portfolioData.value = {
      totalValue: portfolioValue.totalValue,
      solBalance,
      solValue: portfolioValue.solValue,
      tokenValue: portfolioValue.tokenValues.reduce((sum, token) => sum + token.value, 0),
      tokenHoldings,
      totalChange24h
    }

  } catch (err) {
    console.error('Error loading portfolio:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load portfolio'
  } finally {
    loading.value = false
  }
}

const formatTokenBalance = (balance: number, decimals: number): string => {
  // Balance is already in UI amount, no need to convert again
  if (balance >= 1000000) {
    return (balance / 1000000).toFixed(2) + 'M'
  } else if (balance >= 1000) {
    return (balance / 1000).toFixed(2) + 'K'
  } else {
    return balance.toFixed(4)
  }
}

const formatNumber = (value: number): string => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M'
  } else if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K'
  } else if (value >= 0.01) {
    return value.toFixed(2)
  } else if (value >= 0.0001) {
    return value.toFixed(4)
  } else if (value > 0) {
    return value.toFixed(8)
  } else {
    return '0.00'
  }
}

const getTotalChangeColor = () => {
  const change = portfolioData.value?.totalChange24h || 0
  return {
    'text-green-600': change >= 0,
    'text-red-600': change < 0
  }
}

const getPriceChangeColor = (change: number) => {
  return {
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': change >= 0,
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400': change < 0
  }
}

const viewToken = (mint: string) => {
  router.push(`/token/${mint}`)
}

const refreshPortfolio = async () => {
  await loadPortfolio()
}

// Lifecycle
onMounted(() => {
  if (walletStore.isConnected) {
    loadPortfolio()
  }
})
</script> 