<template>
  <!-- Main navigation bar with Binance theme -->
  <nav class="nav-binance sticky top-0 z-50">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo and Brand -->
        <router-link to="/leaderboard" class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-gold-gradient rounded-lg flex items-center justify-center glow-gold">
            <span class="text-binance-dark font-bold text-sm">F</span>
          </div>
          <span class="text-xl font-bold text-white text-shadow">
            {{ t('app.name') }}
          </span>
        </router-link>
        
        <!-- Desktop Navigation Links -->
        <div class="hidden md:flex items-center space-x-8">
          <router-link 
            to="/create" 
            class="nav-link text-white hover:text-binance-yellow transition-colors font-medium"
          >
            {{ t('navigation.create') }}
          </router-link>
          <router-link 
            to="/leaderboard" 
            class="nav-link text-white hover:text-binance-yellow transition-colors font-medium"
          >
            {{ t('navigation.leaderboard') }}
          </router-link>
          <router-link 
            to="/about" 
            class="nav-link text-white hover:text-binance-yellow transition-colors font-medium"
          >
            {{ t('navigation.about') }}
          </router-link>
        </div>
        
        <!-- Right Side Actions -->
        <div class="flex items-center space-x-4">
          <!-- Wallet Connection Button -->
          <button 
            v-if="!isConnected"
            @click="connectWallet"
            class="btn-primary px-6 py-2 font-semibold"
          >
            {{ t('wallet.connect') }}
          </button>
          
          <!-- User Menu (when wallet connected) -->
          <div v-else class="relative">
            <button 
              @click="toggleUserMenu"
              class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-trading-elevated hover:bg-binance-border/30 transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-binance-yellow to-primary-600 flex items-center justify-center text-black font-bold text-sm">
                {{ walletInitials }}
              </div>
              <span class="text-white font-medium">{{ shortWalletAddress }}</span>
              <svg class="w-4 h-4 text-binance-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- User Dropdown Menu -->
            <div 
              v-if="showUserMenu"
              class="absolute right-0 mt-2 w-48 bg-trading-surface rounded-lg shadow-xl border border-binance-border py-2"
            >
              <router-link 
                to="/portfolio" 
                class="block px-4 py-2 text-white hover:bg-trading-elevated transition-colors"
                @click="closeUserMenu"
              >
                {{ t('navigation.portfolio') }}
              </router-link>
              <router-link 
                to="/settings" 
                class="block px-4 py-2 text-white hover:bg-trading-elevated transition-colors"
                @click="closeUserMenu"
              >
                {{ t('navigation.settings') }}
              </router-link>
              <button 
                @click="disconnectWallet"
                class="w-full text-left px-4 py-2 text-red-500 hover:bg-trading-elevated transition-colors"
              >
                {{ t('wallet.disconnect') }}
              </button>
            </div>
          </div>

          <!-- Theme Toggle -->
          <button 
            @click="toggleTheme"
            class="p-2 text-binance-gray hover:text-binance-yellow transition-colors rounded-lg hover:bg-binance-border/30"
            :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="!isDarkMode" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          
          <!-- Language Selector - Moved to topmost right -->
          <LanguageSelector />
          
          <!-- Mobile Menu Button -->
          <button 
            @click="toggleMobileMenu"
            class="md:hidden p-2 text-binance-gray hover:text-binance-yellow transition-colors"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Mobile Menu -->
    <div v-if="showMobileMenu" class="md:hidden bg-trading-surface border-t border-binance-border">
      <div class="px-4 py-3 space-y-3">
        <!-- Mobile Navigation Links -->
        <router-link 
          to="/create" 
          class="block py-2 text-white hover:text-binance-yellow transition-colors"
          @click="closeMobileMenu"
        >
          {{ t('navigation.create') }}
        </router-link>
        <router-link 
          to="/leaderboard" 
          class="block py-2 text-white hover:text-binance-yellow transition-colors"
          @click="closeMobileMenu"
        >
          {{ t('navigation.leaderboard') }}
        </router-link>
        <router-link 
          to="/about" 
          class="block py-2 text-white hover:text-binance-yellow transition-colors"
          @click="closeMobileMenu"
        >
          {{ t('navigation.about') }}
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

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTypedI18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import WalletModal from '@/components/common/WalletModal.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'

// Get i18n composable
const { t } = useTypedI18n()
const authStore = useAuthStore()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const showMobileMenu = ref(false)
const showWalletModal = ref(false)
const showUserMenu = ref(false)

// Computed properties
const isConnected = computed(() => walletStore.isConnected)
const walletAddress = computed(() => walletStore.walletAddress)
const balance = computed(() => walletStore.formattedBalance)
const isDarkMode = computed(() => uiStore.isDarkMode)
const walletInitials = computed(() => {
  if (!walletAddress.value) return 'W'
  return walletAddress.value.slice(0, 2).toUpperCase()
})
const shortWalletAddress = computed(() => {
  if (!walletAddress.value) return ''
  return `${walletAddress.value.slice(0, 6)}...${walletAddress.value.slice(-4)}`
})

// Methods
const connectWallet = () => {
  showWalletModal.value = true
}

const handleWalletConnected = () => {
  showWalletModal.value = false
}

const disconnectWallet = async () => {
  await walletStore.disconnectWallet()
  showUserMenu.value = false
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

const toggleTheme = () => {
  uiStore.toggleDarkMode()
}
</script>

<style scoped>
.nav-binance {
  @apply bg-trading-surface border-b border-binance-border;
  backdrop-filter: blur(8px);
}

.glow-gold {
  box-shadow: 0 0 15px rgba(241, 185, 11, 0.3);
}

.text-shadow {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style> 