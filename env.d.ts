/// <reference types="vite/client" />

// Type definitions for environment variables and Vue modules
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Environment variables interface for type safety
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SOLANA_RPC_URL: string
  readonly VITE_SOLANA_NETWORK: 'devnet' | 'mainnet-beta'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 