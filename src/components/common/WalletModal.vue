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
        class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 md:p-6 p-4 mobile-modal"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-6 md:mb-6 mb-4">
          <h2 class="text-xl md:text-xl text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('wallet.selectWallet') }}
          </h2>
          <button
            @click="closeModal"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 md:p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <!-- Loading State -->
        <div v-if="connecting" class="text-center py-8">
          <div class="spinner w-10 h-10 md:w-8 md:h-8 mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400 text-base md:text-sm">
            {{ isMobileDevice ? t('wallet.openingApp') : t('wallet.connecting') }}
          </p>
          <p v-if="isMobileDevice && selectedWallet" class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {{ t('wallet.approveInApp', { walletName: selectedWallet }) }}
          </p>
        </div>
        
        <!-- Wallet List -->
        <div v-if="!connecting" class="space-y-4 md:space-y-3">
          <!-- Regular Wallet List -->
          <div v-if="displayWallets.length > 0">
            <h3 class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 md:mb-3">
              {{ t('wallet.selectWallet') }}
            </h3>
            <div class="space-y-3 md:space-y-2">
              <button
                v-for="wallet in displayWallets"
                :key="wallet.name"
                @click="connectWallet(wallet.name)"
                class="w-full flex items-center space-x-3 p-4 md:p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 mobile-wallet-button"
              >
                <img 
                  :src="wallet.icon" 
                  :alt="wallet.name"
                  class="w-10 h-10 md:w-8 md:h-8 rounded-full"
                  @error="handleImageError"
                />
                <div class="flex-1 text-left">
                  <p class="font-medium text-gray-900 dark:text-white text-base md:text-sm">
                    {{ wallet.name }}
                  </p>
                </div>
                <svg class="w-6 h-6 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Not Installed Wallets (Desktop only) -->
          <div v-if="notInstalledWallets.length > 0 && !isMobileDevice" class="mt-6">
            <h3 class="text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 md:mb-3">
              {{ t('walletModal.notInstalled') }}
            </h3>
            <div class="space-y-3 md:space-y-2">
              <a
                v-for="wallet in notInstalledWallets"
                :key="wallet.name"
                :href="wallet.url"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full flex items-center space-x-3 p-4 md:p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
              >
                <img 
                  :src="wallet.icon" 
                  :alt="wallet.name"
                  class="w-10 h-10 md:w-8 md:h-8 rounded-full opacity-60"
                  @error="handleImageError"
                />
                <div class="flex-1 text-left">
                  <p class="font-medium text-gray-900 dark:text-white text-base md:text-sm">
                    {{ wallet.name }}
                  </p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ t('walletModal.notInstalled') }}
                  </p>
                </div>
                <svg class="w-6 h-6 md:w-5 md:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
              </a>
            </div>
          </div>
          
          <!-- No Wallets Available -->
          <div v-if="displayWallets.length === 0" class="text-center py-8">
            <div class="text-gray-400 mb-4">
              <svg class="w-16 h-16 md:w-12 md:h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <p class="text-gray-600 dark:text-gray-400 mb-4 text-base md:text-sm">
              {{ t('wallet.noWallet') }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-500 mb-4">
              {{ t('walletModal.installInstructions') }}
            </p>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="error" class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="flex items-start space-x-2">
            <svg class="w-6 h-6 md:w-5 md:h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="flex-1">
              <h4 class="text-base md:text-sm font-medium text-red-800 dark:text-red-200 mb-1">{{ t('messages.error.walletConnection') }}</h4>
              <p class="text-sm md:text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                {{ error }}
              </p>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <p class="text-sm md:text-xs text-gray-500 dark:text-gray-400 text-center">
            {{ t('walletModal.termsAgreement', { appName: t('app.name') }) }}
            <a href="/terms" class="text-primary-600 dark:text-primary-400 hover:underline">{{ t('walletModal.termsOfService') }}</a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTypedI18n } from '@/i18n'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { isMobile } from '@/utils/mobile'
import { getWalletFallbackImage } from '@/utils/paths'

// Props and emits
defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'connected', walletName: string): void
}>()

// Composables
const { t } = useTypedI18n()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const connecting = ref(false)
const error = ref<string | null>(null)
const selectedWallet = ref<string | null>(null)

// Computed
const isMobileDevice = computed(() => isMobile())

const availableWallets = computed(() => {
  const wallets = walletStore.getAvailableWallets()
  console.log('Available wallets:', wallets.map(w => w.name))
  return wallets
})

const allWallets = computed(() => {
  const wallets = walletStore.getAllWallets()
  console.log('All wallets:', wallets.map(w => w.name))
  return wallets
})

const displayWallets = computed(() => availableWallets.value)

const notInstalledWallets = computed(() => {
  if (isMobileDevice.value) return []
  return allWallets.value.filter(wallet => !availableWallets.value.find(w => w.name === wallet.name))
})

// Methods
const closeModal = () => {
  emit('close')
}

const connectWallet = async (walletName: string) => {
  connecting.value = true
  error.value = null
  selectedWallet.value = walletName
  
  try {
    // Check if already connected
    if (walletStore.isConnected) {
      closeModal()
      return
    }

    // For mobile Phantom, we need special handling
    if (isMobileDevice.value && walletName === 'Phantom') {
      await walletStore.connectWallet(walletName)
      // Don't close modal yet - it will be handled when we return from Phantom
      return
    }

    // For other wallets
    await walletStore.connectWallet(walletName)
    emit('connected', walletName)
    closeModal()
  } catch (err) {
    console.error('Failed to connect wallet:', err)
    error.value = err instanceof Error ? err.message : 'Unknown error'
    
    uiStore.showToast({
      type: 'error',
      title: '❌ Wallet Connection Failed',
      message: error.value
    })
  } finally {
    // Only reset connecting state if we're not waiting for Phantom mobile return
    if (!(isMobileDevice.value && selectedWallet.value === 'Phantom')) {
      connecting.value = false
      selectedWallet.value = null
    }
  }
}

// Watch for connection state changes
watch(() => walletStore.isConnected, (newValue) => {
  if (newValue) {
    // Successfully connected
    connecting.value = false
    selectedWallet.value = null
    emit('connected', walletStore.wallet?.name || '')
    closeModal()
    
    // Show success toast
    uiStore.showToast({
      type: 'success',
      title: '✅ Wallet Connected',
      message: 'Successfully connected to wallet!'
    })
  }
})

const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = getWalletFallbackImage()
}
</script>

<style scoped>
/* Mobile-specific optimizations */
@media (max-width: 768px) {
  .mobile-modal {
    @apply max-h-[90vh] overflow-y-auto mx-2;
  }
  
  .mobile-wallet-button {
    @apply min-h-[60px] active:scale-95 active:bg-gray-100 dark:active:bg-gray-600;
  }
  
  .mobile-wallet-button:active {
    @apply duration-75;
  }
  
  /* Better mobile touch targets */
  button {
    @apply min-h-[44px];
  }
  
  /* Improve mobile modal backdrop */
  .fixed.inset-0 {
    @apply backdrop-blur-sm;
  }
}

/* Smooth animations */
.mobile-modal {
  animation: modalSlideUp 0.3s ease-out;
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

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