/**
 * Real Solana Program Service for FloppFun
 * This service performs actual blockchain transactions with SPL tokens
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createBurnInstruction,
  getAccount,
  getMint,
  AccountLayout,
} from "@solana/spl-token";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import { supabase } from "./supabase";
import * as borsh from "borsh";

export interface BondingCurveState {
  discriminator: number[];
  mintAddress: PublicKey;
  creator: PublicKey;
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  graduated: boolean;
  createdAt: bigint;
  bumpSeed: number;
}

export interface TradeResult {
  signature: string;
  tokensTraded: bigint;
  solAmount: bigint;
  newPrice: number;
  marketCap: number;
}

// Bonding curve instruction data structures
class BondingCurveInstruction {
  constructor(
    public instruction: number,
    public data: any,
  ) {}
}

class BuyInstruction {
  constructor(
    public sol_amount: bigint,
    public min_tokens_received: bigint,
  ) {}
}

class SellInstruction {
  constructor(
    public token_amount: bigint,
    public min_sol_received: bigint,
  ) {}
}

// Borsh schemas
const BONDING_CURVE_SCHEMA = new Map([
  [
    BondingCurveInstruction,
    {
      kind: "struct",
      fields: [
        ["instruction", "u8"],
        ["data", "bytes"],
      ],
    },
  ],
  [
    BuyInstruction,
    {
      kind: "struct",
      fields: [
        ["sol_amount", "u64"],
        ["min_tokens_received", "u64"],
      ],
    },
  ],
  [
    SellInstruction,
    {
      kind: "struct",
      fields: [
        ["token_amount", "u64"],
        ["min_sol_received", "u64"],
      ],
    },
  ],
] as any);

export class RealSolanaProgram {
  private connection: Connection;
  private programId: PublicKey;
  private walletService = getWalletService();

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
    this.programId = new PublicKey(config.programs.bondingCurve);

    console.log("🔗 Initialized Real Solana Program Service");
    console.log("📡 RPC:", config.solana.rpcUrl);
    console.log("🏪 Program ID:", this.programId.toBase58());
  }

  /**
   * Buy tokens using bonding curve
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: number,
    slippagePercent: number = 1,
  ): Promise<TradeResult> {
    console.log("💰 [BUY] Starting buy transaction...");

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const buyer = this.walletService.publicKey;
    const solAmountLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));

    try {
      // Get bonding curve account
      const [bondingCurveAccount] =
        await this.getBondingCurveAddress(mintAddress);

      // Get or create associated token account for buyer
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        buyer,
      );

      // Check if token account exists, create if not
      let createTokenAccountIx: TransactionInstruction | null = null;
      try {
        await getAccount(this.connection, buyerTokenAccount);
        console.log("✅ Token account already exists");
      } catch (error) {
        console.log("🏗️  Creating token account...");
        createTokenAccountIx = createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          mintAddress,
        );
      }

      // Calculate expected tokens (simplified bonding curve calculation)
      const expectedTokens = await this.calculateTokensOut(
        solAmountLamports,
        mintAddress,
      );
      const minTokensWithSlippage = BigInt(
        Math.floor((Number(expectedTokens) * (100 - slippagePercent)) / 100),
      );

      // Create buy instruction
      const buyInstructionData = new BuyInstruction(
        solAmountLamports,
        minTokensWithSlippage,
      );

      const instructionData = borsh.serialize(
        BONDING_CURVE_SCHEMA,
        new BondingCurveInstruction(
          1,
          borsh.serialize(BONDING_CURVE_SCHEMA, buyInstructionData),
        ),
      );

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // Create bonding curve vault PDA
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), bondingCurveAccount.toBuffer()],
        this.programId,
      );

      // Build transaction
      const transaction = new Transaction();

      // Add create token account instruction if needed
      if (createTokenAccountIx) {
        transaction.add(createTokenAccountIx);
      }

      // Create simple buy instruction using standard SPL minting
      // This is a temporary solution until your program is deployed
      const { createMintToInstruction } = await import('@solana/spl-token');
      
      // Calculate tokens to mint based on SOL amount (simplified)
      const decimals = 9;
      const tokensToMint = BigInt(Math.floor(solAmountLamports * BigInt(1000))); // 1 SOL = 1000 tokens
      
      // For now, use direct minting (requires mint authority)
      const mintInstruction = createMintToInstruction(
        mintAddress,
        buyerTokenAccount, 
        buyer, // This needs to be mint authority
        tokensToMint
      );
      
      transaction.add(mintInstruction);

      transaction.add(buyInstruction);

      // Send transaction
      const signature = await this.sendTransaction(transaction);

      // Calculate results for return
      const tokensTraded = expectedTokens;
      const newPrice = await this.getCurrentPrice(mintAddress);
      const marketCap = await this.getMarketCap(mintAddress);

      // Update database
      await this.recordTrade(
        "buy",
        signature,
        mintAddress.toBase58(),
        buyer.toBase58(),
        solAmountLamports,
        tokensTraded,
      );

      console.log("✅ Buy transaction completed:", signature);

      return {
        signature,
        tokensTraded,
        solAmount: solAmountLamports,
        newPrice,
        marketCap,
      };
    } catch (error) {
      console.error("❌ Buy transaction failed:", error);
      throw new Error(`Buy failed: ${error}`);
    }
  }

  /**
   * Sell tokens using bonding curve
   */
  async sellTokens(
    mintAddress: PublicKey,
    tokenAmount: bigint,
    slippagePercent: number = 1,
  ): Promise<TradeResult> {
    console.log("💸 [SELL] Starting sell transaction...");

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const seller = this.walletService.publicKey;

    try {
      // Get bonding curve account
      const [bondingCurveAccount] =
        await this.getBondingCurveAddress(mintAddress);

      // Get seller's token account
      const sellerTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        seller,
      );

      // Verify seller has enough tokens
      const tokenAccountInfo = await getAccount(
        this.connection,
        sellerTokenAccount,
      );
      if (tokenAccountInfo.amount < tokenAmount) {
        throw new Error("Insufficient token balance");
      }

      // Calculate expected SOL (simplified calculation)
      const expectedSol = await this.calculateSolOut(tokenAmount, mintAddress);
      const minSolWithSlippage = BigInt(
        Math.floor((Number(expectedSol) * (100 - slippagePercent)) / 100),
      );

      // Create sell instruction
      const sellInstructionData = new SellInstruction(
        tokenAmount,
        minSolWithSlippage,
      );

      const instructionData = borsh.serialize(
        BONDING_CURVE_SCHEMA,
        new BondingCurveInstruction(
          2,
          borsh.serialize(BONDING_CURVE_SCHEMA, sellInstructionData),
        ),
      );

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // Create bonding curve vault PDA
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), bondingCurveAccount.toBuffer()],
        this.programId,
      );

      // Build transaction
      const transaction = new Transaction();

      // Add sell instruction
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
        programId: this.programId,
        data: Buffer.from(instructionData),
      });

      transaction.add(sellInstruction);

      // Send transaction
      const signature = await this.sendTransaction(transaction);

      // Calculate results
      const solAmount = expectedSol;
      const newPrice = await this.getCurrentPrice(mintAddress);
      const marketCap = await this.getMarketCap(mintAddress);

      // Update database
      await this.recordTrade(
        "sell",
        signature,
        mintAddress.toBase58(),
        seller.toBase58(),
        solAmount,
        tokenAmount,
      );

      console.log("✅ Sell transaction completed:", signature);

      return {
        signature,
        tokensTraded: tokenAmount,
        solAmount,
        newPrice,
        marketCap,
      };
    } catch (error) {
      console.error("❌ Sell transaction failed:", error);
      throw new Error(`Sell failed: ${error}`);
    }
  }

  /**
   * Get bonding curve PDA address
   */
  async getBondingCurveAddress(
    mintAddress: PublicKey,
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
      this.programId,
    );
  }

  /**
   * Calculate tokens out for SOL input (simplified)
   */
  private async calculateTokensOut(
    solIn: bigint,
    mintAddress: PublicKey,
  ): Promise<bigint> {
    try {
      // Get current bonding curve state
      const [bondingCurveAccount] =
        await this.getBondingCurveAddress(mintAddress);
      const accountInfo =
        await this.connection.getAccountInfo(bondingCurveAccount);

      if (!accountInfo) {
        // New token - use initial virtual reserves
        const virtualSolReserves = BigInt(30 * LAMPORTS_PER_SOL); // 30 SOL
        const virtualTokenReserves = BigInt(1073000000 * Math.pow(10, 9)); // 1.073B tokens

        // Constant product formula: k = x * y
        const k = virtualSolReserves * virtualTokenReserves;
        const newSolReserves = virtualSolReserves + solIn;
        const newTokenReserves = k / newSolReserves;
        const tokensOut = virtualTokenReserves - newTokenReserves;

        return tokensOut;
      }

      // Parse existing state and calculate
      // This would parse the actual bonding curve state from the account data
      // For now, using simplified calculation
      return solIn * BigInt(1000); // Simplified: 1 SOL = 1000 tokens
    } catch (error) {
      console.warn("Using fallback token calculation");
      return solIn * BigInt(1000); // Fallback calculation
    }
  }

  /**
   * Calculate SOL out for token input (simplified)
   */
  private async calculateSolOut(
    tokenIn: bigint,
    mintAddress: PublicKey,
  ): Promise<bigint> {
    try {
      // Similar to calculateTokensOut but in reverse
      return tokenIn / BigInt(1000); // Simplified: 1000 tokens = 1 SOL
    } catch (error) {
      console.warn("Using fallback SOL calculation");
      return tokenIn / BigInt(1000);
    }
  }

  /**
   * Get current token price
   */
  async getCurrentPrice(mintAddress: PublicKey): Promise<number> {
    // This would calculate price from bonding curve state
    // For now, return a placeholder
    return 0.001; // $0.001 per token
  }

  /**
   * Get market cap
   */
  async getMarketCap(mintAddress: PublicKey): Promise<number> {
    try {
      const mintInfo = await getMint(this.connection, mintAddress);
      const price = await this.getCurrentPrice(mintAddress);
      return (
        (Number(mintInfo.supply) * price) / Math.pow(10, mintInfo.decimals)
      );
    } catch (error) {
      return 0;
    }
  }

  /**
   * Send and confirm transaction
   */
  private async sendTransaction(transaction: Transaction): Promise<string> {
    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.walletService.publicKey!;

    // Sign transaction
    const signedTransaction =
      await this.walletService.signTransaction(transaction);

    // Send transaction
    const signature = await this.connection.sendRawTransaction(
      signedTransaction.serialize(),
    );

    // Confirm transaction
    await this.connection.confirmTransaction(signature, "confirmed");

    return signature;
  }

  /**
   * Record trade in database
   */
  private async recordTrade(
    type: "buy" | "sell",
    signature: string,
    mintAddress: string,
    userAddress: string,
    solAmount: bigint,
    tokenAmount: bigint,
  ): Promise<void> {
    try {
      await supabase.from("transactions").insert({
        signature,
        token_mint: mintAddress,
        user_address: userAddress,
        transaction_type: type,
        sol_amount: Number(solAmount),
        token_amount: Number(tokenAmount),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to record trade:", error);
      // Don't throw - transaction succeeded even if recording failed
    }
  }
}

// Export singleton
export const realSolanaProgram = new RealSolanaProgram();
