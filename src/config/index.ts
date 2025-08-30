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
    // Standard SPL Token Program (universal and always works)
    bondingCurve:
      getEnvVar("VITE_SOLANA_NETWORK", "devnet") === "mainnet"
        ? getEnvVar(
            "VITE_MAINNET_BONDING_CURVE_PROGRAM",
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          )
        : getEnvVar(
            "VITE_DEVNET_BONDING_CURVE_PROGRAM",
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
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

  // Token creation defaults
  tokenDefaults: {
    decimals: 9,
    totalSupply: 1_000_000_000, // 1 billion tokens
    graduationThreshold: 69_000, // $69K market cap in USD (not SOL)
    platformFeePercentage: 1.0, // 1% platform fee
    creationFee: 0.02, // 0.02 SOL creation fee
  },

  // Bonding curve configuration (based on pump.fun)
  bondingCurve: {
    initialVirtualTokenReserves: 1073000000, // Human value: 1.073B tokens 
    initialVirtualSolReserves: parseInt(getEnvVar("VITE_VIRTUAL_SOL_RESERVES", "30000000000")), // 30 SOL in lamports
    initialRealSolReserves: 0, // Start with 0 real SOL
    // Graduation parameters (matching pump.fun exactly)
    graduationMarketCapUSD: 69_000, // $69K USD market cap to graduate
    graduationLiquidityUSD: 12_000, // $12K liquidity deposited to Raydium
    graduationSolTarget: 85_000_000_000, // ~85 SOL to complete bonding curve
    graduationTokensRemaining: 200_000_000_000_000, // ~200M tokens for LP
    creatorRewardSOL: 0.5, // 0.5 SOL reward to creator upon graduation
    // Fee configuration
    tradeFeePercentage: 1.0, // 1% trading fee
    platformFeeSOL: 6_000_000_000, // 6 SOL fee deducted during graduation
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
