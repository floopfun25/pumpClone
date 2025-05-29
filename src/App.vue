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

// Application initialization
onMounted(async () => {
  try {
    // Show loading state during initialization
    isLoading.value = true
    uiStore.setLoading(true)
    
    // Initialize wallet connection if previously connected
    await walletStore.initializeWallet()
    
    // Initialize user session if wallet is connected
    if (walletStore.isConnected) {
      await authStore.initializeUser()
    }
    
    // Add wallet connection event listeners if wallet exists
    if (walletStore.wallet) {
      walletStore.wallet.on('connect', async () => {
        console.log('Wallet connected:', walletStore.publicKey?.toString())
        await authStore.signInWithWallet()
      })
      
      walletStore.wallet.on('disconnect', () => {
        console.log('Wallet disconnected')
        authStore.signOut()
      })
    }
    
  } catch (error) {
    console.error('App initialization error:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Initialization Error',
      message: 'Failed to initialize application. Please refresh the page.'
    })
  } finally {
    // Hide loading state
    isLoading.value = false
    uiStore.setLoading(false)
  }
})
</script>

<style>
/* Global application styles are imported from style.css */
</style> 