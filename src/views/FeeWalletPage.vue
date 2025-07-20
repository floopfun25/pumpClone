<template>
  <div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pt-20">
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">💰 Platform Fee Wallet</h1>
        <p class="text-gray-300">Monitor your platform revenue in real-time</p>
      </div>

      <!-- Fee Wallet Stats -->
      <div class="max-w-4xl mx-auto">
        <!-- Balance Card -->
        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Current Balance -->
            <div class="text-center">
              <div class="text-3xl font-bold text-green-400 mb-2">
                {{ walletBalance }} SOL
              </div>
              <div class="text-gray-300 text-sm">Current Balance</div>
              <div class="text-gray-400 text-xs mt-1">
                ≈ ${{ (walletBalance * solPrice).toFixed(2) }} USD
              </div>
            </div>

            <!-- Total Fees Collected -->
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-400 mb-2">
                {{ totalFeesCollected }} SOL
              </div>
              <div class="text-gray-300 text-sm">Total Fees Collected</div>
              <div class="text-gray-400 text-xs mt-1">
                {{ transactionCount }} transactions
              </div>
            </div>

            <!-- Fee Rate -->
            <div class="text-center">
              <div class="text-2xl font-bold text-purple-400 mb-2">
                1.0%
              </div>
              <div class="text-gray-300 text-sm">Platform Fee Rate</div>
              <div class="text-gray-400 text-xs mt-1">
                Per trade
              </div>
            </div>
          </div>
        </div>

        <!-- Wallet Info -->
        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <h3 class="text-xl font-bold text-white mb-4">📍 Wallet Information</h3>
          <div class="space-y-3">
            <div class="flex flex-col sm:flex-row sm:justify-between">
              <span class="text-gray-300 font-medium">Address:</span>
              <div class="flex items-center space-x-2">
                <code class="bg-black/30 px-3 py-1 rounded text-green-400 text-sm break-all">
                  {{ feeWalletAddress }}
                </code>
                <button 
                  @click="copyToClipboard(feeWalletAddress)"
                  class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row sm:justify-between">
              <span class="text-gray-300 font-medium">Network:</span>
              <span class="text-orange-400 font-mono">{{ network.toUpperCase() }}</span>
            </div>
            <div class="flex flex-col sm:flex-row sm:justify-between">
              <span class="text-gray-300 font-medium">Last Updated:</span>
              <span class="text-gray-400">{{ lastUpdated }}</span>
            </div>
          </div>
        </div>

        <!-- Control Panel -->
        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 mb-6 border border-white/20">
          <h3 class="text-xl font-bold text-white mb-4">🔧 Controls</h3>
          <div class="flex flex-wrap gap-3">
            <button 
              @click="refreshBalance"
              :disabled="loading"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-white font-medium transition-colors"
            >
              {{ loading ? '🔄 Refreshing...' : '🔄 Refresh Balance' }}
            </button>
            <button 
              @click="toggleAutoRefresh"
              :class="autoRefresh ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'"
              class="px-4 py-2 rounded text-white font-medium transition-colors"
            >
              {{ autoRefresh ? '⏹️ Stop Auto-Refresh' : '▶️ Start Auto-Refresh' }}
            </button>
            <button 
              @click="viewOnExplorer"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors"
            >
              🔍 View on Explorer
            </button>
          </div>
        </div>

        <!-- Recent Transactions -->
        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <h3 class="text-xl font-bold text-white mb-4">📊 Recent Fee Collections</h3>
          
          <div v-if="loadingTransactions" class="text-center py-8">
            <div class="text-gray-400">Loading transaction history...</div>
          </div>
          
          <div v-else-if="transactions.length === 0" class="text-center py-8">
            <div class="text-gray-400">No fee transactions yet</div>
            <div class="text-sm text-gray-500 mt-2">Start trading to see fees collected here!</div>
          </div>
          
          <div v-else class="space-y-3">
            <div 
              v-for="tx in transactions" 
              :key="tx.signature"
              class="bg-black/20 rounded-lg p-4 border border-white/10"
            >
              <div class="flex justify-between items-start">
                <div>
                  <div class="text-green-400 font-bold">+{{ tx.amount }} SOL</div>
                  <div class="text-gray-400 text-sm">{{ tx.time }}</div>
                </div>
                <div class="text-right">
                  <a 
                    :href="getExplorerUrl(tx.signature)" 
                    target="_blank"
                    class="text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    View Transaction
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Testing Commands -->
        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 mt-6 border border-white/20">
          <h3 class="text-xl font-bold text-white mb-4">🧪 Testing Commands</h3>
          <div class="space-y-3">
            <div class="bg-black/30 rounded-lg p-4">
              <div class="text-gray-300 text-sm mb-2">Check balance via command line:</div>
              <code class="text-green-400 text-sm break-all">
                solana balance {{ feeWalletAddress }} --url {{ network }}
              </code>
            </div>
            <div class="bg-black/30 rounded-lg p-4">
              <div class="text-gray-300 text-sm mb-2">View transaction history:</div>
              <code class="text-green-400 text-sm break-all">
                solana transaction-history {{ feeWalletAddress }} --url {{ network }}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { solanaConfig } from '@/config'

