import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Import global styles
import './style.css'

// Create the Vue.js application instance
const app = createApp(App)

// Configure state management with Pinia
// Pinia provides reactive state management for the entire application
const pinia = createPinia()
app.use(pinia)

// Configure routing with Vue Router
// Handles navigation between different pages/views
app.use(router)

// Mount the application to the DOM
// This starts the Vue.js application and renders it to the #app element
app.mount('#app') 