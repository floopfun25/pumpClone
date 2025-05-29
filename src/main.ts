// Import polyfills FIRST before anything else
import './polyfills'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Import global styles
import './style.css'

// Create Vue application instance
const app = createApp(App)

// Setup Pinia state management
app.use(createPinia())

// Setup Vue Router
app.use(router)

// Mount application to the DOM
app.mount('#app') 