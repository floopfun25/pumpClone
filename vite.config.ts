import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";

// Vite configuration for FloppFun Vue.js application
export default defineConfig({
  plugins: [
    vue({
      script: {
        defineModel: true,
        propsDestructure: true,
      },
    }),
  ],
  base: process.env.VITE_BASE_PATH || "/pumpClone/",
  resolve: {
    alias: {
      // Set up path alias for cleaner imports
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: true, // Important for Docker container access
    proxy: {}, // Proxies are now handled by Supabase Edge Functions
    hmr: {
      port: 3001,
    },
  },
  // Define global constants and polyfills for the application
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    "process.env": {},
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
  },
  // Optimize dependencies for faster development
  optimizeDeps: {
    include: [
      "@solana/web3.js",
      "@solana/wallet-adapter-base",
      "buffer",
      "vue-i18n",
    ],
  },
  build: {
    target: "esnext",
    minify: "terser",
    assetsDir: "assets",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          const extType = name.split(".").at(1) || "asset";
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/img/[name]-[hash][extname]`;
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (
              id.includes("vue") ||
              id.includes("vue-router") ||
              id.includes("pinia") ||
              id.includes("vue-i18n")
            ) {
              return "vendor";
            }
            if (id.includes("@solana/")) {
              return "solana";
            }
            if (id.includes("@headlessui/") || id.includes("@heroicons/")) {
              return "ui";
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
