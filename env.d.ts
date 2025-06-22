/// <reference types="vite/client" />

// Type definitions for environment variables and Vue modules
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Environment variables interface for type safety
interface ImportMetaEnv {
  // i18n Configuration
  readonly VITE_I18N_LOCALE: string
  readonly VITE_I18N_FALLBACK_LOCALE: string
  readonly VITE_BASE_URL: string
  
  // Supabase Configuration
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  
  // Solana Configuration
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_SOLANA_NETWORK: 'devnet' | 'mainnet-beta'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 