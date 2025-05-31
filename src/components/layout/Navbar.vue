<template>
  <!-- Main navigation bar for the application -->
  <nav class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo and Brand -->
        <router-link to="/" class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span class="text-white font-bold text-sm">F</span>
          </div>
          <span class="text-xl font-bold text-gray-900 dark:text-white">
            FloppFun
          </span>
        </router-link>
        
        <!-- Desktop Navigation Links -->
        <div class="hidden md:flex items-center space-x-8">
          <router-link 
            to="/" 
            class="nav-link text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Home
          </router-link>
          <router-link 
            to="/create" 
            class="nav-link text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Create Token
          </router-link>
          <router-link 
            to="/leaderboard" 
            class="nav-link text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            Leaderboard
          </router-link>
          <router-link 
            to="/about" 
            class="nav-link text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            About
          </router-link>
        </div>
        
        <!-- Right Side Actions -->
        <div class="flex items-center space-x-4">
          <!-- Search (Desktop) -->
          <div class="hidden lg:block">
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search tokens..."
                class="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Dark Mode Toggle -->
          <button 
            @click="toggleDarkMode"
            class="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            title="Toggle dark mode"
          >
            <svg v-if="darkMode" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          
          <!-- Wallet Connection Button -->
          <button 
            v-if="!isConnected"
            @click="connectWallet"
            class="btn-primary px-6 py-2 font-medium"
          >
            Connect Wallet
          </button>
          
          <!-- User Menu (when wallet connected) -->
          <div v-else class="relative">
            <button 
              @click="toggleUserMenu"
              class="flex items-center space-x-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <div class="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                <span class="text-white text-xs font-bold">{{ walletInitials }}</span>
              </div>
              <div class="hidden sm:block text-left">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ shortWalletAddress }}
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  {{ balance }}
                </div>
              </div>
              <svg class="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <!-- User Dropdown Menu -->
            <div 
              v-if="showUserMenu"
              class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
            >
              <router-link 
                to="/profile" 
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                @click="closeUserMenu"
              >
                Profile
              </router-link>
              <router-link 
                to="/portfolio" 
                class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                @click="closeUserMenu"
              >
                Portfolio
              </router-link>
              <hr class="my-1 border-gray-200 dark:border-gray-700">
              <button 
                @click="disconnectWallet"
                class="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Disconnect
              </button>
            </div>
          </div>
          
          <!-- Mobile Menu Button -->
          <button 
            @click="toggleMobileMenu"
            class="md:hidden p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Mobile Menu -->
    <div v-if="showMobileMenu" class="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 space-y-3">
        <!-- Mobile Search -->
        <div class="lg:hidden">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search tokens..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        
        <!-- Mobile Navigation Links -->
        <router-link 
          to="/" 
          class="block py-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
          @click="closeMobileMenu"
        >
          Home
        </router-link>
        <router-link 
          to="/create" 
          class="block py-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
          @click="closeMobileMenu"
        >
          Create Token
        </router-link>
        <router-link 
          to="/leaderboard" 
          class="block py-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
          @click="closeMobileMenu"
        >
          Leaderboard
        </router-link>
        <router-link 
          to="/about" 
          class="block py-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
          @click="closeMobileMenu"
        >
          About
        </router-link>
      </div>
    </div>
  </nav>
  
  <!-- Wallet Selection Modal -->
  <WalletModal 
    :is-open="showWalletModal"
    @close="showWalletModal = false"
    @connected="handleWalletConnected"
  />
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import WalletModal from '@/components/common/WalletModal.vue'

const authStore = useAuthStore()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const searchQuery = ref('')
const darkMode = ref(false)
const showMobileMenu = ref(false)
const showWalletModal = ref(false)

// Computed properties
const isConnected = computed(() => walletStore.isConnected)
const walletAddress = computed(() => walletStore.walletAddress)
const balance = computed(() => walletStore.formattedBalance)

// Reactive state
const showUserMenu = ref(false)

// Computed properties
const walletInitials = computed(() => {
  if (!walletAddress.value) return 'W'
  return walletAddress.value.slice(0, 2).toUpperCase()
})

const shortWalletAddress = computed(() => {
  if (!walletAddress.value) return ''
  return `${walletAddress.value.slice(0, 4)}...${walletAddress.value.slice(-4)}`
})

// Methods
const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  // TODO: Update UI store and apply dark mode
  if (darkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * Connect wallet
 * Opens wallet selection modal
 */
const connectWallet = () => {
  showWalletModal.value = true
}

/**
 * Disconnect wallet
 */
const disconnectWallet = async () => {
  try {
    await walletStore.disconnectWallet()
    await authStore.signOut()
    
    uiStore.showToast({
      type: 'success',
      title: '🔌 Wallet Disconnected Successfully',
      message: 'Your wallet has been safely disconnected'
    })
  } catch (error) {
    console.error('Failed to disconnect wallet:', error)
    uiStore.showToast({
      type: 'error',
      title: '❌ Disconnection Failed',
      message: 'Failed to disconnect wallet properly'
    })
  }
}

/**
 * Handle wallet connection success
 */
const handleWalletConnected = async (walletName) => {
  showWalletModal.value = false
  
  try {
    // Get wallet address from wallet store
    const currentWalletAddress = walletStore.walletAddress
    
    if (!currentWalletAddress) {
      throw new Error('Wallet connected but no address available')
    }
    
    // Sign in with the connected wallet
    await authStore.signInWithWallet(currentWalletAddress)
  } catch (error) {
    console.error('Failed to sign in with wallet:', error)
  }
}

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value
}

const closeMobileMenu = () => {
  showMobileMenu.value = false
}
</script>

<style scoped>
/* Active route styling */
.router-link-active {
  @apply text-primary-600 dark:text-primary-400 font-medium;
}

/* Navigation link hover effects */
.nav-link {
  @apply relative;
}

.nav-link:hover::after {
  content: '';
  @apply absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 transform scale-x-100;
}

.nav-link::after {
  content: '';
  @apply absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 transform scale-x-0 transition-transform duration-200;
}
</style> 