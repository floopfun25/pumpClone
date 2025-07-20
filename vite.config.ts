import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'path'

// Vite configuration for FloppFun Vue.js application
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true
      }
    })
  ],
  base: process.env.VITE_BASE_PATH || '/pumpClone/',
  resolve: {
    alias: {
      // Set up path alias for cleaner imports
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    host: true, // Important for Docker container access
    proxy: {
      // DISABLED: CoinGecko proxy (SSL/TLS issues in network environment)
      // Using direct alternative APIs instead (CoinPaprika, CoinLore)
      /*
      '/api/coingecko': {
        target: process.env.VITE_COINGECKO_API_URL || 'https://api.coingecko.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coingecko/, ''),
        secure: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        }
      },
      */
      // Proxy CoinPaprika API (alternative, more reliable)
      '/api/coinpaprika': {
        target: process.env.VITE_COINPAPRIKA_API_URL || 'https://api.coinpaprika.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/coinpaprika/, ''),
        secure: true,
        headers: {
          'Accept': 'application/json'
        }
      },
      // DISABLED: Jupiter proxy (DNS resolution fails in network environment)
      // App now uses alternative APIs directly (CoinPaprika works!)
      /*
      '/api/jupiter': {
        target: process.env.VITE_JUPITER_API_URL || 'https://price.jup.ag/v6',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/jupiter/, ''),
        secure: true,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FloppFun/1.0.0'
        }
      },
      */
      // Proxy Birdeye API calls  
      '/api/birdeye': {
        target: process.env.VITE_BIRDEYE_API_URL || 'https://public-api.birdeye.so/defi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/birdeye/, ''),
        secure: true,
        headers: {
          'User-Agent': 'FloppFun/1.0.0'
        }
      }
    },
    hmr: {
      port: 3001
    }
  },
  // Define global constants and polyfills for the application
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
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
    assetsDir: 'assets',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          const extType = name.split('.').at(1) || 'asset';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/img/[name]-[hash][extname]`;
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia') || id.includes('vue-i18n')) {
              return 'vendor';
            }
            if (id.includes('@solana/')) {
              return 'solana';
            }
            if (id.includes('@headlessui/') || id.includes('@heroicons/')) {
              return 'ui';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
}) 