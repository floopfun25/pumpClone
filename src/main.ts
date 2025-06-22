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

// Enhanced initialization function
async function initializeApp() {
  try {
    const app = createApp(App)
    
    // Add error handler for Vue app
    app.config.errorHandler = (err, instance, info) => {
      console.error('🚨 Vue error:', err)
      console.error('Component:', instance)
      console.error('Error Info:', info)
    }
    
    // Initialize i18n first
    app.use(i18n)
    
    // Initialize Pinia
    const pinia = createPinia()
    app.use(pinia)
    
    // Initialize router last
    app.use(router)
    
    // Validate i18n is working
    try {
      const testKey = 'app.name'
      const translation = i18n.global.t(testKey)
      if (translation && translation !== testKey) {
        console.log('✅ i18n initialized successfully')
        console.log('🔍 i18n test translation successful')
      } else {
        throw new Error('i18n test translation failed')
      }
    } catch (error) {
      console.error('❌ i18n initialization failed:', error)
      // Continue app initialization even if i18n test fails
    }
    
    // Mount the application
    app.mount('#app')
    console.log('✅ Application mounted successfully')
  } catch (error) {
    console.error('❌ Application initialization failed:', error)
    // Show user-friendly error message
    const rootElement = document.getElementById('app')
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h1 style="color: #e53e3e; margin-bottom: 10px;">Application Error</h1>
          <p style="color: #4a5568;">Sorry, something went wrong while loading the application. Please try refreshing the page.</p>
        </div>
      `
    }
    throw error
  }
}

// Initialize the application
initializeApp().catch(error => {
  console.error('Fatal application error:', error)
}) 