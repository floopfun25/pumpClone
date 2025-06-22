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

// Enhanced initialization function
async function initializeApp() {
  try {
    const app = createApp(App)
    
    // Add error handler for Vue app
    app.config.errorHandler = (err, instance, info) => {
      console.error('🚨 Vue error:', err, info)
    }
    
    // Add global mixin for fallback translation with enhanced error handling
    app.mixin({
      methods: {
        $t(key: string, params?: any) {
          try {
            // Try to use the i18n instance
            if (this.$i18n && typeof this.$i18n.t === 'function') {
              return this.$i18n.t(key, params)
            }
            // Try to use global i18n instance
            if (i18n && i18n.global && typeof i18n.global.t === 'function') {
              return i18n.global.t(key, params)
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
    
    // Initialize plugins in proper order with validation
    app.use(createPinia())
    app.use(router)
    
    // Ensure i18n is properly initialized before proceeding
    if (i18n && typeof i18n.install === 'function') {
      try {
        app.use(i18n)
        console.log('✅ i18n initialized successfully')
        
        // Validate that i18n is working
        if (i18n.global && typeof i18n.global.t === 'function') {
          const testTranslation = i18n.global.t('app.name')
          console.log('🔍 i18n test translation:', testTranslation)
        }
      } catch (error) {
        console.error('❌ i18n installation failed:', error)
        throw error
      }
    } else {
      console.error('❌ i18n initialization failed - plugin not available')
      throw new Error('i18n plugin not available')
    }
    
    // Mount the application
    app.mount('#app')
    console.log('✅ Application mounted successfully')
    console.log('App initialized successfully')
    
  } catch (error) {
    console.error('❌ Failed to initialize application:', error)
    
    // Try to show a basic error message to the user
    const appElement = document.getElementById('app')
    if (appElement) {
      appElement.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
          <h1 style="color: #ef4444; margin-bottom: 1rem;">Application Error</h1>
          <p style="color: #6b7280; margin-bottom: 2rem;">Failed to initialize the application. Please refresh the page.</p>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 0.5rem 1rem; border: none; border-radius: 0.375rem; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      `
    }
  }
}

// Initialize the application
initializeApp() 