// Application configuration with environment variables and constants
export const config = {
  // Supabase configuration for backend integration
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY
  },
  
  // Solana blockchain configuration
  solana: {
    rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL,
    network: import.meta.env.VITE_SOLANA_NETWORK,
    commitment: 'confirmed' as const
  },
  
  // Application constants
  app: {
    name: 'Pump.fun Clone',
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