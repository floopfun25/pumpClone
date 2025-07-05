<template>
  <button
    @click="handleConnect"
    :disabled="connecting || isConnecting"
    class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-pump-purple hover:bg-pump-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pump-purple transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <LoadingSpinner v-if="connecting || isConnecting" size="sm" class="mr-2" />
    <Icon v-else name="wallet" class="mr-2" />
    {{ buttonText }}
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { isMobile } from '@/utils/mobile'
import Icon from './Icon.vue'
import LoadingSpinner from './LoadingSpinner.vue'

// Define custom event type
interface PhantomWalletEvent extends CustomEvent {
  detail: {
    publicKey: string;
  };
}

declare global {
  interface WindowEventMap {
    'phantom-wallet-connected': PhantomWalletEvent;
  }
}

const walletStore = useWalletStore()
const connecting = ref(false)

// Computed properties from wallet store
const isConnecting = computed(() => walletStore.isConnecting)
const isConnected = computed(() => walletStore.isConnected)

// Dynamic button text based on state
const buttonText = computed(() => {
  if (connecting.value || isConnecting.value) {
    return 'Connecting...'
  }
  if (isConnected.value) {
    return 'Connected'
  }
  return 'Connect Wallet'
})

// Handle mobile wallet return
const handleMobileWalletReturn = async () => {
  try {
    console.log('Handling mobile wallet return in button component')
    await walletStore.handleMobileWalletReturn()
  } catch (error) {
    console.error('Failed to handle mobile wallet return:', error)
  }
}

// Handle wallet connection
const handleConnect = async () => {
  try {
    connecting.value = true
    await walletStore.connectWallet()
  } catch (error) {
    console.error('Failed to connect wallet:', error)
  } finally {
    connecting.value = false
  }
}

// Set up event listeners for mobile wallet return
onMounted(() => {
  if (isMobile()) {
    // Listen for visibility change (user returns from wallet app)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for custom phantom connection event
    window.addEventListener('phantom-wallet-connected', handlePhantomConnected as EventListener)
  }
})

// Clean up event listeners
onUnmounted(() => {
  if (isMobile()) {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('phantom-wallet-connected', handlePhantomConnected as EventListener)
  }
})

// Handle page visibility change (mobile wallet return)
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && !isConnected.value) {
    console.log('Page became visible, checking wallet connection...')
    handleMobileWalletReturn()
  }
}

// Handle phantom connection event
const handlePhantomConnected = (event: PhantomWalletEvent) => {
  console.log('Received phantom-wallet-connected event:', event.detail)
  handleMobileWalletReturn()
}
</script> 