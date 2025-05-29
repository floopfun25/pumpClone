// Application configuration with environment variables and constants

// Environment variable validation and fallbacks
const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key]
  if (!value && !fallback) {
    console.error(`Missing required environment variable: ${key}`)
    throw new Error(`Environment variable ${key} is required`)
  }
  return value || fallback!
}

export const config = {
  // Supabase configuration for backend integration
  supabase: {
    url: getEnvVar('VITE_SUPABASE_URL', 'https://osqniqjbbenjmhehoykv.supabase.co'),
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcW5pcWpiYmVuam1oZWhveWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NDM5NzYsImV4cCI6MjA2NDExOTk3Nn0.hHkHKivLHqOx4Ne9Bn9BOb6dAsCh_StBJ0YHGw0qwOc')
  },
  
  // Solana blockchain configuration
  solana: {
    rpcUrl: getEnvVar('VITE_SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
    network: getEnvVar('VITE_SOLANA_NETWORK', 'mainnet-beta'),
    commitment: 'confirmed' as const
  },
  
  // Application constants
  app: {
    name: 'FloppFun',
    version: '1.0.0',
    description: 'Create and trade meme tokens on Solana'
  },
  
  // Token creation defaults
  tokenDefaults: {
    decimals: 9,
    totalSupply: 1_000_000_000, // 1 billion tokens
    graduationThreshold: 69_000_000_000, // 69 SOL in lamports
    platformFeePercentage: 1.0, // 1% platform fee
    creationFee: 0.02 // 0.02 SOL creation fee
  },
  
  // Bonding curve configuration
  bondingCurve: {
    initialVirtualTokenReserves: 1_073_000_000_000_000, // ~1.073M tokens
    initialVirtualSolReserves: 30_000_000_000, // 30 SOL in lamports
    initialRealSolReserves: 0, // Start with 0 real SOL
  },
  
  // UI configuration
  ui: {
    itemsPerPage: 20,
    chartUpdateInterval: 5000, // 5 seconds
    priceUpdateInterval: 3000, // 3 seconds
    toastDuration: 5000 // 5 seconds
  }
} as const

// Export individual configurations for easier imports
export const {
  supabase: supabaseConfig,
  solana: solanaConfig,
  app: appConfig,
  tokenDefaults,
  bondingCurve: bondingCurveConfig,
  ui: uiConfig
} = config

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('🔧 Configuration loaded:', {
    supabaseUrl: supabaseConfig.url,
    solanaNetwork: solanaConfig.network,
    solanaRpc: solanaConfig.rpcUrl
  })
} 