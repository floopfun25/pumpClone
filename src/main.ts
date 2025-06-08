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

// Mount application
try {
  const app = createApp(App)
  
  app.use(createPinia())
  app.use(router)
  app.use(i18n)
  
  app.mount('#app')
} catch (error) {
  console.error('❌ Failed to initialize application:', error)
} 