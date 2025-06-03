<template>
  <!-- Main application wrapper with Binance dark theme support -->
  <div id="app" class="min-h-screen bg-binance-dark dark:bg-binance-dark transition-colors duration-300">
    <!-- Navigation Header -->
    <Navbar />
    
    <!-- Main Content Area -->
    <main class="min-h-screen bg-binance-pattern">
      <!-- Vue Router outlet for page content -->
      <RouterView />
    </main>
    
    <!-- Footer -->
    <Footer />
    
    <!-- Global Toast Notifications -->
    <ToastContainer />
    
    <!-- Loading Overlay for app-wide loading states -->
    <LoadingOverlay v-if="isLoading" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { isMobile } from '@/utils/mobile'

// Import layout components
import Navbar from '@/components/layout/Navbar.vue'
import Footer from '@/components/layout/Footer.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'

// Initialize stores
const authStore = useAuthStore()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// Computed properties for reactive state
const isLoading = computed(() => uiStore.isLoading)

// Check for mobile wallet return
const checkMobileWalletReturn = () => {
  if (isMobile()) {
    // Check if we're running in a wallet's in-app browser immediately
    setTimeout(async () => {
      try {
        await walletStore.connectIfInMobileWalletBrowser()
      } catch (error) {
        console.warn('Failed to check mobile wallet browser context:', error)
      }
    }, 100)
    
    // Check if user is returning from a wallet app
    const urlParams = new URLSearchParams(window.location.search)
    const walletReturn = urlParams.get('wallet_return')
    
    if (walletReturn) {
      console.log('User returned from wallet app')
      
      // Clean up URL
      const cleanUrl = window.location.href.split('?')[0]
      window.history.replaceState({}, '', cleanUrl)
      
      // Show toast to indicate successful return
      uiStore.showToast({
        type: 'info',
        title: '📱 Returned from Wallet',
        message: 'Please check your wallet app to complete the connection'
      })
    }
    
    // Also check if page became visible (user switched back from wallet app)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Small delay to allow wallet state to update
        setTimeout(async () => {
          try {
            await walletStore.connectIfInMobileWalletBrowser()
          } catch (error) {
            console.warn('Failed to check mobile wallet browser context:', error)
          }
        }, 500)
      }
    })
  }
}

// Lifecycle methods
const initializeApp = async () => {
  try {
    // Initialize theme first (sets dark mode as default)
    uiStore.initializeTheme()
    
    // Check for mobile wallet returns before initializing wallet
    checkMobileWalletReturn()
    
    // Setup auth listener
    authStore.setupAuthListener()
    
    // Initialize wallet
    await walletStore.initializeWallet()
    
    if (walletStore.isConnected) {
      // Initialize user session if wallet is connected
      await authStore.initializeUser()
    }
  } catch (error) {
    console.error('App initialization error:', error)
  }
}

// Application initialization
onMounted(async () => {
  try {
    // Initialize application with new theme system
    await initializeApp()
  } catch (error) {
    console.error('App initialization error:', error)
  }
})
</script>

<style>
/* Global application styles are imported from style.css */
/* Additional Binance-specific styling */
#app {
  font-feature-settings: 'cv03', 'cv04', 'cv11';
  background: var(--binance-gradient);
  color: var(--text-primary);
}

/* Ensure proper text rendering on dark backgrounds */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Custom selection colors */
::selection {
  background-color: rgba(240, 185, 11, 0.3);
  color: #ffffff;
}

::-moz-selection {
  background-color: rgba(240, 185, 11, 0.3);
  color: #ffffff;
}
</style> 