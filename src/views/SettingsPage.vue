<template>
  <div class="min-h-screen bg-binance-dark">
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-4xl mx-auto">
        <!-- Page Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-white mb-2">{{ t('navigation.settings') }}</h1>
          <p class="text-binance-gray">{{ t('settings.description') }}</p>
        </div>

        <!-- Settings Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <!-- Security Testing (Development) -->
          <div v-if="isDevelopment" class="md:col-span-2 bg-trading-surface rounded-lg border border-yellow-500 p-6">
            <div class="flex items-center gap-2 mb-4">
              <div class="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
              <h2 class="text-xl font-semibold text-white">🔐 Security Testing (Development)</h2>
            </div>
            <p class="text-yellow-400 text-sm mb-4">
              This section is only visible in development mode for testing the new secure authentication system.
            </p>
            <SecureAuthTest />
          </div>
          <!-- General Settings -->
          <div class="bg-trading-surface rounded-lg border border-binance-border p-6">
            <h2 class="text-xl font-semibold text-white mb-4">{{ t('settings.general') }}</h2>
            
            <!-- Theme Setting -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-white font-medium">{{ t('settings.theme') }}</label>
                  <p class="text-sm text-binance-gray">{{ t('settings.themeDescription') }}</p>
                </div>
                <button
                  @click="toggleTheme"
                  class="flex items-center space-x-2 px-4 py-2 bg-binance-border hover:bg-binance-yellow hover:text-binance-dark rounded-lg transition-colors"
                >
                  <svg v-if="!isDarkMode" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span>{{ isDarkMode ? t('theme.lightMode') : t('theme.darkMode') }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Language Settings -->
          <div class="bg-trading-surface rounded-lg border border-binance-border p-6">
            <h2 class="text-xl font-semibold text-white mb-4">{{ t('settings.language') }}</h2>
            
            <div class="space-y-4">
              <div>
                <label class="text-white font-medium block mb-2">{{ t('settings.selectLanguage') }}</label>
                <div class="space-y-2">
                  <button
                    v-for="language in supportedLanguages"
                    :key="language.code"
                    @click="changeLanguage(language.code)"
                    class="w-full flex items-center justify-between p-3 rounded-lg border border-binance-border hover:border-binance-yellow transition-colors"
                    :class="currentLanguage.code === language.code ? 'border-binance-yellow bg-binance-yellow/10' : ''"
                  >
                    <div class="flex items-center space-x-3">
                      <span class="text-xl">{{ language.flag }}</span>
                      <span class="text-white font-medium">{{ language.name }}</span>
                    </div>
                    <svg 
                      v-if="currentLanguage.code === language.code"
                      class="h-5 w-5 text-binance-yellow"
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Notifications -->
          <div class="bg-trading-surface rounded-lg border border-binance-border p-6">
            <h2 class="text-xl font-semibold text-white mb-4">{{ t('settings.notifications') }}</h2>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-white font-medium">{{ t('settings.priceAlerts') }}</label>
                  <p class="text-sm text-binance-gray">{{ t('settings.priceAlertsDescription') }}</p>
                </div>
                <button class="toggle-switch">
                  <span class="toggle-slider"></span>
                </button>
              </div>
              
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-white font-medium">{{ t('settings.newTokens') }}</label>
                  <p class="text-sm text-binance-gray">{{ t('settings.newTokensDescription') }}</p>
                </div>
                <button class="toggle-switch">
                  <span class="toggle-slider"></span>
                </button>
              </div>
            </div>
          </div>

          <!-- About -->
          <div class="bg-trading-surface rounded-lg border border-binance-border p-6">
            <h2 class="text-xl font-semibold text-white mb-4">{{ t('settings.about') }}</h2>
            
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-binance-gray">{{ t('settings.version') }}</span>
                <span class="text-white font-medium">v1.0.0</span>
              </div>
              
              <div class="space-y-2">
                <a href="#" class="block text-binance-yellow hover:text-binance-yellow-dark transition-colors">
                  {{ t('settings.termsOfService') }}
                </a>
                <a href="#" class="block text-binance-yellow hover:text-binance-yellow-dark transition-colors">
                  {{ t('settings.privacyPolicy') }}
                </a>
                <a href="#" class="block text-binance-yellow hover:text-binance-yellow-dark transition-colors">
                  {{ t('settings.support') }}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTypedI18n } from '@/i18n'
import { useUIStore } from '@/stores/ui'
import { supportedLanguages, saveLanguage, getLanguageInfo, type LanguageCode } from '@/i18n'
import SecureAuthTest from '@/components/debug/SecureAuthTest.vue'

const { t, locale } = useTypedI18n()
const uiStore = useUIStore()

// Computed properties
const isDarkMode = computed(() => uiStore.isDarkMode)

const isDevelopment = computed(() => import.meta.env.DEV)

const currentLanguage = computed(() => {
  try {
    return getLanguageInfo(locale.value as LanguageCode)
  } catch (error) {
    console.warn('Failed to get language info:', error)
    return { code: 'en' as LanguageCode, name: 'English', flag: '🇺🇸', rtl: false }
  }
})

// Methods
function toggleTheme() {
  uiStore.toggleDarkMode()
}

function changeLanguage(langCode: LanguageCode) {
  try {
    locale.value = langCode
    saveLanguage(langCode)
    
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
  }
}
</script>

<style scoped>
.toggle-switch {
  @apply relative inline-flex h-6 w-11 items-center rounded-full bg-binance-border transition-colors focus:outline-none focus:ring-2 focus:ring-binance-yellow focus:ring-offset-2;
}

.toggle-switch.active {
  @apply bg-binance-yellow;
}

.toggle-slider {
  @apply inline-block h-4 w-4 transform rounded-full bg-white transition-transform;
}

.toggle-switch.active .toggle-slider {
  @apply translate-x-5;
}
</style> 