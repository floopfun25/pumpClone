<template>
  <!-- Main application wrapper with dark mode support -->
  <div id="app" class="min-h-screen bg-gray-50 dark:bg-pump-dark transition-colors duration-300">
    <!-- Navigation Header -->
    <Navbar />
    
    <!-- Main Content Area -->
    <main class="min-h-screen">
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
const isLoading = ref(false)

// Update loading state based on UI store
const updateLoadingState = () => {
  isLoading.value = uiStore.isLoading
}

// Lifecycle methods
const initializeApp = async () => {
  try {
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
    // Initialize application
    await initializeApp()
  } catch (error) {
    console.error('App initialization error:', error)
  }
})
</script>

<style>
/* Global application styles are imported from style.css */
</style> 