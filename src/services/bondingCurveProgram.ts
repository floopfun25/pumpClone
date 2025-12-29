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
  solAmount: bigint;
  minTokensReceived: bigint;

  constructor(solAmount: bigint, minTokensReceived: bigint) {
    this.solAmount = solAmount;
    this.minTokensReceived = minTokensReceived;
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

const SCHEMAS = new Map([
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
        ["solAmount", "u64"],
        ["minTokensReceived", "u64"],
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
   * @param solAmount - Amount of SOL to spend (in lamports)
   * @param minTokensReceived - Minimum tokens expected (slippage protection)
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: bigint,
    minTokensReceived: bigint
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

    // Create instruction data (IDL: solAmount, minTokensReceived)
    const buyArgs = new BuyArgs(solAmount, minTokensReceived);
    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.buy,
      Buffer.from(borsh.serialize(SCHEMAS, buyArgs)),
    ]);

    // Build transaction
    const transaction = new Transaction();

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

    // Buy instruction - must match IDL account order exactly
    // IDL order: buyer, bondingCurve, mint, buyerTokenAccount, platformFee, vault, tokenProgram, systemProgram
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true }, // FIXED: mint must be writable
        { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: feeRecipient, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
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

    // Get PDAs
    const [bondingCurvePda] = this.getBondingCurvePda(mintAddress);

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

    // Get fee recipient from config
    const feeRecipient = new PublicKey(config.platform.feeWallet);

    // Create instruction data (IDL: tokenAmount, minSolReceived)
    const sellArgs = new SellArgs(tokenAmount, minSolReceived);
    const data = Buffer.concat([
      INSTRUCTION_DISCRIMINATORS.sell,
      Buffer.from(borsh.serialize(SCHEMAS, sellArgs)),
    ]);

    // Build transaction
    const transaction = new Transaction();

    // Sell instruction - must match IDL account order exactly
    // IDL order: seller, bondingCurve, mint, sellerTokenAccount, platformFee, vault, tokenProgram, systemProgram
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: feeRecipient, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    transaction.add(instruction);

    // Send transaction
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
