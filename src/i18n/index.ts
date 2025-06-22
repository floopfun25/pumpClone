import { createI18n } from 'vue-i18n'
import type { I18n, Locale } from 'vue-i18n'
import { useI18n } from 'vue-i18n'

// Import all language files
import en from './locales/en.json'
import es from './locales/es.json'
import zh from './locales/zh.json'
import hi from './locales/hi.json'
import ar from './locales/ar.json'
import pt from './locales/pt.json'
import bn from './locales/bn.json'
import ru from './locales/ru.json'
import fr from './locales/fr.json'
import tr from './locales/tr.json'

// Define supported languages with their metadata
export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸', rtl: false },
  { code: 'es', name: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'zh', name: '中文', flag: '🇨🇳', rtl: false },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', rtl: false },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'pt', name: 'Português', flag: '🇧🇷', rtl: false },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩', rtl: false },
  { code: 'ru', name: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'fr', name: 'Français', flag: '🇫🇷', rtl: false },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', rtl: false }
] as const

// Type for language codes
type LanguageCode = (typeof supportedLanguages)[number]['code']

// Get initial language from localStorage or browser
export function getInitialLanguage(): LanguageCode {
  try {
    // Try to get language from localStorage
    const savedLang = localStorage.getItem('language')
    if (savedLang && isValidLanguageCode(savedLang)) {
      return savedLang as LanguageCode
    }
    
    // Try to get language from browser
    const browserLang = navigator.language.split('-')[0]
    if (isValidLanguageCode(browserLang)) {
      return browserLang as LanguageCode
    }
  } catch (error) {
    console.warn('Failed to get initial language:', error)
  }
  
  // Default to English
  return 'en'
}

// Type guard for language codes
function isValidLanguageCode(code: string): code is LanguageCode {
  return supportedLanguages.some(lang => lang.code === code)
}

// Save language preference
export function saveLanguage(lang: LanguageCode): void {
  try {
    localStorage.setItem('language', lang)
  } catch (error) {
    console.warn('Failed to save language preference:', error)
  }
}

// Get language info by code
export function getLanguageInfo(code: string) {
  const lang = supportedLanguages.find(l => l.code === code)
  return lang || supportedLanguages[0] // Default to English if not found
}

// Create messages object with type safety
const messages = {
  en,
  es,
  zh,
  hi,
  ar,
  pt,
  bn,
  ru,
  fr,
  tr
}

// Create i18n instance with strict type checking
export const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getInitialLanguage(),
  fallbackLocale: 'en',
  messages,
  globalInjection: true,
  allowComposition: true,
  runtimeOnly: false,
  missingWarn: false, // Disable warnings in production
  fallbackWarn: false, // Disable warnings in production
  warnHtmlMessage: false, // Disable HTML warnings
  silentTranslationWarn: true, // Silent in production
  silentFallbackWarn: true, // Silent in production
  pluralizationRules: {
    // Add custom pluralization rules for languages that need them
    ar: (choice: number) => {
      // Arabic has 6 plural forms
      if (choice === 0) return 0
      if (choice === 1) return 1
      if (choice === 2) return 2
      if (choice >= 3 && choice <= 10) return 3
      if (choice >= 11 && choice <= 99) return 4
      return 5
    }
  }
})

// Export type-safe composer
export type MessageSchema = typeof en
export type TypedI18n = typeof i18n
export type TypedComposer = ReturnType<typeof useI18n>

// Export for use in app
export default i18n 