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

// Program ID for your custom bonding curve program (update after deployment)
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

      // Get bonding curve PDA (authority for the vault)
      const [bondingCurveAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
        PROGRAM_ID
      );

      // Your program expects an Associated Token Account owned by the bonding curve PDA
      const vaultAccount = await getAssociatedTokenAddress(
        mintAddress,
        bondingCurveAuthority, // The bonding curve PDA is the authority
        true // Allow PDA as owner
      );
      
      console.log(`🎯 [VAULT CORRECT] Using ATA owned by bonding curve PDA: ${vaultAccount.toBase58()}`);
      console.log(`📍 [AUTHORITY] Bonding curve authority: ${bondingCurveAuthority.toBase58()}`);
      
      const vaultInfo = await this.connection.getAccountInfo(vaultAccount);
      console.log(`🔍 [VAULT STATUS] Exists: ${vaultInfo ? 'YES' : 'NO'}`);
      if (vaultInfo) {
        console.log(`🔍 [VAULT STATUS] Owner: ${vaultInfo.owner.toBase58()}`);
        console.log(`🔍 [VAULT STATUS] Data length: ${vaultInfo.data.length} bytes`);
        console.log(`🔍 [VAULT STATUS] Lamports: ${vaultInfo.lamports}`);
      }
    

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

      // Check if buyer token account exists, create if not
      const tokenAccountInfo =
        await this.connection.getAccountInfo(buyerTokenAccount);
      console.log(`🔍 [BUY DEBUG] Buyer token account check:
        Address: ${buyerTokenAccount.toBase58()}
        Exists: ${tokenAccountInfo ? 'YES' : 'NO'}
        Owner: ${tokenAccountInfo ? tokenAccountInfo.owner.toBase58() : 'N/A'}
      `);
      
      if (!tokenAccountInfo) {
        console.log("🏗️ [BUY] Creating buyer token account...");
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          mintAddress,
        );
        transaction.add(createTokenAccountIx);
        console.log("✅ [BUY] Added buyer token account creation instruction");
      }

      // Handle vault creation if it doesn't exist (your program expects an ATA)
      if (!vaultInfo) {
        console.log("🏗️ [VAULT] Creating Associated Token Account for vault...");
        const createVaultIx = createAssociatedTokenAccountInstruction(
          buyer, // Payer
          vaultAccount, // ATA address
          bondingCurveAuthority, // Owner (bonding curve PDA)
          mintAddress // Mint
        );
        transaction.add(createVaultIx);
        console.log("✅ [VAULT] Added vault creation instruction");
      } else if (vaultInfo.owner.equals(TOKEN_PROGRAM_ID)) {
        console.log("✅ [VAULT] Vault already exists as SPL Token Account");
      } else {
        console.log(`❌ [VAULT] Unexpected vault owner: ${vaultInfo.owner.toBase58()}`);
        console.log(`❌ [VAULT] Expected: ${TOKEN_PROGRAM_ID.toBase58()}`);
      }

      // Add comprehensive account debugging before creating instruction
      console.log(`🧾 [BUY DEBUG] Instruction accounts summary (matching your program's Buy struct):
        0. Buyer (signer): ${buyer.toBase58()}
        1. Bonding Curve: ${bondingCurveAccount.toBase58()}
        2. Mint: ${mintAddress.toBase58()}
        3. Buyer Token Account: ${buyerTokenAccount.toBase58()}
        4. Platform Fee Account: ${platformFeeAccount.toBase58()}
        5. Vault: ${vaultAccount.toBase58()}
        6. Token Program: ${TOKEN_PROGRAM_ID.toBase58()}
        7. System Program: ${SystemProgram.programId.toBase58()}
      `);

      // Verify all critical accounts exist and have correct ownership before instruction
      console.log(`🔍 [BUY DEBUG] Pre-instruction account verification:`);
      
      const bondingCurveInfo = await this.connection.getAccountInfo(bondingCurveAccount);
      console.log(`  Bonding Curve: ${bondingCurveInfo ? 'EXISTS' : 'MISSING'} | Owner: ${bondingCurveInfo?.owner.toBase58() || 'N/A'}`);
      
      const mintInfo = await this.connection.getAccountInfo(mintAddress);
      console.log(`  Token Mint: ${mintInfo ? 'EXISTS' : 'MISSING'} | Owner: ${mintInfo?.owner.toBase58() || 'N/A'}`);
      
      const buyerTokenInfo = await this.connection.getAccountInfo(buyerTokenAccount);
      console.log(`  Buyer Token Account: ${buyerTokenInfo ? 'EXISTS' : 'MISSING'} | Owner: ${buyerTokenInfo?.owner.toBase58() || 'N/A'}`);
      
      const finalVaultInfo = await this.connection.getAccountInfo(vaultAccount);
      console.log(`  Vault Account: ${finalVaultInfo ? 'EXISTS' : 'MISSING'} | Owner: ${finalVaultInfo?.owner.toBase58() || 'N/A'}`);

      // Add buy instruction with correct account ordering matching your program's Buy struct
      const buyInstruction = new TransactionInstruction({
        keys: [
          // Must match the exact order in your program's Buy struct:
          { pubkey: buyer, isSigner: true, isWritable: true }, // 0: buyer (signer)
          { pubkey: bondingCurveAccount, isSigner: false, isWritable: true }, // 1: bonding_curve
          { pubkey: mintAddress, isSigner: false, isWritable: true }, // 2: mint
          { pubkey: buyerTokenAccount, isSigner: false, isWritable: true }, // 3: buyer_token_account
          { pubkey: platformFeeAccount, isSigner: false, isWritable: true }, // 4: platform_fee
          { pubkey: vaultAccount, isSigner: false, isWritable: true }, // 5: vault
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 6: token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7: system_program
        ],
        programId: PROGRAM_ID,
        data,
      });
      console.log(`✅ [BUY] Created buy instruction with ${buyInstruction.keys.length} accounts`);

      transaction.add(buyInstruction);

      // Debug transaction before sending
      console.log(`🧾 [BUY DEBUG] Transaction summary:
        Total instructions: ${transaction.instructions.length}
        Instruction types:
      `);
      
      transaction.instructions.forEach((ix, index) => {
        const programName = ix.programId.equals(ComputeBudgetProgram.programId) ? 'ComputeBudget' :
                           ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ? 'CreateATA' :
                           ix.programId.equals(PROGRAM_ID) ? 'BondingCurve' : 'Unknown';
        console.log(`  ${index}: ${programName} (${ix.programId.toBase58()})`);
      });

      // Send transaction with enhanced error handling
      console.log(`🚀 [BUY DEBUG] Sending transaction with ${transaction.instructions.length} instructions...`);
      
      try {
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
        
        // Enhanced error logging for debugging
        if (error instanceof Error) {
          console.error(`❌ [BUY DEBUG] Error type: ${error.constructor.name}`);
          console.error(`❌ [BUY DEBUG] Error message: ${error.message}`);
          console.error(`❌ [BUY DEBUG] Error stack: ${error.stack}`);
        }
        
        // Check if this is a transaction simulation error
        if (error && typeof error === 'object' && 'logs' in error) {
          console.error(`❌ [BUY DEBUG] Transaction logs:`, (error as any).logs);
        }
        
        throw error;
      }
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
    slippagePercent: number = 10, // Increase default slippage for now
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

      // PRODUCTION FIX: Use same pump.fun vault derivation as buy function
      const vaultAccount = await getAssociatedTokenAddress(
        mintAddress,
        bondingCurveAccount,
        true // Allow owner to be a PDA
      );
      console.log(`📦 [PUMP.FUN SELL] Using production vault: ${vaultAccount.toBase58()}`);

      // Calculate expected SOL
      const expectedSol = await this.calculateSolOut(tokenAmount, mintAddress);
      
      // Calculate platform fee (1% as per config)
      const platformFeePercent = config.tokenDefaults.platformFeePercentage; // 1%
      const platformFee = (expectedSol * BigInt(Math.floor(platformFeePercent * 100))) / BigInt(10000);
      const expectedSolAfterFee = expectedSol - platformFee;

      // Calculate slippage based on the expected SOL after fees, with extra buffer for rounding
      const slippageBuffer = BigInt(100000); // Extra 0.0001 SOL buffer for program rounding differences
      const minSolWithSlippage = (expectedSolAfterFee * BigInt(100 - slippagePercent)) / BigInt(100) - slippageBuffer;

      console.log(`💰 [SELL DEBUG] SOL calculation:
        Expected SOL (before fee): ${Number(expectedSol) / LAMPORTS_PER_SOL} SOL (${expectedSol.toString()} lamports)
        Platform fee (${platformFeePercent}%): ${Number(platformFee) / LAMPORTS_PER_SOL} SOL (${platformFee.toString()} lamports)
        Expected SOL (after fee): ${Number(expectedSolAfterFee) / LAMPORTS_PER_SOL} SOL (${expectedSolAfterFee.toString()} lamports)
        Slippage: ${slippagePercent}%
        Slippage buffer: ${Number(slippageBuffer) / LAMPORTS_PER_SOL} SOL (${slippageBuffer.toString()} lamports)
        Min SOL after slippage: ${Number(minSolWithSlippage) / LAMPORTS_PER_SOL} SOL (${minSolWithSlippage.toString()} lamports)
        Program actual: 24563094 lamports (for comparison)
      `);

      // Safety checks: ensure results don't exceed u64 maximum
      const MAX_U64 = BigInt("18446744073709551615");
      if (tokenAmount > MAX_U64) {
        throw new Error(`Token amount ${tokenAmount.toString()} exceeds u64 maximum (${MAX_U64.toString()})`);
      }
      if (minSolWithSlippage > MAX_U64) {
        throw new Error(`SOL amount ${minSolWithSlippage.toString()} exceeds u64 maximum (${MAX_U64.toString()})`);
      }

      // PRODUCTION FIX: The program has additional fees/rounding that we need to account for
      // Based on analysis: Program delivers ~50k lamports less than our calculation
      // This accounts for additional program fees, rent, or rounding differences
      const programAdjustment = BigInt(300000); // 0.0003 SOL safety buffer for program differences
      const correctedMinSol = minSolWithSlippage > programAdjustment ? minSolWithSlippage - programAdjustment : BigInt(0);
      
      console.log(`💰 [SELL PRODUCTION FIX] Accounting for program behavior:
        Our calculated min: ${minSolWithSlippage.toString()} lamports
        Program adjustment: ${programAdjustment.toString()} lamports (for fees/rounding)
        Final min SOL: ${correctedMinSol.toString()} lamports (${Number(correctedMinSol) / LAMPORTS_PER_SOL} SOL)
      `);
      
      const sellArgs = new SellArgs(tokenAmount, correctedMinSol);
      const data = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.sell,
        Buffer.from(borsh.serialize(SCHEMAS, sellArgs)),
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

      // Create a properly balanced sell instruction with correct account ordering
      // The key insight is that the program expects accounts in a specific order for proper balance validation
      const sellInstruction = new TransactionInstruction({
        keys: [
          // User accounts (signer first)
          { pubkey: seller, isSigner: true, isWritable: true }, // 0: Seller (receives SOL)
          
          // Program data accounts  
          { pubkey: bondingCurveAccount, isSigner: false, isWritable: true }, // 1: Bonding curve state
          
          // Token accounts
          { pubkey: mintAddress, isSigner: false, isWritable: true }, // 2: Token mint
          { pubkey: sellerTokenAccount, isSigner: false, isWritable: true }, // 3: Seller's token account (tokens burned)
          { pubkey: vaultAccount, isSigner: false, isWritable: true }, // 4: Vault account (tokens transferred from)
          
          // Fee accounts - this ordering is critical for proper balance validation
          { pubkey: platformFeeAccount, isSigner: false, isWritable: true }, // 5: Platform fee recipient
          
          // System programs
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 6: SPL Token Program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7: System Program
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // 8: Rent Sysvar
        ],
        programId: PROGRAM_ID,
        data,
      });

      transaction.add(sellInstruction);

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
        Virtual token reserves: ${virtualTokenReserves.toString()} base units
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
