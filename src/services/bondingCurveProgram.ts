/**
 * Production Bonding Curve Program Service
 * Matches the deployed program: 9JQyYqCSRwhgaCPPSiyBauPb3x1wf5fnpidqgndowbWp
 *
 * Instructions:
 * - create(name, symbol, uri) - Create token with bonding curve
 * - buy(token_amount, max_sol_cost) - Buy tokens
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { config } from "@/config";
import { getWalletService } from "@/services/wallet";
import * as borsh from "borsh";

const PROGRAM_ID = new PublicKey(config.programs.bondingCurve);
const GLOBAL_PDA_SEED = "global";
const BONDING_CURVE_SEED = "bonding-curve";

// Instruction discriminators (from IDL)
const INSTRUCTION_DISCRIMINATORS = {
  create: Buffer.from([0x18, 0x1e, 0xc8, 0x28, 0x05, 0x1c, 0x07, 0x77]), // initialize
  buy: Buffer.from([0x66, 0x06, 0x3d, 0x12, 0x01, 0xda, 0xeb, 0xea]), // buy
  sell: Buffer.from([0x33, 0xe6, 0x85, 0xa4, 0x01, 0x7f, 0x83, 0xad]), // sell
};

// Borsh schema for create instruction
class CreateArgs {
  name: string;
  symbol: string;
  uri: string;

  constructor(name: string, symbol: string, uri: string) {
    this.name = name;
    this.symbol = symbol;
    this.uri = uri;
  }
}

class BuyArgs {
  tokenAmount: bigint;
  maxSolCost: bigint;

  constructor(tokenAmount: bigint, maxSolCost: bigint) {
    this.tokenAmount = tokenAmount;
    this.maxSolCost = maxSolCost;
  }
}

class SellArgs {
  tokenAmount: bigint;
  minSolReceived: bigint;

  constructor(tokenAmount: bigint, minSolReceived: bigint) {
    this.tokenAmount = tokenAmount;
    this.minSolReceived = minSolReceived;
  }
}

const SCHEMAS = new Map<any, any>([
  [
    CreateArgs,
    {
      kind: "struct",
      fields: [
        ["name", "string"],
        ["symbol", "string"],
        ["uri", "string"],
      ],
    },
  ],
  [
    BuyArgs,
    {
      kind: "struct",
      fields: [
        ["tokenAmount", "u64"],
        ["maxSolCost", "u64"],
      ],
    },
  ],
  [
    SellArgs,
    {
      kind: "struct",
      fields: [
        ["tokenAmount", "u64"],
        ["minSolReceived", "u64"],
      ],
    },
  ],
]);

export class BondingCurveProgramProduction {
  private connection: Connection;
  private walletService = getWalletService();
  private programId: PublicKey = PROGRAM_ID;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
  }

  /**
   * Get global configuration PDA
   */
  getGlobalPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(GLOBAL_PDA_SEED)],
      this.programId
    );
  }

  /**
   * Get bonding curve PDA for a mint
   */
  getBondingCurvePda(mintAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), mintAddress.toBuffer()],
      this.programId
    );
  }

  /**
   * Check if global configuration is initialized
   */
  async isGlobalInitialized(): Promise<boolean> {
    try {
      const [globalPda] = this.getGlobalPda();
      const accountInfo = await this.connection.getAccountInfo(globalPda);
      return accountInfo !== null && accountInfo.owner.equals(this.programId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get global state from on-chain account
   */
  async getGlobalState(): Promise<{
    authority: PublicKey;
    feeRecipient: PublicKey;
    migrationAuthority: PublicKey;
    feeBasisPoints: number;
  }> {
    const [globalPda] = this.getGlobalPda();
    const accountInfo = await this.connection.getAccountInfo(globalPda);

    if (!accountInfo) {
      throw new Error("Global configuration not initialized");
    }

    // Parse account data based on Global struct layout:
    // discriminator: 8 bytes (0-7)
    // authority: 32 bytes (8-39)
    // fee_recipient: 32 bytes (40-71)
    // migration_authority: 32 bytes (72-103)
    // initial_virtual_token_reserves: 8 bytes (104-111)
    // initial_virtual_sol_reserves: 8 bytes (112-119)
    // initial_real_token_reserves: 8 bytes (120-127)
    // token_total_supply: 8 bytes (128-135)
    // creator_allocation: 8 bytes (136-143)
    // fee_basis_points: 2 bytes (144-145)
    // paused: 1 byte (146)
    // bump: 1 byte (147)
    const data = accountInfo.data;

    return {
      authority: new PublicKey(data.subarray(8, 40)),
      feeRecipient: new PublicKey(data.subarray(40, 72)),
      migrationAuthority: new PublicKey(data.subarray(72, 104)),
      feeBasisPoints: data.readUInt16LE(144),
    };
  }

  /**
   * Get bonding curve state from on-chain account
   */
  async getBondingCurveState(mintAddress: PublicKey): Promise<{
    complete: boolean;
    realTokenReserves: bigint;
    realSolReserves: bigint;
  }> {
    const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);
    const accountInfo = await this.connection.getAccountInfo(bondingCurvePda);

    if (!accountInfo) {
      throw new Error("Bonding curve not found");
    }

    // Parse account data - adjust offsets based on actual BondingCurve struct
    const data = accountInfo.data;

    return {
      complete: false, // TODO: Parse from actual account data
      realTokenReserves: BigInt(0), // TODO: Parse from actual account data
      realSolReserves: BigInt(0), // TODO: Parse from actual account data
    };
  }

  /**
   * Initialize global configuration (one-time setup, admin only)
   * This must be called once before anyone can trade
   */
  async initializeGlobal(feeBasisPoints: number = 100): Promise<string> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const [globalPda] = this.getGlobalPda();
    const authority = this.walletService.publicKey;
    const feeRecipient = new PublicKey(config.platform.feeWallet);

    // Create instruction data for initializeGlobal
    const data = Buffer.alloc(10);
    // Write discriminator (first 8 bytes) - we need to calculate this
    // For now, use placeholder
    data.writeUInt16LE(feeBasisPoints, 8);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: globalPda, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: feeRecipient, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    const transaction = new Transaction().add(instruction);
    return await this.sendTransaction(transaction);
  }

  /**
   * Create token with bonding curve
   * This calls the deployed program's 'create' instruction
   */
  async createToken(
    mintAddress: PublicKey,
    name: string,
    symbol: string,
    metadataUri: string
  ): Promise<string> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const creator = this.walletService.publicKey;

    // Get PDAs
    const [globalPda] = this.getGlobalPda();
    const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);

    // Get vault (bonding curve's token account)
    const vaultAccount = await getAssociatedTokenAddress(
      mintAddress,
      bondingCurvePda,
      true // allowOwnerOffCurve
    );

    // Get creator's token account
    const creatorTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      creator
    );

    // Create instruction data
    const createArgs = new CreateArgs(name, symbol, metadataUri);
    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.create,
      Buffer.from(borsh.serialize(SCHEMAS, createArgs)),
    ]);

    // Build transaction
    const transaction = new Transaction();

    // Check if creator token account exists
    const creatorTokenAccountInfo = await this.connection.getAccountInfo(
      creatorTokenAccount
    );
    if (!creatorTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          creator,
          creatorTokenAccount,
          creator,
          mintAddress
        )
      );
    }

    // Create instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: globalPda, isSigner: false, isWritable: false },
        { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true },
        { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    transaction.add(instruction);

    // Send transaction
    return await this.sendTransaction(transaction);
  }

  /**
   * Buy tokens from bonding curve
   * @param mintAddress - Token mint address
   * @param tokenAmount - Exact amount of tokens to buy (with decimals)
   * @param maxSolCost - Maximum SOL willing to spend (slippage protection, in lamports)
   */
  async buyTokens(
    mintAddress: PublicKey,
    tokenAmount: bigint,
    maxSolCost: bigint
  ): Promise<string> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const buyer = this.walletService.publicKey;

    // Get PDAs
    const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);

    // Get accounts
    const buyerTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      buyer
    );
    const vaultAccount = await getAssociatedTokenAddress(
      mintAddress,
      bondingCurvePda,
      true
    );

    // Get fee recipient from config
    const feeRecipient = new PublicKey(config.platform.feeWallet);

    // Create instruction data (Rust params: token_amount, max_sol_cost)
    const buyArgs = new BuyArgs(tokenAmount, maxSolCost);
    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.buy,
      Buffer.from(borsh.serialize(SCHEMAS, buyArgs)),
    ]);

    // Build transaction
    const transaction = new Transaction();

    // Get global PDA - REQUIRED by the deployed program
    const [globalPda] = this.getGlobalPda();

    // Check if buyer token account exists
    const buyerTokenAccountInfo = await this.connection.getAccountInfo(
      buyerTokenAccount
    );
    if (!buyerTokenAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          mintAddress
        )
      );
    }

    // Buy instruction - must match Rust struct order EXACTLY
    // Order from lib.rs: global, bondingCurve, buyer, mint, buyerTokenAccount, vault, feeRecipient,
    //                    tokenProgram, associatedTokenProgram, systemProgram, rent
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: globalPda, isSigner: false, isWritable: false },
        { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true },
        { pubkey: feeRecipient, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar
      ],
      programId: this.programId,
      data,
    });

    transaction.add(instruction);

    // Send transaction
    return await this.sendTransaction(transaction);
  }

  /**
   * Sell tokens to bonding curve
   * @param mintAddress - Token mint address
   * @param tokenAmount - Amount of tokens to sell (with decimals)
   * @param minSolReceived - Minimum SOL expected (slippage protection, in lamports)
   */
  async sellTokens(
    mintAddress: PublicKey,
    tokenAmount: bigint,
    minSolReceived: bigint
  ): Promise<string> {
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const seller = this.walletService.publicKey;

    console.log("💸 [SELL] Starting sell transaction");
    console.log("💸 [SELL] Mint:", mintAddress.toBase58());
    console.log("💸 [SELL] Token amount:", tokenAmount.toString());
    console.log("💸 [SELL] Min SOL:", minSolReceived.toString());

    // Get PDAs
    const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);
    const [globalPda] = this.getGlobalPda();

    console.log("💸 [SELL] Bonding curve PDA:", bondingCurvePda.toBase58());
    console.log("💸 [SELL] Global PDA:", globalPda.toBase58());

    // Get accounts
    const sellerTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      seller
    );
    const vaultAccount = await getAssociatedTokenAddress(
      mintAddress,
      bondingCurvePda,
      true
    );

    // Get fee recipient from global config
    const globalState = await this.getGlobalState();
    const feeRecipient = globalState.feeRecipient;

    console.log("💸 [SELL] Seller token account:", sellerTokenAccount.toBase58());
    console.log("💸 [SELL] Vault account:", vaultAccount.toBase58());
    console.log("💸 [SELL] Fee recipient:", feeRecipient.toBase58());

    // Create instruction data (Rust params: token_amount, min_sol_received)
    const sellArgs = new SellArgs(tokenAmount, minSolReceived);
    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.sell,
      Buffer.from(borsh.serialize(SCHEMAS, sellArgs)),
    ]);

    console.log("💸 [SELL] Instruction data length:", data.length);

    // Build transaction
    const transaction = new Transaction();

    // Sell instruction - must match Rust struct order EXACTLY
    // Order from lib.rs: global, bondingCurve, seller, mint, sellerTokenAccount, vault, feeRecipient,
    //                    tokenProgram, systemProgram
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: globalPda, isSigner: false, isWritable: false },
        { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true },
        { pubkey: feeRecipient, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    console.log("💸 [SELL] Instruction created with 9 accounts");
    transaction.add(instruction);

    // Send transaction
    console.log("💸 [SELL] Sending transaction...");
    return await this.sendTransaction(transaction);
  }

  /**
   * Send transaction with wallet
   */
  private async sendTransaction(transaction: Transaction): Promise<string> {
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.walletService.publicKey!;

    // Sign and send
    const signed = await this.walletService.signTransaction!(transaction);
    const signature = await this.connection.sendRawTransaction(
      signed.serialize()
    );

    // Confirm
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    });

    return signature;
  }

  /**
   * Calculate how many tokens you get for a given SOL amount
   * Uses constant product formula: x * y = k
   */
  async calculateTokensForSol(
    mintAddress: PublicKey,
    solAmount: bigint
  ): Promise<bigint> {
    try {
      const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(bondingCurvePda);

      if (!accountInfo) {
        throw new Error("Bonding curve not found");
      }

      // TODO: Deserialize bonding curve account to get actual reserves
      // For now, use default values
      const virtualSolReserves = BigInt(30_000_000_000); // 30 SOL
      const virtualTokenReserves = BigInt(1_073_000_000_000_000); // 1.073B tokens with 6 decimals

      // Constant product formula: (x + dx) * (y - dy) = x * y
      // Solving for dy (tokens out): dy = y * dx / (x + dx)
      const tokensOut =
        (virtualTokenReserves * solAmount) / (virtualSolReserves + solAmount);

      return tokensOut;
    } catch (error) {
      console.error("Error calculating tokens for SOL:", error);
      throw error;
    }
  }

  /**
   * Calculate how much SOL you get for selling tokens
   * Uses constant product formula: x * y = k
   */
  async calculateSolForTokens(
    mintAddress: PublicKey,
    tokenAmount: bigint
  ): Promise<bigint> {
    try {
      const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(bondingCurvePda);

      if (!accountInfo) {
        throw new Error("Bonding curve not found");
      }

      // TODO: Deserialize bonding curve account to get actual reserves
      // For now, use default values
      const virtualSolReserves = BigInt(30_000_000_000); // 30 SOL
      const virtualTokenReserves = BigInt(1_073_000_000_000_000); // 1.073B tokens with 6 decimals

      // Constant product formula: (x - dx) * (y + dy) = x * y
      // Solving for dx (SOL out): dx = x * dy / (y + dy)
      const solOut =
        (virtualSolReserves * tokenAmount) / (virtualTokenReserves + tokenAmount);

      return solOut;
    } catch (error) {
      console.error("Error calculating SOL for tokens:", error);
      throw error;
    }
  }

  /**
   * Get current token price in SOL from bonding curve
   * This is a helper method for price oracle
   */
  async getCurrentPrice(mintAddress: PublicKey): Promise<number> {
    try {
      const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(bondingCurvePda);

      if (!accountInfo) {
        // Bonding curve not created yet - return 0 to trigger fallback
        return 0;
      }

      // Parse bonding curve data (simplified - you may need to adjust based on actual account layout)
      // Assuming the account stores virtualSolReserves and virtualTokenReserves
      // Price = virtualSolReserves / virtualTokenReserves

      // For now, return a placeholder that uses the constant product formula
      // You'll need to deserialize the actual bonding curve account data
      const virtualSolReserves = 30; // 30 SOL in base units
      const virtualTokenReserves = 1073000000; // 1.073B tokens

      return virtualSolReserves / virtualTokenReserves;
    } catch (error) {
      // Silently return 0 for tokens without bonding curves
      return 0;
    }
  }

  /**
   * Get market cap in USD
   * This is a helper method for price oracle
   */
  async getMarketCap(mintAddress: PublicKey, solPriceUSD: number): Promise<number> {
    try {
      const tokenPriceSOL = await this.getCurrentPrice(mintAddress);
      const totalSupply = 1_000_000_000; // 1B tokens (fixed supply)
      return tokenPriceSOL * totalSupply * solPriceUSD;
    } catch (error) {
      console.error("Error getting market cap:", error);
      return 0;
    }
  }

  /**
   * Get 24h trading volume in USD
   * This is a helper method for price oracle
   */
  async get24hVolume(tokenId: string, solPriceUSD: number): Promise<number> {
    // This would require tracking transactions on-chain or in a backend database
    // For now, return 0 as a placeholder
    // You'll need to implement this with your backend API
    return 0;
  }
}

export const bondingCurveProgramProduction = new BondingCurveProgramProduction();

// Alias for backward compatibility
export const bondingCurveProgram = bondingCurveProgramProduction;
export const BondingCurveProgram = BondingCurveProgramProduction;