// Reactive data
const walletBalance = ref(0)
const totalFeesCollected = ref(0)
const transactionCount = ref(0)
const solPrice = ref(20) // Approximate SOL price for USD conversion
const loading = ref(false)
const loadingTransactions = ref(true)
const autoRefresh = ref(false)
const lastUpdated = ref('')
const transactions = ref<any[]>([])

// Configuration
const feeWalletAddress = import.meta.env.VITE_DEVNET_FEE_WALLET || import.meta.env.VITE_MAINNET_FEE_WALLET
const network = import.meta.env.VITE_SOLANA_NETWORK || 'devnet'
const connection = new Connection(solanaConfig.rpcUrl, 'confirmed')

// Auto refresh interval
let refreshInterval: NodeJS.Timeout | null = null

// Fetch wallet balance
const fetchBalance = async () => {
  try {
    const publicKey = new PublicKey(feeWalletAddress)
    const balance = await connection.getBalance(publicKey)
    walletBalance.value = balance / LAMPORTS_PER_SOL
    lastUpdated.value = new Date().toLocaleTimeString()
    
    console.log('💰 Fee wallet balance:', walletBalance.value, 'SOL')
  } catch (error) {
    console.error('Failed to fetch balance:', error)
  }
}

// Fetch transaction history (simplified)
const fetchTransactions = async () => {
  try {
    loadingTransactions.value = true
    const publicKey = new PublicKey(feeWalletAddress)
    
    // Get recent transaction signatures
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 })
    
    const txDetails = []
    for (const sigInfo of signatures) {
      try {
        const tx = await connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0
        })
        
        if (tx && tx.meta && !tx.meta.err) {
          // Calculate balance change - check all accounts for our fee wallet
          let change = 0
          for (let i = 0; i < tx.meta.preBalances.length; i++) {
            const preBalance = tx.meta.preBalances[i] || 0
            const postBalance = tx.meta.postBalances[i] || 0
            const accountChange = (postBalance - preBalance) / LAMPORTS_PER_SOL
            
            // If this account received SOL, it's likely our fee wallet
            if (accountChange > 0) {
              change = Math.max(change, accountChange)
            }
          }
          
          if (change > 0) { // Only show incoming transactions (fees)
            txDetails.push({
              signature: sigInfo.signature,
              amount: change.toFixed(6),
              time: new Date(sigInfo.blockTime! * 1000).toLocaleString(),
              slot: sigInfo.slot
            })
          }
        }
      } catch (error) {
        console.warn('Failed to fetch transaction details:', error)
      }
    }
    
    transactions.value = txDetails
    totalFeesCollected.value = txDetails.reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
    transactionCount.value = txDetails.length
    
  } catch (error) {
    console.error('Failed to fetch transactions:', error)
  } finally {
    loadingTransactions.value = false
  }
}

// Refresh balance
const refreshBalance = async () => {
  loading.value = true
  await Promise.all([fetchBalance(), fetchTransactions()])
  loading.value = false
}

// Toggle auto refresh
const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  
  if (autoRefresh.value) {
    refreshInterval = setInterval(refreshBalance, 5000) // Refresh every 5 seconds
    console.log('🔄 Auto-refresh started (5s interval)')
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
    console.log('⏹️ Auto-refresh stopped')
  }
}

// Copy to clipboard
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // You could add a toast notification here
    console.log('📋 Copied to clipboard:', text)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// View on Solana Explorer
const viewOnExplorer = () => {
  const baseUrl = network.includes('mainnet') 
    ? 'https://explorer.solana.com' 
    : 'https://explorer.solana.com/?cluster=devnet'
  const url = `${baseUrl}/address/${feeWalletAddress}`
  window.open(url, '_blank')
}

// Get explorer URL for transaction
const getExplorerUrl = (signature: string) => {
  const baseUrl = network.includes('mainnet') 
    ? 'https://explorer.solana.com' 
    : 'https://explorer.solana.com/?cluster=devnet'
  return `${baseUrl}/tx/${signature}`
}

// Lifecycle
onMounted(async () => {
  console.log('💰 Fee wallet monitoring page loaded')
  console.log('📍 Wallet address:', feeWalletAddress)
  console.log('🌐 Network:', network)
  
  await refreshBalance()
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
/* Custom scrollbar for better appearance */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style> 