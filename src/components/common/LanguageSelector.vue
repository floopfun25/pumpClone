<template>
  <div class="relative">
    <!-- Language selector button -->
    <button 
      @click="toggleLanguageMenu"
      class="p-2 text-binance-gray hover:text-binance-yellow transition-colors rounded-lg hover:bg-binance-border/30 flex items-center space-x-1"
      :title="t('navigation.settings')"
    >
      <span class="text-lg">{{ currentLanguage.flag }}</span>
      <span class="text-sm font-medium hidden sm:block">{{ currentLanguage.code.toUpperCase() }}</span>
      <svg class="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    <!-- Language dropdown menu -->
    <div 
      v-if="showLanguageMenu"
      class="absolute right-0 mt-2 w-56 bg-trading-surface rounded-lg shadow-xl border border-binance-border py-2 z-50 backdrop-blur-lg"
    >
      <div class="px-3 py-2 text-xs font-semibold text-binance-gray uppercase tracking-wider border-b border-binance-border">
        Select Language
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTypedI18n } from '@/i18n'
import { supportedLanguages, saveLanguage, getLanguageInfo, type LanguageCode } from '@/i18n'

const { t, locale } = useTypedI18n()
const showLanguageMenu = ref(false)

const currentLanguage = computed(() => {
  try {
    return getLanguageInfo(locale.value as LanguageCode)
  } catch (error) {
    console.warn('Failed to get language info:', error)
    return { code: 'en' as LanguageCode, name: 'English', flag: '🇺🇸', rtl: false }
  }
})

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
  if (!target.closest('.relative')) {
    showLanguageMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // Set initial RTL state
  try {
    const currentLangInfo = getLanguageInfo(locale.value)
    const html = document.documentElement
    
    if (currentLangInfo.rtl) {
      html.setAttribute('dir', 'rtl')
      html.classList.add('rtl')
    } else {
      html.setAttribute('dir', 'ltr')
      html.classList.remove('rtl')
    }
  } catch (error) {
    console.warn('Failed to set initial RTL state:', error)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* Ensure smooth transitions for the dropdown */
.backdrop-blur-lg {
  backdrop-filter: blur(16px);
}

/* RTL support styles */
:global(.rtl) .absolute.right-0 {
  right: auto;
  left: 0;
}
</style> 