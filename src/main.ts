// Import polyfills FIRST before anything else
import './polyfills'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

// Import global styles
import './style.css'

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', event.reason)
})

// Fallback translation function
const fallbackTranslation = (key: string, params?: any): string => {
  console.warn(`Translation missing for key: ${key}`)
  // Return the key itself as fallback
  return key.split('.').pop() || key
}

// Mount application with enhanced error handling
try {
  const app = createApp(App)
  
  // Add error handler for Vue app
  app.config.errorHandler = (err, instance, info) => {
    console.error('🚨 Vue error:', err, info)
  }
  
  // Add global mixin for fallback translation
  app.mixin({
    methods: {
      $t(key: string, params?: any) {
        try {
          // Try to use the i18n instance
          if (this.$i18n && typeof this.$i18n.t === 'function') {
            return this.$i18n.t(key, params)
          }
          // Fallback if i18n is not available
          return fallbackTranslation(key, params)
        } catch (error) {
          console.warn('Translation error:', error)
          return fallbackTranslation(key, params)
        }
      }
    }
  })
  
  // Initialize plugins in proper order
  app.use(createPinia())
  app.use(router)
  
  // Ensure i18n is properly initialized
  if (i18n && typeof i18n.install === 'function') {
    app.use(i18n)
    console.log('✅ i18n initialized successfully')
  } else {
    console.error('❌ i18n initialization failed - plugin not available')
  }
  
  app.mount('#app')
  console.log('✅ Application mounted successfully')
} catch (error) {
  console.error('❌ Failed to initialize application:', error)
} 