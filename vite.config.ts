import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite configuration for the pump.fun clone Vue.js application
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Set up path alias for cleaner imports
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: true, // Important for Docker container access
    hmr: {
      port: 3001
    }
  },
  // Define global constants for the application
  define: {
    global: 'globalThis',
  },
  // Optimize dependencies for faster development
  optimizeDeps: {
    include: [
      '@solana/web3.js',
      '@solana/wallet-adapter-base',
      '@supabase/supabase-js'
    ]
  }
}) 