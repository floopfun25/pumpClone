<template>
  <!-- Collapsible sidebar menu -->
  <div 
    class="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-trading-surface border-r border-binance-border transition-all duration-300 z-40 overflow-y-auto"
    :class="isCollapsed ? 'w-16' : 'w-64'"
  >
    <!-- Collapse/Expand Button -->
    <div class="p-4 border-b border-binance-border">
      <button
        @click="toggleCollapse"
        class="w-full flex items-center justify-center p-2 text-binance-gray hover:text-binance-yellow transition-colors rounded-lg hover:bg-trading-elevated"
        :class="isCollapsed ? 'justify-center' : 'justify-end'"
      >
        <svg 
          class="h-5 w-5 transition-transform duration-300"
          :class="isCollapsed ? 'rotate-180' : ''"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Menu Items -->
    <nav class="p-4 space-y-2">
      <!-- Profile -->
      <router-link
        v-if="walletStore.walletAddress"
        :to="`/profile/${walletStore.walletAddress}`"
        class="sidebar-item"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.profile') }}</span>
      </router-link>

      <!-- Portfolio -->
      <router-link
        to="/portfolio"
        class="sidebar-item"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.portfolio') }}</span>
      </router-link>

      <!-- Settings -->
      <router-link
        to="/settings"
        class="sidebar-item"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.settings') }}</span>
      </router-link>

      <!-- Separator -->
      <div class="border-t border-binance-border my-4"></div>

      <!-- Theme Toggle -->
      <button
        @click="toggleTheme"
        class="sidebar-item w-full"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
        :title="isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <svg v-if="!isDarkMode" class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg v-else class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">
          {{ isDarkMode ? t('theme.lightMode') : t('theme.darkMode') }}
        </span>
      </button>

      <!-- Language Selector -->
      <div class="relative">
        <button
          @click="toggleLanguageMenu"
          class="sidebar-item w-full"
          :class="isCollapsed ? 'justify-center' : 'justify-between'"
        >
          <div class="flex items-center">
            <span class="text-lg flex-shrink-0">{{ currentLanguage.flag }}</span>
            <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.language') }}</span>
          </div>
          <svg 
            v-if="!isCollapsed"
            class="h-4 w-4 transition-transform duration-200"
            :class="showLanguageMenu ? 'rotate-180' : ''"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Language Dropdown -->
        <div 
          v-if="showLanguageMenu && !isCollapsed"
          class="mt-2 bg-trading-elevated rounded-lg border border-binance-border py-2 max-h-48 overflow-y-auto"
        >
          <button
            v-for="language in supportedLanguages"
            :key="language.code"
            @click="changeLanguage(language.code)"
            class="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-trading-surface transition-colors"
            :class="{ 'bg-trading-surface text-binance-yellow': currentLanguage.code === language.code }"
          >
            <span class="text-base mr-2">{{ language.flag }}</span>
            <span class="font-medium">{{ language.name }}</span>
            <svg 
              v-if="currentLanguage.code === language.code"
              class="h-3 w-3 text-binance-yellow ml-auto"
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Collapsed Language Dropdown -->
        <div 
          v-if="showLanguageMenu && isCollapsed"
          class="absolute left-16 top-0 w-56 bg-trading-surface rounded-lg shadow-xl border border-binance-border py-2 z-50"
        >
          <div class="px-3 py-2 text-xs font-semibold text-binance-gray uppercase tracking-wider border-b border-binance-border">
            {{ t('navigation.selectLanguage') }}
          </div>
          <div class="max-h-64 overflow-y-auto">
            <button
              v-for="language in supportedLanguages"
              :key="language.code"
              @click="changeLanguage(language.code)"
              class="w-full flex items-center px-3 py-2 text-sm text-white hover:bg-trading-elevated transition-colors"
              :class="{ 'bg-trading-elevated text-binance-yellow': currentLanguage.code === language.code }"
            >
              <span class="text-lg mr-3">{{ language.flag }}</span>
              <div class="flex-1 text-left">
                <div class="font-medium">{{ language.name }}</div>
                <div class="text-xs text-binance-gray">{{ language.code.toUpperCase() }}</div>
              </div>
              <svg 
                v-if="currentLanguage.code === language.code"
                class="h-4 w-4 text-binance-yellow"
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  </div>

  <!-- Overlay for mobile -->
  <div 
    v-if="!isCollapsed && isMobile"
    class="fixed inset-0 bg-black bg-opacity-50 z-30"
    @click="collapseSidebar"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTypedI18n } from '@/i18n'
import { useUIStore } from '@/stores/ui'
import { useWalletStore } from '@/stores/wallet'
import { supportedLanguages, saveLanguage, getLanguageInfo, type LanguageCode } from '@/i18n'

const { t, locale } = useTypedI18n()
const uiStore = useUIStore()
const walletStore = useWalletStore()

// State
const showLanguageMenu = ref(false)
const isMobile = ref(false)

// Computed
const isDarkMode = computed(() => uiStore.isDarkMode)
const isCollapsed = computed(() => uiStore.isSidebarCollapsed)

const currentLanguage = computed(() => {
  try {
    return getLanguageInfo(locale.value as LanguageCode)
  } catch (error) {
    console.warn('Failed to get language info:', error)
    return { code: 'en' as LanguageCode, name: 'English', flag: '🇺🇸', rtl: false }
  }
})

// Methods
function toggleCollapse() {
  uiStore.toggleSidebar()
  showLanguageMenu.value = false
}

function collapseSidebar() {
  if (isMobile.value) {
    uiStore.setSidebarCollapsed(true)
    showLanguageMenu.value = false
  }
}

function toggleTheme() {
  uiStore.toggleDarkMode()
}

function toggleLanguageMenu() {
  showLanguageMenu.value = !showLanguageMenu.value
}

function changeLanguage(langCode: LanguageCode) {
  try {
    locale.value = langCode
    saveLanguage(langCode)
    showLanguageMenu.value = false
    
    // Apply RTL for Arabic
    const html = document.documentElement
    const langInfo = getLanguageInfo(langCode)
    
    if (langInfo.rtl) {
      html.setAttribute('dir', 'rtl')
      html.classList.add('rtl')
    } else {
      html.setAttribute('dir', 'ltr')
      html.classList.remove('rtl')
    }
  } catch (error) {
    console.error('Failed to change language:', error)
    showLanguageMenu.value = false
  }
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const sidebar = target.closest('.fixed.left-0')
  
  if (!sidebar && showLanguageMenu.value) {
    showLanguageMenu.value = false
  }
}

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value && !isCollapsed.value) {
    // Auto-collapse on mobile when opening
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleResize)
  handleResize()
  
  // Sidebar state initialization is now handled globally in App.vue
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.sidebar-item {
  @apply flex items-center p-3 text-binance-gray hover:text-white hover:bg-trading-elevated rounded-lg transition-all duration-200;
}

.sidebar-item.router-link-active {
  @apply text-binance-yellow bg-trading-elevated;
}

/* Smooth transitions */
.transition-all {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .fixed.left-0 {
    z-index: 50;
  }
}
</style> 