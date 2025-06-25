<template>
  <!-- Main application wrapper with Binance dark theme support -->
  <div id="app" class="min-h-screen bg-binance-dark dark:bg-binance-dark transition-colors duration-300">
    <!-- Navigation Header -->
    <Navbar />
    
    <!-- Search Container -->
    <div class="bg-trading-surface border-b border-binance-border">
      <div class="container mx-auto px-4 py-4">
        <div class="max-w-3xl mx-auto">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('search.placeholder')"
              class="w-full pl-12 pr-4 py-3 border border-binance-border rounded-lg bg-trading-elevated text-white focus:ring-2 focus:ring-binance-yellow focus:border-binance-yellow placeholder-binance-gray"
            />
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-6 w-6 text-binance-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
    
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
import { useTypedI18n } from '@/i18n'

// Import layout components
import Navbar from '@/components/layout/Navbar.vue'
import Footer from '@/components/layout/Footer.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'

// Initialize stores and i18n
const authStore = useAuthStore()
const walletStore = useWalletStore()
const uiStore = useUIStore()
const { t } = useTypedI18n()

// Search state
const searchQuery = ref('')

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