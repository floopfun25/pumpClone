// Global imports
import './style.css'
import './polyfills'

// Core Vue imports
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// i18n
import { i18n } from './i18n'

// Stores
import { createPinia } from 'pinia'

// Main app creation function
async function createVueApp() {
  try {
    // Check for Phantom wallet response before creating the app
    // Import handlePhantomConnectResponse from wallet service
    try {
      const { handlePhantomConnectResponse } = await import('./services/wallet')
      handlePhantomConnectResponse()
    } catch (error) {
      console.log('Phantom response handler not available:', error)
    }
    
    // Create the Vue app
    const app = createApp(App)
    
    // Install global error handler
    app.config.errorHandler = (err, instance, info) => {
      console.error('Vue error:', err)
      if (import.meta.env.DEV) {
        console.error('Component:', instance)
        console.error('Error Info:', info)
      }
    }
    
    // Install plugins
    app.use(createPinia())
    app.use(router)
    app.use(i18n)
    
    // Mount the app
    app.mount('#app')
    
    if (import.meta.env.DEV) {
      console.log('✅ Application mounted successfully')
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error)
    
    // Show fallback error UI
    const appElement = document.getElementById('app')
    if (appElement) {
      appElement.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 2rem;
          background: #0c0c0c;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
          <div style="text-align: center; max-width: 500px;">
            <h1 style="color: #f0b90b; margin-bottom: 1rem;">Application Error</h1>
            <p style="color: #a0a0a0; margin-bottom: 2rem;">
              Failed to initialize the application. Please refresh the page or try again later.
            </p>
            <button 
              onclick="window.location.reload()" 
              style="
                background: #f0b90b;
                color: #000;
                border: none;
                padding: 0.75rem 2rem;
                border-radius: 0.5rem;
                font-weight: 600;
                cursor: pointer;
              "
            >
              Refresh Page
            </button>
          </div>
        </div>
      `
    }
  }
}

// Handle Phantom wallet response
function handlePhantomResponse() {
  const urlParams = new URLSearchParams(window.location.search)
  const phantomAction = urlParams.get('phantom_action')
  
  if (phantomAction === 'connect') {
    console.log('🔗 Phantom connect response detected')
    
    try {
      // Import and execute the response handler
      import('./services/wallet').then(({ handlePhantomConnectResponse }) => {
        handlePhantomConnectResponse()
        
        // Clean up URL after handling
        const cleanUrl = window.location.origin + window.location.pathname
        window.history.replaceState({}, document.title, cleanUrl)
        
        console.log('✅ Phantom response handled successfully')
      }).catch(error => {
        console.error('❌ Failed to handle Phantom response:', error)
      })
      
    } catch (error) {
      console.error('❌ Error processing Phantom response:', error)
    }
  }
}

// Initialize the app
createVueApp() 