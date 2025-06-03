<template>
  <!-- Wallet Selection Modal -->
  <div 
    v-if="isOpen" 
    class="fixed inset-0 z-50 overflow-y-auto"
    @click="closeModal"
  >
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"></div>
    
    <!-- Modal Content -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div 
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            Connect Wallet
          </h2>
          <button
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <!-- Temporary Debug Info -->
        <div class="mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
          <p>Debug - isMobile: {{ isMobileDevice }}</p>
          <p>Debug - displayWallets.length: {{ displayWallets.length }}</p>
          <p>Debug - allWallets.length: {{ allWallets.length }}</p>
          <p>Debug - availableWallets.length: {{ availableWallets.length }}</p>
          <p>Debug - displayWallets: {{ displayWallets.map(w => w.name).join(', ') }}</p>
          <p>Debug - allWallets: {{ allWallets.map(w => `${w.name}(${w.supportsDeeplink})`).join(', ') }}</p>
        </div>
        
        <!-- Loading State -->
        <div v-if="connecting" class="text-center py-8">
          <div class="spinner w-8 h-8 mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">
            {{ isMobileDevice ? 'Opening wallet app...' : 'Connecting to wallet...' }}
          </p>
        </div>
        
        <!-- Mobile Info Banner -->
        <div v-if="isMobileDevice && !connecting" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p class="text-sm text-blue-700 dark:text-blue-300 font-medium">Mobile Wallet Connection</p>
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Tap a wallet to open its app. If not installed, you'll be redirected to download it.
              </p>
            </div>
          </div>
        </div>
        
        <!-- Wallet List -->
        <div v-else-if="!connecting" class="space-y-3">
          <!-- Available Wallets (Mobile: All deeplink-compatible wallets) -->
          <div v-if="displayWallets.length > 0">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {{ isMobileDevice ? 'Wallet Apps' : 'Detected Wallets' }}
            </h3>
            <div class="space-y-2">
              <button
                v-for="wallet in displayWallets"
                :key="wallet.name"
                @click="connectWallet(wallet.name)"
                class="w-full flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <img 
                  :src="wallet.icon" 
                  :alt="wallet.name"
                  class="w-8 h-8 rounded-full"
                  @error="handleImageError"
                />
                <div class="flex-1 text-left">
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ wallet.name }}
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ isMobileDevice ? 'Tap to connect or install' : 'Ready to connect' }}
                  </p>
                </div>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Not Installed Wallets (Desktop only) -->
          <div v-if="notInstalledWallets.length > 0 && !isMobileDevice" class="mt-6">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Install a Wallet
            </h3>
            <div class="space-y-2">
              <a
                v-for="wallet in notInstalledWallets"
                :key="wallet.name"
                :href="wallet.url"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full flex items-center space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <img 
                  :src="wallet.icon" 
                  :alt="wallet.name"
                  class="w-8 h-8 rounded-full opacity-60"
                  @error="handleImageError"
                />
                <div class="flex-1 text-left">
                  <p class="font-medium text-gray-900 dark:text-white">
                    {{ wallet.name }}
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Not installed
                  </p>
                </div>
                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
              </a>
            </div>
          </div>
          
          <!-- No Wallets Available -->
          <div v-if="displayWallets.length === 0 && (notInstalledWallets.length === 0 || isMobileDevice)" class="text-center py-8">
            <div class="text-gray-400 mb-4">
              <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
              {{ isMobileDevice ? 'No wallet apps detected' : 'No Solana wallets found' }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mb-4">
              {{ isMobileDevice 
                ? 'Install a Solana wallet app to continue' 
                : 'Please install a Solana wallet extension to continue' }}
            </p>
            <!-- Mobile install links -->
            <div v-if="isMobileDevice" class="space-y-2">
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Download Phantom App
              </a>
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="error" class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-600 dark:text-red-400">
            {{ error }}
          </p>
        </div>
        
        <!-- Footer -->
        <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
            By connecting a wallet, you agree to FloppFun's 
            <a href="/terms" class="text-primary-600 dark:text-primary-400 hover:underline">Terms of Service</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { isMobile } from '@/utils/mobile'

// Props
interface Props {
  isOpen: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  close: []
  connected: [walletName: string]
}>()

// Stores
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const connecting = ref(false)
const error = ref<string | null>(null)

// Mobile detection using our utility
const isMobileDevice = computed(() => isMobile())

// Computed properties
const availableWallets = computed(() => {
  const wallets = walletStore.getAvailableWallets()
  return wallets
})

const allWallets = computed(() => {
  const wallets = walletStore.getAllWallets()
  return wallets
})

// For mobile: show all deeplink-compatible wallets
// For desktop: show only detected wallets
const displayWallets = computed(() => {
  console.log('displayWallets computed - isMobileDevice:', isMobileDevice.value)
  console.log('displayWallets computed - allWallets:', allWallets.value)
  console.log('displayWallets computed - availableWallets:', availableWallets.value)
  
  if (isMobileDevice.value) {
    // On mobile, show all wallets that support deeplinks
    const mobileWallets = allWallets.value.filter(wallet => {
      console.log(`Checking wallet ${wallet.name}, supportsDeeplink:`, wallet.supportsDeeplink)
      return wallet.supportsDeeplink
    })
    console.log('displayWallets computed - mobileWallets:', mobileWallets)
    return mobileWallets
  } else {
    // On desktop, show only installed/detected wallets
    return availableWallets.value
  }
})

const notInstalledWallets = computed(() => {
  if (isMobileDevice.value) {
    // On mobile, don't show "not installed" section since we handle this in the connection flow
    return []
  }
  return allWallets.value.filter(wallet => 
    !availableWallets.value.some(available => available.name === wallet.name)
  )
})

// Watch for connection status changes
watch(() => walletStore.isConnected, (connected) => {
  if (connected) {
    emit('connected', walletStore.wallet?.name || 'Unknown')
    closeModal()
  }
})

// Methods
const connectWallet = async (walletName: string) => {
  try {
    connecting.value = true
    error.value = null
    
    console.log(`WalletModal - Attempting to connect to ${walletName}`)
    
    await walletStore.connectWallet(walletName)
    
    // Show success message only if not on mobile (mobile connections redirect to app)
    if (!isMobileDevice.value) {
      uiStore.showToast({
        type: 'success',
        title: '🔗 Wallet Connected Successfully',
        message: `Connected to ${walletName} wallet`
      })
    }
    
  } catch (err) {
    console.error('Failed to connect wallet:', err)
    error.value = err instanceof Error ? err.message : 'Failed to connect wallet'
    
    uiStore.showToast({
      type: 'error',
      title: '❌ Connection Failed',
      message: error.value
    })
  } finally {
    connecting.value = false
  }
}

const closeModal = () => {
  if (!connecting.value) {
    error.value = null
    emit('close')
  }
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.src = `${import.meta.env.BASE_URL}wallet-fallback.svg` // Fallback icon with proper base path
}
</script>

<style scoped>
.spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 