import { createI18n } from 'vue-i18n'

// Import all language files with error handling
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
  try {
    const navigatorLang = (typeof navigator !== 'undefined' && navigator.language) || 'en'
    const langCode = navigatorLang.split('-')[0].toLowerCase()
    
    // Check if we support this language
    const supportedLangCodes = supportedLanguages.map(lang => lang.code)
    return supportedLangCodes.includes(langCode) ? langCode : 'en'
  } catch (error) {
    console.warn('Failed to detect browser language:', error)
    return 'en'
  }
}

// Get saved language from localStorage or detect browser language
function getInitialLanguage(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const savedLang = localStorage.getItem('floppfun-language')
      if (savedLang && supportedLanguages.some(lang => lang.code === savedLang)) {
        return savedLang
      }
    }
  } catch (error) {
    console.warn('Failed to read language from localStorage:', error)
  }
  
  return getBrowserLanguage()
}

// Save language to localStorage
export function saveLanguage(langCode: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('floppfun-language', langCode)
    }
  } catch (error) {
    console.warn('Failed to save language to localStorage:', error)
  }
}

// Get language metadata
export function getLanguageInfo(langCode: string) {
  return supportedLanguages.find(lang => lang.code === langCode) || supportedLanguages[0]
}

// Comprehensive fallback messages for production builds
const fallbackMessages = {
  app: { name: 'FloppFun', tagline: 'The Ultimate Meme Token Launchpad' },
  navigation: { home: 'Home', create: 'Create Token', leaderboard: 'Leaderboard', about: 'About' },
  wallet: { connect: 'Connect Wallet' },
  search: { placeholder: 'Search tokens...' },
  footer: { 
    description: 'The easiest way to create and trade meme tokens on Solana', 
    platform: 'Platform', 
    resources: 'Resources', 
    documentation: 'Documentation', 
    api: 'API', 
    copyright: '© 2024 FloppFun' 
  },
  common: { loading: 'Loading...', browse: 'Browse', all: 'All', back: 'Back' },
  token: { trending: 'Trending', tokens: 'Tokens', graduated: 'Graduated' },
  dashboard: { stats: { totalTokens: 'Total Tokens', totalVolume: 'Total Volume', totalUsers: 'Total Users' } },
  messages: { 
    info: { 
      launchDescription: 'Launch your own token with fair launch bonding curves',
      trendingDescription: 'Discover the hottest meme tokens',
      browseDescription: 'Browse all available tokens'
    } 
  },
  error: { pageNotFound: 'Page Not Found', pageNotFoundDescription: 'The page you\'re looking for doesn\'t exist' }
}

// Prepare messages object with validation and proper fallbacks
const messages: Record<string, any> = {
  en: en || fallbackMessages,
  es: es || {},
  zh: zh || {},
  hi: hi || {},
  ar: ar || {},
  pt: pt || {},
  bn: bn || {},
  ru: ru || {},
  fr: fr || {},
  tr: tr || {}
}

// Validate that at least English messages exist and are complete
if (!messages.en || Object.keys(messages.en).length === 0) {
  console.error('English locale messages are missing or empty!')
  messages.en = fallbackMessages
}

// Additional validation for critical keys
const requiredKeys = ['app.name', 'navigation.home', 'wallet.connect', 'search.placeholder']
for (const key of requiredKeys) {
  const keyPath = key.split('.')
  let current = messages.en
  for (const part of keyPath) {
    if (!current || !current[part]) {
      console.warn(`Missing required translation key: ${key}`)
      // Add the missing key with a fallback
      if (!current) current = {}
      if (keyPath.length === 2) {
        if (!current[keyPath[0]]) current[keyPath[0]] = {}
        current[keyPath[0]][keyPath[1]] = keyPath[1]
      }
      break
    }
    current = current[part]
  }
}

// Create i18n instance with robust configuration
const i18n = createI18n({
  legacy: true, // Use Options API
  locale: getInitialLanguage(),
  fallbackLocale: 'en',
  globalInjection: true,
  silentTranslationWarn: true, // Reduce console noise in production
  silentFallbackWarn: true,
  messages,
  // Ensure proper handling of missing keys
  missingWarn: false,
  fallbackWarn: false,
  // Add warnHtmlMessage to avoid HTML warnings in production
  warnHtmlMessage: false
})

export default i18n 