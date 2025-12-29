// Application configuration with environment variables and constants

// Environment variable validation and fallbacks
const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key];
  if (!value && !fallback) {
    console.error(`Missing required environment variable: ${key}`);
    throw new Error(`Environment variable ${key} is required`);
  }
  const result = value || fallback!;

  // Validate base58 addresses for program IDs and wallet addresses
  if (
    key.includes("PROGRAM") ||
    key.includes("WALLET") ||
    key.includes("AUTHORITY") ||
    key.includes("TREASURY") ||
    key.includes("COLLECTOR")
  ) {
    if (
      result === "YOUR_DEPLOYED_PROGRAM_ID_HERE" ||
      result.length < 32 ||
      result.length > 44
    ) {
      console.warn(`Invalid address for ${key}: ${result}, using fallback`);
      return fallback || "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
    }
  }

  return result;
};

export const config = {
  // Supabase configuration for backend integration
  supabase: {
    url: getEnvVar(
      "VITE_SUPABASE_URL",
      "https://osqniqjbbenjmhehoykv.supabase.co",
    ),
    anonKey: getEnvVar(
      "VITE_SUPABASE_ANON_KEY",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcW5pcWpiYmVuam1oZWhveWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1NDM5NzYsImV4cCI6MjA2NDExOTk3Nn0.hHkHKivLHqOx4Ne9Bn9BOb6dAsCh_StBJ0YHGw0qwOc",
    ),
  },

  // Solana blockchain configuration
  solana: {
    network: getEnvVar("VITE_SOLANA_NETWORK", "devnet") as "devnet" | "mainnet",
    rpcUrl:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_RPC_URL",
            "https://api.mainnet-beta.solana.com",
          )
        : getEnvVar("VITE_DEVNET_RPC_URL", "https://api.devnet.solana.com"),
    commitment: "confirmed" as const,
  },

  // FloppFun Program Addresses (production-ready)
  programs: {
    // Your custom bonding curve program (deployed on devnet Dec 29, 2025)
    bondingCurve:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_BONDING_CURVE_PROGRAM",
            "Cxiw2xXiCCNywNS6qH1mPH81yaVkG8jhu7x6ma7oTK9M",
          )
        : getEnvVar(
            "VITE_DEVNET_BONDING_CURVE_PROGRAM",
            "9JQyYqCSRwhgaCPPSiyBauPb3x1wf5fnpidqgndowbWp",
          ),
    // Token factory program (standard SPL)
    tokenFactory:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_TOKEN_FACTORY_PROGRAM",
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          )
        : getEnvVar(
            "VITE_DEVNET_TOKEN_FACTORY_PROGRAM",
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          ),
    // Platform fee collection
    feeCollector:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_FEE_COLLECTOR",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          )
        : getEnvVar(
            "VITE_DEVNET_FEE_COLLECTOR",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          ),
    // Metadata program (Metaplex - same on all networks)
    metadata: getEnvVar(
      "VITE_METADATA_PROGRAM",
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
    ),
  },

  // Platform Configuration (production-ready)
  platform: {
    // Platform fee collection wallet
    feeWallet:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_FEE_WALLET",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          )
        : getEnvVar(
            "VITE_DEVNET_FEE_WALLET",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          ),
    // Authority wallet for program operations
    authority:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_AUTHORITY",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          )
        : getEnvVar(
            "VITE_DEVNET_AUTHORITY",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          ),
    // Treasury for rewards and incentives
    treasury:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_TREASURY",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          )
        : getEnvVar(
            "VITE_DEVNET_TREASURY",
            "J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ",
          ),
  },

  // Application constants
  app: {
    name: "FloppFun",
    version: "1.0.0",
    description: "Create and trade meme tokens on Solana",
  },

  // Token creation defaults (PRODUCTION PUMP.FUN CLONE)
  tokenDefaults: {
    decimals: 6, // Pump.fun standard: 6 decimals
    totalSupply: 1_000_000_000, // 1 billion tokens total
    platformFeePercentage: 1.0, // 1% platform fee
    creationFee: 0.02, // 0.02 SOL creation fee
  },

  // Bonding curve configuration (EXACT PUMP.FUN PARAMETERS)
  bondingCurve: {
    // Virtual reserves (for pricing calculations)
    initialVirtualTokenReserves: 1_073_000_000, // 1.073B tokens (with 6 decimals: 1_073_000_000_000_000)
    initialVirtualSolReserves: parseInt(getEnvVar("VITE_VIRTUAL_SOL_RESERVES", "30000000000")), // 30 SOL in lamports

    // Real reserves (actual tradeable amounts)
    initialRealTokenReserves: 793_100_000, // 793.1M tokens for bonding curve (with 6 decimals: 793_100_000_000_000)
    initialRealSolReserves: 0, // Starts at 0, grows from trades

    // Creator allocation
    creatorAllocation: 206_900_000, // 206.9M tokens to creator (with 6 decimals: 206_900_000_000_000)

    // Completion criteria (CRITICAL: based on tokens sold, not SOL)
    // Bonding curve completes when real_token_reserves == 0 (all 793.1M tokens sold)
    // This typically happens around 85 SOL collected

    // Fee configuration
    tradeFeePercentage: 1.0, // 1% trading fee
    platformFeeBps: 100, // 100 basis points = 1%
  },

  // Trading configuration
  trading: {
    minTradeAmount: 1000000, // 0.001 SOL minimum
    // maxTradeAmount removed
    slippageToleranceDefault: 3.0, // 3% default slippage
    maxSlippageTolerance: 20.0, // 20% maximum slippage
    // Price impact warnings
    priceImpactWarning: 5.0, // Warn at 5% price impact
    priceImpactBlock: 15.0, // Block trades over 15% price impact
  },

  // UI configuration
  ui: {
    itemsPerPage: 20,
    chartUpdateInterval: 5000, // 5 seconds
    priceUpdateInterval: 3000, // 3 seconds
    toastDuration: 5000, // 5 seconds
  },
} as const;

// Export individual configurations for easier imports
export const {
  supabase: supabaseConfig,
  solana: solanaConfig,
  programs: programConfig,
  platform: platformConfig,
  app: appConfig,
  tokenDefaults,
  bondingCurve: bondingCurveConfig,
  trading: tradingConfig,
  ui: uiConfig,
} = config;

export { getEnvVar };
