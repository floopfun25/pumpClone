// Import polyfills FIRST before anything else
import './polyfills'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Import global styles
import './style.css'

// Add global error handling
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', event.reason)
})

try {
  console.log('🚀 Starting FloppFun application...')
  
  // Create Vue application instance
  const app = createApp(App)

  // Setup Pinia state management
  app.use(createPinia())

  // Setup Vue Router
  app.use(router)

  // Mount application to the DOM
  app.mount('#app')
  
  console.log('✅ FloppFun application mounted successfully')
} catch (error) {
  console.error('❌ Failed to initialize application:', error)
  
  // Show a user-friendly error message
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; font-family: Arial, sans-serif;">
      <h1 style="color: #dc2626;">Application Error</h1>
      <p>FloppFun failed to load. Please refresh the page.</p>
      <p style="color: #6b7280; font-size: 14px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      <button onclick="window.location.reload()" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
        Refresh Page
      </button>
    </div>
  `
} 