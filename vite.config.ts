import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'path'

// Vite configuration for FloppFun Vue.js application
export default defineConfig({
  plugins: [vue()],
  base: '/pumpClone/',
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
    // Vue i18n feature flags for production build
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  // Optimize dependencies for faster development
  optimizeDeps: {
    include: [
      '@solana/web3.js',
      '@solana/wallet-adapter-base',
      '@supabase/supabase-js',
      'buffer',
      'vue-i18n'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          i18n: ['vue-i18n'],
          solana: ['@solana/web3.js', '@solana/wallet-adapter-base', '@solana/wallet-adapter-phantom', '@solana/wallet-adapter-solflare'],
          ui: ['@headlessui/vue', '@heroicons/vue']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
}) 