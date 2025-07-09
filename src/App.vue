<template>
  <!-- Main application wrapper with Binance dark theme support -->
  <div id="app" class="min-h-screen bg-binance-dark dark:bg-binance-dark transition-colors duration-300">
    <!-- Navigation Header -->
    <Navbar />
    
    <!-- Mobile Create Token Button - Persistent across all pages -->
    <div v-if="isMobile && uiStore.isSidebarCollapsed" class="mobile-create-button-container">
      <router-link 
        to="/create" 
        class="mobile-create-button"
      >
        <span class="text-lg">🚀</span>
        <span class="font-bold">{{ t('navigation.create') }}</span>
      </router-link>
    </div>
    
    <!-- Sidebar -->
    <Sidebar />
    
    <!-- Main Content Area -->
    <main class="bg-binance-dark transition-all duration-300" :class="mainContentClass">
      <!-- Vue Router outlet for page content -->
      <RouterView />
    </main>
    
    <!-- Footer -->
    <Footer class="transition-all duration-300" :class="footerClass" />
    
    <!-- Global Toast Notifications -->
    <ToastContainer />
    
    <!-- Loading Overlay for app-wide loading states -->
    <LoadingOverlay v-if="isLoading" />
    
    <!-- Debug Modal for mobile-friendly debugging -->
    <DebugModal 
      :is-visible="debugState.isVisible" 
      :debug-text="debugState.debugText" 
      :title="debugState.title"
      @close="hideDebugModal" 
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, onBeforeUnmount } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { useTypedI18n } from '@/i18n'
import { useDebugService } from '@/services/debugService'
import { broadcastService } from '@/services/broadcastService'

// Import layout components
import Navbar from '@/components/layout/Navbar.vue'
import Footer from '@/components/layout/Footer.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import DebugModal from '@/components/common/DebugModal.vue'

// Initialize stores and composables
const authStore = useAuthStore()
const walletStore = useWalletStore()
const uiStore = useUIStore()
const { t } = useTypedI18n()
const { debugState, hideDebugModal } = useDebugService()

// Reactive window width for responsive behavior
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

// Computed properties for reactive state
const isLoading = computed(() => uiStore.isLoading)
const isMobile = computed(() => windowWidth.value < 768)

// Dynamic classes based on sidebar state
const mainContentClass = computed(() => {
  const baseClasses = 'transition-all duration-300'
  
  // On mobile, don't add margin when sidebar is expanded (it uses overlay)
  if (isMobile.value) {
    return `${baseClasses} ml-0`
  }
  
  return uiStore.isSidebarCollapsed ? `${baseClasses} ml-16` : `${baseClasses} ml-64`
})

const footerClass = computed(() => {
  const baseClasses = 'transition-all duration-300'
  
  // On mobile, don't add margin when sidebar is expanded (it uses overlay)
  if (isMobile.value) {
    return `${baseClasses} ml-0`
  }
  
  return uiStore.isSidebarCollapsed ? `${baseClasses} ml-16` : `${baseClasses} ml-64`
})

// Handle window resize
function handleResize() {
  windowWidth.value = window.innerWidth
}

// Handle broadcast messages from other tabs
const handleBroadcastMessage = (event: MessageEvent) => {
  const { type, data } = event.data;

  if (type === 'wallet-connected') {
    console.log('Broadcast received: wallet-connected', data);
    walletStore.handleMobileConnect(data);
  } else if (type === 'wallet-disconnected') {
    console.log('Broadcast received: wallet-disconnected');
    walletStore.handleMobileDisconnect();
  }
};


// Application initialization
onMounted(async () => {
  try {
    // Initialize theme first (sets dark mode as default)
    uiStore.initializeTheme()
    
    // Initialize sidebar state
    uiStore.initializeSidebar()
    
    // Setup global debug function for utility files
    if (typeof window !== 'undefined') {
      (window as any).globalShowDebug = (message: string) => {
        const { showDebugModal } = useDebugService()
        showDebugModal(message)
      }
    }
    
    // Setup auth listener
    authStore.setupAuthListener()
    
    // Initialize wallet
    await walletStore.initializeWallet()
    
    if (walletStore.isConnected) {
      // Initialize user session if wallet is connected
      await authStore.initializeUser()
    }
    
    // Add window resize listener
    window.addEventListener('resize', handleResize)

    // Add broadcast channel listener
    broadcastService.addEventListener(handleBroadcastMessage);
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
})

// Cleanup on component unmount
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  broadcastService.removeEventListener(handleBroadcastMessage);
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

/* Ensure smooth sidebar transitions */
main, footer {
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

/* Mobile responsiveness for sidebar */
@media (max-width: 768px) {
  main, footer {
    margin-left: 0 !important;
  }
  
  /* Mobile Create Button */
  .mobile-create-button-container {
    @apply fixed top-16 left-0 right-0 z-40 px-4 py-3 bg-binance-dark/95 backdrop-blur-lg border-b border-binance-border;
  }
  
  .mobile-create-button {
    @apply w-full flex items-center justify-center space-x-2 px-4 py-3 bg-binance-yellow hover:bg-primary-600 text-binance-dark font-semibold rounded-lg transition-all duration-200 shadow-lg;
    @apply active:scale-95 min-h-[48px];
  }
  
  .mobile-create-button:hover {
    @apply shadow-xl;
  }
  
  /* Adjust main content to account for mobile button */
  main {
    @apply pt-24 !important;
  }
  
  footer {
    @apply pb-4;
  }
}
</style> 