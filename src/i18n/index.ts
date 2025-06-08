import { createI18n } from 'vue-i18n'

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

// Supported languages with their metadata
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
]

// Get browser language or fallback to English
function getBrowserLanguage(): string {
  const navigatorLang = navigator.language || (navigator as any).userLanguage
  const langCode = navigatorLang.split('-')[0].toLowerCase()
  
  // Check if we support this language
  const supportedLangCodes = supportedLanguages.map(lang => lang.code)
  return supportedLangCodes.includes(langCode) ? langCode : 'en'
}

// Get saved language from localStorage or detect browser language
function getInitialLanguage(): string {
  try {
    const savedLang = localStorage.getItem('floppfun-language')
    if (savedLang && supportedLanguages.some(lang => lang.code === savedLang)) {
      return savedLang
    }
  } catch (error) {
    console.warn('Failed to read language from localStorage:', error)
  }
  
  return getBrowserLanguage()
}

// Save language to localStorage
export function saveLanguage(langCode: string): void {
  try {
    localStorage.setItem('floppfun-language', langCode)
  } catch (error) {
    console.warn('Failed to save language to localStorage:', error)
  }
}

// Get language metadata
export function getLanguageInfo(langCode: string) {
  return supportedLanguages.find(lang => lang.code === langCode) || supportedLanguages[0]
}

// Create i18n instance
const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: getInitialLanguage(),
  fallbackLocale: 'en',
  globalInjection: true,
  messages: {
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
})

export default i18n 