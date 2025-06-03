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

// Application initialization
onMounted(async () => {
  try {
    // Initialize theme first (sets dark mode as default)
    uiStore.initializeTheme()
    
    // Setup auth listener
    authStore.setupAuthListener()
    
    // Initialize wallet
    await walletStore.initializeWallet()
    
    if (walletStore.isConnected) {
      // Initialize user session if wallet is connected
      await authStore.initializeUser()
    }
    
    // Handle mobile wallet returns
    if (isMobile()) {
      // Check immediately for wallet returns (from URL parameters)
      await walletStore.handleMobileWalletReturn()
      
      // Check again after a delay to catch wallet browser context
      setTimeout(async () => {
        try {
          await walletStore.handleMobileWalletReturn()
        } catch (error) {
          console.warn('Delayed mobile wallet check failed:', error)
        }
      }, 1000)
      
      // Listen for page visibility changes (user returning from wallet app)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
          // Small delay to allow any URL changes to take effect
          setTimeout(async () => {
            try {
              await walletStore.handleMobileWalletReturn()
            } catch (error) {
              console.warn('Failed to handle mobile wallet return:', error)
            }
          }, 500)
        }
      })
    }
    
    console.log('App initialized successfully')
  } catch (error) {
    console.error('Failed to initialize app:', error)
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