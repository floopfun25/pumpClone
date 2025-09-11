/**
 * FloppFun Bonding Curve Program Client
 * Interfaces with the deployed Solana program for real trading
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getMint,
} from "@solana/spl-token";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import * as borsh from "borsh";

// Program ID for your deployed bonding curve program
const PROGRAM_ID = new PublicKey(
  "Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY",
);

// Instruction discriminators (based on Anchor IDL)
const INSTRUCTION_DISCRIMINATORS = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),
  sell: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
};

// Account layouts
class BuyArgs {
  constructor(
    public sol_amount: bigint,
    public min_tokens_received: bigint,
  ) {}
}

class SellArgs {
  constructor(
    public token_amount: bigint,
    public min_sol_received: bigint,
  ) {}
}

class InitializeArgs {
  constructor(
    public initial_virtual_token_reserves: bigint,
    public initial_virtual_sol_reserves: bigint,
    public bump: number,
  ) {}
}

// Borsh schemas
const SCHEMAS = new Map<any, any>([
  [
    BuyArgs,
    {
      kind: "struct",
      fields: [
        ["sol_amount", "u64"],
        ["min_tokens_received", "u64"],
      ],
    },
  ],
  [
    SellArgs,
    {
      kind: "struct",
      fields: [
        ["token_amount", "u64"],
        ["min_sol_received", "u64"],
      ],
    },
  ],
  [
    InitializeArgs,
    {
      kind: "struct",
      fields: [
        ["initial_virtual_token_reserves", "u64"],
        ["initial_virtual_sol_reserves", "u64"],
        ["bump", "u8"],
      ],
    },
  ],
]);

export interface TradeResult {
  signature: string;
  tokensTraded: bigint;
  solAmount: bigint;
  newPrice: number;
  marketCap: number;
}

export class BondingCurveProgram {
  private connection: Connection;
  private walletService = getWalletService();

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
    console.log("🔗 Initialized Bonding Curve Program Client");
    console.log("📡 RPC:", config.solana.rpcUrl);
    console.log("🏪 Program ID:", PROGRAM_ID.toBase58());
  }

  /**
   * Initialize bonding curve for a token (Pump.fun style)
   */
  async initializeBondingCurve(
    mintAddress: PublicKey,
    totalSupply: bigint, // Total token supply in base units
    initialVirtualSolReserves: bigint = BigInt(config.bondingCurve.initialVirtualSolReserves), // 30 SOL
  ): Promise<string> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const creator = this.walletService.publicKey;

    // Get bonding curve PDA
    const [bondingCurveAccount, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
      PROGRAM_ID,
    );

    // Get creator's token account
    const creatorTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      creator,
    );

    // Use fixed virtual token reserves from config (pump.fun style)
    const initialVirtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves);
    
    // Create initialize instruction
    const initializeArgs = new InitializeArgs(
      initialVirtualTokenReserves,
      initialVirtualSolReserves,
      bump,
    );
    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.initialize,
      Buffer.from(borsh.serialize(SCHEMAS, initializeArgs)),
    ]);

    // Get associated token account for bonding curve vault
    // Using manual PDA derivation since getAssociatedTokenAddressSync fails with PDA
    const [vaultAccount] = PublicKey.findProgramAddressSync(
      [
        bondingCurveAccount.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintAddress.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: bondingCurveAccount, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true }, // Vault to hold bonding curve tokens
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });

    const transaction = new Transaction().add(instruction);
    return await this.sendTransaction(transaction);
  }

  /**
   * Buy tokens using bonding curve
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: number,
    slippagePercent: number = 3,
  ): Promise<TradeResult> {
    console.log("💰 [BUY] Starting buy transaction...");

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const buyer = this.walletService.publicKey;
    const solAmountLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));

    try {
      // Get bonding curve account
      const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
        PROGRAM_ID,
      );

      // Check if bonding curve account exists, initialize if not
      const accountInfo =
        await this.connection.getAccountInfo(bondingCurveAccount);
      if (!accountInfo) {
        console.log(
          "🏗️ [BUY] Bonding curve not initialized, initializing now...",
        );
        await this.initializeBondingCurve(
          mintAddress,
          BigInt(1_000_000_000 * Math.pow(10, 9)), // Default 1B tokens
        );
        console.log("✅ [BUY] Bonding curve initialized successfully");
      }

      // Get or create associated token account for buyer
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        buyer,
      );

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // Get vault PDA
      // Using manual PDA derivation since getAssociatedTokenAddressSync fails with PDA
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [
          bondingCurveAccount.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          mintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Calculate expected tokens (simplified calculation)
      const expectedTokens = await this.calculateTokensOut(
        solAmountLamports,
        mintAddress,
      );
      // Calculate slippage using BigInt arithmetic to avoid precision loss
      const minTokensWithSlippage = (expectedTokens * BigInt(100 - slippagePercent)) / BigInt(100);

      // Check u64 bounds before serialization to prevent overflow
      const MAX_U64 = BigInt("18446744073709551615");
      if (minTokensWithSlippage > MAX_U64) {
        throw new Error(`Token amount ${minTokensWithSlippage.toString()} exceeds u64 maximum (${MAX_U64.toString()}). This indicates a scaling issue.`);
      }
      if (solAmountLamports > MAX_U64) {
        throw new Error(`SOL amount ${solAmountLamports.toString()} exceeds u64 maximum (${MAX_U64.toString()})`);
      }

      // Create buy instruction
      const buyArgs = new BuyArgs(solAmountLamports, minTokensWithSlippage);
      const data = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.buy,
        Buffer.from(borsh.serialize(SCHEMAS, buyArgs)),
      ]);

      const transaction = new Transaction();

      // Add compute budget instructions
      transaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        }),
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        }),
      );

      // Check if token account exists, create if not
      const tokenAccountInfo =
        await this.connection.getAccountInfo(buyerTokenAccount);
      if (!tokenAccountInfo) {
        console.log("🏗️ [BUY] Creating associated token account...");
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          mintAddress,
        );
        transaction.add(createTokenAccountIx);
      }

      // Add buy instruction
      const buyInstruction = new TransactionInstruction({
        keys: [
          { pubkey: buyer, isSigner: true, isWritable: true },
          { pubkey: bondingCurveAccount, isSigner: false, isWritable: true },
          { pubkey: mintAddress, isSigner: false, isWritable: true },
          { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
          { pubkey: vaultAccount, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      transaction.add(buyInstruction);

      // Send transaction
      const signature = await this.sendTransaction(transaction);

      console.log("✅ Buy transaction completed:", signature);

      return {
        signature,
        tokensTraded: expectedTokens,
        solAmount: solAmountLamports,
        newPrice: await this.getCurrentPrice(mintAddress),
        marketCap: await this.getMarketCap(mintAddress),
      };
    } catch (error) {
      console.error("❌ Buy transaction failed:", error);
      throw error;
    }
  }

  /**
   * Sell tokens using bonding curve
   */
  async sellTokens(
    mintAddress: PublicKey,
    tokenAmount: bigint,
    slippagePercent: number = 3,
  ): Promise<TradeResult> {
    console.log("💸 [SELL] Starting sell transaction...");

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const seller = this.walletService.publicKey;

    try {
      // Get bonding curve account
      const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
        PROGRAM_ID,
      );

      // Get seller's token account
      const sellerTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        seller,
      );

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // Get vault PDA
      // Using manual PDA derivation since getAssociatedTokenAddressSync fails with PDA
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [
          bondingCurveAccount.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          mintAddress.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // Calculate expected SOL
      const expectedSol = await this.calculateSolOut(tokenAmount, mintAddress);
      // Calculate slippage using BigInt arithmetic to avoid precision loss
      const minSolWithSlippage = (expectedSol * BigInt(100 - slippagePercent)) / BigInt(100);

      // Create sell instruction
      const sellArgs = new SellArgs(tokenAmount, minSolWithSlippage);
      const data = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.sell,
        Buffer.from(borsh.serialize(SCHEMAS, sellArgs)),
      ]);

      const sellInstruction = new TransactionInstruction({
        keys: [
          { pubkey: seller, isSigner: true, isWritable: true },
          { pubkey: bondingCurveAccount, isSigner: false, isWritable: true },
          { pubkey: mintAddress, isSigner: false, isWritable: true },
          { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: platformFeeAccount, isSigner: false, isWritable: true },
          { pubkey: vaultAccount, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const transaction = new Transaction().add(sellInstruction);

      // Send transaction
      const signature = await this.sendTransaction(transaction);

      console.log("✅ Sell transaction completed:", signature);

      return {
        signature,
        tokensTraded: tokenAmount,
        solAmount: expectedSol,
        newPrice: await this.getCurrentPrice(mintAddress),
        marketCap: await this.getMarketCap(mintAddress),
      };
    } catch (error) {
      console.error("❌ Sell transaction failed:", error);
      throw error;
    }
  }

  /**
   * Get bonding curve account data
   */
  async getBondingCurveAccount(mintAddress: PublicKey) {
    const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
      PROGRAM_ID,
    );

    return await this.connection.getAccountInfo(bondingCurveAccount);
  }

  /**
   * Calculate tokens out for SOL input using bonding curve formula
   */
  private async calculateTokensOut(
    solIn: bigint,
    mintAddress: PublicKey,
  ): Promise<bigint> {
    try {
      const accountInfo = await this.getBondingCurveAccount(mintAddress);

      // Use initial virtual reserves from config (already in proper base units)
      let virtualSolReserves = BigInt(config.bondingCurve.initialVirtualSolReserves); // 30 SOL in lamports
      let virtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves); // Already in base units, don't scale again

      if (accountInfo && accountInfo.data.length > 0) {
        // TODO: Parse actual bonding curve state from account data
        // For now, we'll use the database to get current state
        try {
          const result = await this.getCurrentBondingCurveState(mintAddress);
          if (result?.bondingCurveState) {
            virtualSolReserves = BigInt(
              Math.floor(
                result.bondingCurveState.virtualSolReserves * LAMPORTS_PER_SOL,
              ),
            );
            virtualTokenReserves = BigInt(
              Math.floor(result.bondingCurveState.virtualTokenReserves),
            );
          }
        } catch (dbError) {
          console.warn(
            "Could not get bonding curve state from database, using defaults",
          );
        }
      }

      // Constant product formula using BigInt arithmetic to avoid precision issues
      // k = x * y, after buy: (x + solIn) * (y - tokensOut) = k
      // Solving for tokensOut: tokensOut = y - (k / (x + solIn))
      const k = virtualSolReserves * virtualTokenReserves;
      const newSolReserves = virtualSolReserves + solIn;
      const newTokenReserves = k / newSolReserves; // This division truncates (integer division)
      const tokensOut = virtualTokenReserves - newTokenReserves;

      // Safety check: ensure result doesn't exceed u64 maximum
      const MAX_U64 = BigInt("18446744073709551615");
      if (tokensOut > MAX_U64) {
        console.warn(`⚠️ Calculated tokens out ${tokensOut.toString()} exceeds u64 max, using fallback calculation`);
        return this.fallbackTokenCalculation(solIn);
      }

      console.log(`🧮 Bonding curve calculation:
        SOL in: ${Number(solIn) / LAMPORTS_PER_SOL} SOL
        Virtual SOL reserves: ${Number(virtualSolReserves) / LAMPORTS_PER_SOL} SOL
        Virtual token reserves: ${virtualTokenReserves.toString()} base units
        Tokens out (BigInt): ${tokensOut.toString()} base units
        Tokens out (display): ${Number(tokensOut) / Math.pow(10, 9)} tokens
      `);

      return tokensOut > 0 ? tokensOut : BigInt(0);
    } catch (error) {
      console.error("Bonding curve calculation failed:", error);
      // Fallback to a reasonable calculation based on current price
      return this.fallbackTokenCalculation(solIn);
    }
  }

  /**
   * Get current bonding curve state from database
   */
  private async getCurrentBondingCurveState(mintAddress: PublicKey) {
    try {
      const { supabase } = await import("./supabase");

      const { data: token } = await supabase
        .from("tokens")
        .select("id, current_price")
        .eq("mint_address", mintAddress.toBase58())
        .single();

      if (!token) return null;

      // Import bonding curve service
      const { BondingCurveService } = await import("./bondingCurve");
      const bondingCurveState =
        await BondingCurveService.getTokenBondingCurveState(token.id);

      return { token, bondingCurveState };
    } catch (error) {
      console.warn("Could not fetch bonding curve state:", error);
      return null;
    }
  }

  /**
   * Fallback calculation when bonding curve state is unavailable
   */
  private fallbackTokenCalculation(solIn: bigint): bigint {
    // Use a reasonable price based on early bonding curve state
    // At start: 30 SOL, 1.073B tokens → price ≈ 0.000000028 SOL per token
    // So 1 SOL should get approximately 35.7M tokens
    const tokensPerSol = BigInt(35700000); // 35.7M tokens per SOL
    const decimals = BigInt(Math.pow(10, 9));
    return (solIn * tokensPerSol * decimals) / BigInt(LAMPORTS_PER_SOL);
  }

  /**
   * Fallback SOL calculation when bonding curve state is unavailable
   */
  private fallbackSolCalculation(tokenIn: bigint): bigint {
    // Use reverse of token calculation
    // At start: price ≈ 0.000000028 SOL per token
    // So 35.7M tokens should get approximately 1 SOL
    const tokensPerSol = BigInt(35700000); // 35.7M tokens per SOL
    const decimals = BigInt(Math.pow(10, 9));
    return (tokenIn * BigInt(LAMPORTS_PER_SOL)) / (tokensPerSol * decimals);
  }

  /**
   * Calculate SOL out for token input using bonding curve formula
   */
  private async calculateSolOut(
    tokenIn: bigint,
    mintAddress: PublicKey,
  ): Promise<bigint> {
    try {
      const accountInfo = await this.getBondingCurveAccount(mintAddress);

      // Use initial virtual reserves from config (already in proper base units)
      let virtualSolReserves = BigInt(config.bondingCurve.initialVirtualSolReserves); // 30 SOL in lamports
      let virtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves); // Already in base units, don't scale again

      if (accountInfo && accountInfo.data.length > 0) {
        // TODO: Parse actual bonding curve state from account data
        // For now, we'll use the database to get current state
        try {
          const result = await this.getCurrentBondingCurveState(mintAddress);
          if (result?.bondingCurveState) {
            virtualSolReserves = BigInt(
              Math.floor(
                result.bondingCurveState.virtualSolReserves * LAMPORTS_PER_SOL,
              ),
            );
            virtualTokenReserves = BigInt(
              Math.floor(result.bondingCurveState.virtualTokenReserves),
            );
          }
        } catch (dbError) {
          console.warn(
            "Could not get bonding curve state from database, using defaults",
          );
        }
      }

      // Constant product formula: k = x * y
      // After sell: (virtualSolReserves - solOut) * (virtualTokenReserves + tokenIn) = k
      const k = virtualSolReserves * virtualTokenReserves;
      const newTokenReserves = virtualTokenReserves + tokenIn;
      const newSolReserves = k / newTokenReserves;
      const solOut = virtualSolReserves - newSolReserves;

      console.log(`🧮 Sell bonding curve calculation:
        Token in: ${Number(tokenIn) / Math.pow(10, 9)} tokens
        Virtual SOL reserves: ${Number(virtualSolReserves) / LAMPORTS_PER_SOL} SOL
        Virtual token reserves: ${Number(virtualTokenReserves) / Math.pow(10, 9)} tokens
        SOL out: ${Number(solOut) / LAMPORTS_PER_SOL} SOL
      `);

      return solOut > 0 ? solOut : BigInt(0);
    } catch (error) {
      console.error("Sell bonding curve calculation failed:", error);
      // Fallback to a reasonable calculation based on current price
      return this.fallbackSolCalculation(tokenIn);
    }
  }

  /**
   * Get current token price from bonding curve state
   */
  async getCurrentPrice(mintAddress: PublicKey): Promise<number> {
    try {
      // Get current bonding curve state
      const result = await this.getCurrentBondingCurveState(mintAddress);
      
      if (result?.bondingCurveState) {
        const { virtualSolReserves, virtualTokenReserves } = result.bondingCurveState;
        
        // Price = SOL reserves / Token reserves (in proper units)
        const pricePerToken = virtualSolReserves / virtualTokenReserves;
        return pricePerToken;
      }
      
      // Fallback: calculate initial price based on virtual reserves from config
      const virtualSolReserves = Number(config.bondingCurve.initialVirtualSolReserves) / LAMPORTS_PER_SOL; // Convert lamports to SOL
      const virtualTokenReserves = Number(config.bondingCurve.initialVirtualTokenReserves); // Convert base units to human tokens
      return virtualSolReserves / virtualTokenReserves; // ~0.000000028 SOL per token
    } catch (error) {
      console.error("Failed to calculate current price:", error);
      // Calculate fallback price from config values
      const virtualSolReserves = Number(config.bondingCurve.initialVirtualSolReserves) / LAMPORTS_PER_SOL; 
      const virtualTokenReserves = Number(config.bondingCurve.initialVirtualTokenReserves);
      return virtualSolReserves / virtualTokenReserves;
    }
  }

  /**
   * Get market cap calculated from current price and total supply
   */
  async getMarketCap(mintAddress: PublicKey): Promise<number> {
    try {
      const mintInfo = await getMint(this.connection, mintAddress);
      const currentPrice = await this.getCurrentPrice(mintAddress);
      
      // Market cap = Total supply × Current price
      const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
      const marketCapSOL = totalSupply * currentPrice;
      
      // Convert to USD (approximate using SOL price)
      // In production, you'd want to fetch real SOL price from an oracle
      const solPriceUSD = 100; // Fallback SOL price - should be fetched from price oracle
      const marketCapUSD = marketCapSOL * solPriceUSD;
      
      return marketCapUSD;
    } catch (error) {
      console.error("Failed to calculate market cap:", error);
      return 0; // Return 0 instead of placeholder for new tokens
    }
  }

  /**
   * Send and confirm transaction
   */
  private async sendTransaction(transaction: Transaction): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.walletService.publicKey!;

    const signedTransaction =
      await this.walletService.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(
      signedTransaction.serialize(),
    );
    await this.connection.confirmTransaction(signature, "confirmed");

    return signature;
  }
}

// Export singleton
export const bondingCurveProgram = new BondingCurveProgram();
