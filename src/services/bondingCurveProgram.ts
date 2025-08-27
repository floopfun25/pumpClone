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
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import * as borsh from "borsh";

// Program ID for your deployed bonding curve program
const PROGRAM_ID = new PublicKey(
  "Bucwy8sKVrTzjaQS1RkPLu9tA4ySUuhLKgj1C8B4WpSm",
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
const SCHEMAS = new Map([
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
   * Initialize bonding curve for a token
   */
  async initializeBondingCurve(
    mintAddress: PublicKey,
    initialVirtualTokenReserves: bigint = BigInt(1073000000 * Math.pow(10, 9)), // 1.073B tokens
    initialVirtualSolReserves: bigint = BigInt(30 * LAMPORTS_PER_SOL), // 30 SOL
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

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: bondingCurveAccount, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
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
      const accountInfo = await this.connection.getAccountInfo(bondingCurveAccount);
      if (!accountInfo) {
        console.log("🏗️ [BUY] Bonding curve not initialized, initializing now...");
        await this.initializeBondingCurve(mintAddress);
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
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), bondingCurveAccount.toBuffer()],
        PROGRAM_ID,
      );

      // Calculate expected tokens (simplified calculation)
      const expectedTokens = await this.calculateTokensOut(
        solAmountLamports,
        mintAddress,
      );
      const minTokensWithSlippage = BigInt(
        Math.floor((Number(expectedTokens) * (100 - slippagePercent)) / 100),
      );

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
        })
      );
      transaction.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        })
      );

      // Check if token account exists, create if not
      const tokenAccountInfo = await this.connection.getAccountInfo(buyerTokenAccount);
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
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), bondingCurveAccount.toBuffer()],
        PROGRAM_ID,
      );

      // Calculate expected SOL
      const expectedSol = await this.calculateSolOut(tokenAmount, mintAddress);
      const minSolWithSlippage = BigInt(
        Math.floor((Number(expectedSol) * (100 - slippagePercent)) / 100),
      );

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

      // Use initial virtual reserves (pump.fun formula)
      let virtualSolReserves = BigInt(30 * LAMPORTS_PER_SOL); // 30 SOL
      let virtualTokenReserves = BigInt(1073000000 * Math.pow(10, 9)); // 1.073B tokens

      if (accountInfo && accountInfo.data.length > 0) {
        // TODO: Parse actual bonding curve state from account data
        // For now, we'll use the database to get current state
        try {
          const { bondingCurveState } =
            await this.getCurrentBondingCurveState(mintAddress);
          if (bondingCurveState) {
            virtualSolReserves = BigInt(
              Math.floor(
                bondingCurveState.virtualSolReserves * LAMPORTS_PER_SOL,
              ),
            );
            virtualTokenReserves = BigInt(
              Math.floor(
                bondingCurveState.virtualTokenReserves * Math.pow(10, 9),
              ),
            );
          }
        } catch (dbError) {
          console.warn(
            "Could not get bonding curve state from database, using defaults",
          );
        }
      }

      // Constant product formula: k = x * y
      // After buy: (virtualSolReserves + solIn) * (virtualTokenReserves - tokensOut) = k
      const k = virtualSolReserves * virtualTokenReserves;
      const newSolReserves = virtualSolReserves + solIn;
      const newTokenReserves = k / newSolReserves;
      const tokensOut = virtualTokenReserves - newTokenReserves;

      console.log(`🧮 Bonding curve calculation:
        SOL in: ${Number(solIn) / LAMPORTS_PER_SOL} SOL
        Virtual SOL reserves: ${Number(virtualSolReserves) / LAMPORTS_PER_SOL} SOL
        Virtual token reserves: ${Number(virtualTokenReserves) / Math.pow(10, 9)} tokens
        Tokens out: ${Number(tokensOut) / Math.pow(10, 9)} tokens
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

      // Use initial virtual reserves (pump.fun formula)
      let virtualSolReserves = BigInt(30 * LAMPORTS_PER_SOL); // 30 SOL
      let virtualTokenReserves = BigInt(1073000000 * Math.pow(10, 9)); // 1.073B tokens

      if (accountInfo && accountInfo.data.length > 0) {
        // TODO: Parse actual bonding curve state from account data
        // For now, we'll use the database to get current state
        try {
          const { bondingCurveState } =
            await this.getCurrentBondingCurveState(mintAddress);
          if (bondingCurveState) {
            virtualSolReserves = BigInt(
              Math.floor(
                bondingCurveState.virtualSolReserves * LAMPORTS_PER_SOL,
              ),
            );
            virtualTokenReserves = BigInt(
              Math.floor(
                bondingCurveState.virtualTokenReserves * Math.pow(10, 9),
              ),
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
   * Get current token price
   */
  async getCurrentPrice(mintAddress: PublicKey): Promise<number> {
    return 0.001; // Placeholder
  }

  /**
   * Get market cap
   */
  async getMarketCap(mintAddress: PublicKey): Promise<number> {
    return 10000; // Placeholder
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
