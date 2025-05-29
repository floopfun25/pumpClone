import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite configuration for FloppFun Vue.js application
export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? '/pumpClone/' : '/',
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
  // Define global constants and polyfills for the application
  define: {
    global: 'globalThis',
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  // Optimize dependencies for faster development
  optimizeDeps: {
    include: [
      '@solana/web3.js',
      '@solana/wallet-adapter-base',
      '@supabase/supabase-js',
      'buffer'
    ]
  }
}) 