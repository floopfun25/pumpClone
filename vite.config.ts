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
    __VUE_I18N_FULL_INSTALL__: JSON.stringify(true),
    __VUE_I18N_LEGACY_API__: JSON.stringify(false),
    __INTLIFY_PROD_DEVTOOLS__: JSON.stringify(false),
    __VUE_I18N_RUNTIME_ONLY__: JSON.stringify(false),
    __VUE_I18N_BUNDLED_LOCALE_MESSAGES__: JSON.stringify(true),
    __VUE_I18N_PROD_MESSAGES__: JSON.stringify(true)
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
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            // Bundle all Vue-related packages together
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia') || id.includes('vue-i18n')) {
              return 'vendor'
            }
            if (id.includes('@solana/')) {
              return 'solana'
            }
            if (id.includes('@headlessui/') || id.includes('@heroicons/')) {
              return 'ui'
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
}) 