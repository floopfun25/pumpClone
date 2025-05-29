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
        <!-- Token Header -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div class="flex flex-col md:flex-row items-start gap-6">
            <!-- Token Image -->
            <div class="w-20 h-20 bg-gradient-to-br from-primary-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {{ tokenSymbol }}
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
            </div>
            
            <!-- Token Stats -->
            <div class="grid grid-cols-2 gap-4 text-center">
              <div>
                <div class="text-2xl font-bold text-gray-900 dark:text-white">$0.001234</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Price</div>
              </div>
              <div>
                <div class="text-2xl font-bold text-pump-green">+12.5%</div>
                <div class="text-sm text-gray-600 dark:text-gray-400">24h Change</div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left Column: Chart & Trading -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Price Chart -->
            <div class="card">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Price Chart</h2>
              <div class="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <p class="text-gray-500 dark:text-gray-400">📈 Chart coming soon...</p>
              </div>
            </div>

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
          </div>

          <!-- Right Column: Token Info & Activity -->
          <div class="space-y-6">
            <!-- Token Stats -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Token Stats</h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Market Cap</span>
                  <span class="font-medium text-gray-900 dark:text-white">$123.4K</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">24h Volume</span>
                  <span class="font-medium text-gray-900 dark:text-white">$45.6K</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Holders</span>
                  <span class="font-medium text-gray-900 dark:text-white">234</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Total Supply</span>
                  <span class="font-medium text-gray-900 dark:text-white">1B</span>
                </div>
              </div>
            </div>

            <!-- Bonding Curve Progress -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Progress</h3>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">Bonding Curve Progress</span>
                  <span class="font-medium text-gray-900 dark:text-white">15%</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div class="bg-gradient-to-r from-pump-green to-primary-500 h-3 rounded-full" style="width: 15%"></div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  When the market cap reaches $69K, all liquidity will be deposited to DEX.
                </p>
              </div>
            </div>

            <!-- Recent Trades -->
            <div class="card">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Trades</h3>
              <div class="space-y-3">
                <div v-for="trade in recentTrades" :key="trade.id" class="flex justify-between items-center">
                  <div class="flex items-center space-x-2">
                    <span :class="trade.type === 'buy' ? 'text-pump-green' : 'text-pump-red'" class="text-sm font-medium">
                      {{ trade.type.toUpperCase() }}
                    </span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">
                      {{ trade.amount }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ trade.time }}
                  </span>
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
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// State
const loading = ref(true)
const tradeType = ref<'buy' | 'sell'>('buy')
const tradeAmount = ref('')

// Mock token data
const tokenName = ref('Sample Token')
const tokenSymbol = ref('SAMPLE')
const tokenDescription = ref('A sample meme token for demonstration purposes.')

// Mock recent trades
const recentTrades = ref([
  { id: 1, type: 'buy', amount: '0.5 SOL', time: '2m ago' },
  { id: 2, type: 'sell', amount: '0.3 SOL', time: '5m ago' },
  { id: 3, type: 'buy', amount: '1.2 SOL', time: '8m ago' },
])

/**
 * Execute trade
 * TODO: Integrate with Solana blockchain
 */
const executeTrade = async () => {
  try {
    console.log(`${tradeType.value} ${tradeAmount.value} SOL worth of ${tokenSymbol.value}`)
    // TODO: Implement actual trading logic
  } catch (error) {
    console.error('Trade failed:', error)
  }
}

/**
 * Load token data
 * TODO: Fetch from Supabase
 */
const loadTokenData = async () => {
  try {
    const mintAddress = route.params.mintAddress
    console.log('Loading token:', mintAddress)
    
    // TODO: Fetch token data from Supabase
    // TODO: Subscribe to real-time updates
    
    // Mock delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
  } catch (error) {
    console.error('Failed to load token:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTokenData()
})
</script> 