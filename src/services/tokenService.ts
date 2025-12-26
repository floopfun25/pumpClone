import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createSetAuthorityInstruction,
  AuthorityType,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { getWalletService } from "./wallet";
import { BondingCurveService } from "./bondingCurve";
import { solanaProgram } from "./solanaProgram";
import { tokenAPI, userAPI } from "./api";
import { tokenDefaults, solanaConfig, platformConfig } from "@/config";

// Token creation types
export interface TokenCreationData {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  // Advanced creation options
  totalSupply?: number;
  creatorSharePercentage?: number;
  lockPercentage?: number;
  lockDurationDays?: number;
  prebuyAmount?: number;
  unlockSchedule?: "immediate" | "linear" | "cliff" | "custom";
}

export interface TokenLockSettings {
  lockType: "creator" | "team" | "liquidity" | "marketing";
  amount: number;
  durationDays: number;
  unlockSchedule: UnlockScheduleItem[];
}

export interface UnlockScheduleItem {
  date: string;
  percentage: number;
  amount: number;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators?: Array<{
      address: string;
      share: number;
      verified?: boolean;
    }>;
  };
}

export interface CreatedToken {
  mintAddress: string;
  metadataUri: string;
  bondingCurveAddress: string;
  signature: string;
  tokenAccount: string;
}

const walletService = getWalletService();

class TokenService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection(solanaConfig.rpcUrl, "confirmed");
  }

  /**
   * Create a new SPL token with metadata and bonding curve
   */
  async createToken(tokenData: TokenCreationData): Promise<CreatedToken> {
    if (!walletService.connected || !walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      // Step 0: Pre-flight checks
      console.log("🔍 Creating token...");

      // Check wallet balance
      const balance = await this.connection.getBalance(walletService.publicKey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;

      if (balanceSOL < 0.01) {
        throw new Error(
          `Insufficient SOL balance. You have ${balanceSOL.toFixed(4)} SOL, but need at least 0.01 SOL for transaction fees.`,
        );
      }

      // Step 1: Image will be uploaded with token creation to backend
      console.log("📸 Image will be uploaded to Spring Boot backend");

      // Step 2: Metadata will be created by backend
      console.log("📝 Metadata will be created by Spring Boot backend");

      // Temporary metadata URI (backend will generate the real one)
      const metadataUri = "pending";

      // Step 3: Create mint account
      console.log("🔨 Creating mint account...");

      // Generate mint keypair
      const mintKeypair = Keypair.generate();
      const mintAddress = mintKeypair.publicKey;

      console.log("🎯 Mint address:", mintAddress.toBase58());

      // Step 3A: Create mint account using VersionedTransaction
      const rentExemptAmount = await getMinimumBalanceForRentExemptMint(
        this.connection,
      );

      // Get fresh blockhash for the mint transaction
      const {
        blockhash: mintBlockhash,
        lastValidBlockHeight: mintValidHeight,
      } = await this.connection.getLatestBlockhash("finalized");

      const instructions = [
        SystemProgram.createAccount({
          fromPubkey: walletService.publicKey,
          newAccountPubkey: mintAddress,
          space: MINT_SIZE,
          lamports: rentExemptAmount,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintAddress,
          tokenDefaults.decimals,
          walletService.publicKey, // mint authority
          walletService.publicKey, // freeze authority
        ),
      ];

      // Create VersionedTransaction using TransactionMessage
      const messageV0 = new TransactionMessage({
        payerKey: walletService.publicKey,
        recentBlockhash: mintBlockhash,
        instructions: instructions,
      }).compileToV0Message();

      const transactionV0 = new VersionedTransaction(messageV0);

      console.log("🖊️ Signing transactions...");

      try {
        // Sign with wallet (this will work with VersionedTransaction)
        const signedTx = await walletService.signTransaction(transactionV0);

        // Add mint keypair signature manually for account creation
        if (
          signedTx instanceof VersionedTransaction ||
          typeof (signedTx as any).sign === "function"
        ) {
          try {
            // For VersionedTransaction, we need to use a different approach
            // Add the mint keypair signature manually
            const signMethod = (signedTx as any).sign;
            if (typeof signMethod === "function") {
              signMethod.call(signedTx, [mintKeypair]);
            } else {
              throw new Error("Sign method not available on transaction");
            }
          } catch (signMethodError: any) {
            console.error("❌ Failed to add mint signature:", signMethodError);
            throw new Error(
              `Failed to add mint keypair signature: ${signMethodError.message}`,
            );
          }

          const txSignature = await this.connection.sendRawTransaction(
            signedTx.serialize(),
          );
          console.log("✅ Mint created");

          // Wait for confirmation
          await this.connection.confirmTransaction({
            signature: txSignature,
            blockhash: mintBlockhash,
            lastValidBlockHeight: mintValidHeight,
          });

          // Continue with token operations...
          console.log("🏦 Creating token account...");
          const associatedTokenAddress = await getAssociatedTokenAddress(
            mintAddress,
            walletService.publicKey,
          );

          const tokenTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              walletService.publicKey, // payer
              associatedTokenAddress, // ata
              walletService.publicKey, // owner
              mintAddress, // mint
            ),
            createMintToInstruction(
              mintAddress,
              associatedTokenAddress,
              walletService.publicKey, // mint authority
              tokenDefaults.totalSupply * Math.pow(10, tokenDefaults.decimals),
            ),
          );

          // Transfer mint authority to bonding curve PDA
          const BONDING_CURVE_PROGRAM_ID = new PublicKey("Hg4PXsCRaVRjeYgx75GJioGqCQ6GiGWGGHTnpcTLE9CY");
          const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding_curve"), mintAddress.toBuffer()],
            BONDING_CURVE_PROGRAM_ID,
          );

          tokenTx.add(
            createSetAuthorityInstruction(
              mintAddress,
              walletService.publicKey, // Current authority (creator)
              AuthorityType.MintTokens,
              bondingCurvePDA, // New authority (bonding curve)
            ),
          );

          const tokenTxSignature = await walletService.sendTransaction(tokenTx);
          console.log("✅ Token minted");

          // Step 4: Initialize bonding curve state (no transaction needed)
          const bondingCurveState = BondingCurveService.createInitialState(
            mintAddress,
            tokenData.totalSupply || tokenDefaults.totalSupply,
          );

          // Step 5: Save to backend via Spring Boot API
          console.log("💾 Saving to Spring Boot backend...");
          if (tokenData.imageFile) {
            await tokenAPI.createToken({
              name: tokenData.name,
              symbol: tokenData.symbol,
              description: tokenData.description,
              imageFile: tokenData.imageFile,
              mintAddress: mintAddress.toBase58(),
              metadataUri: metadataUri,
              totalSupply: tokenData.totalSupply || tokenDefaults.totalSupply,
            });
          } else {
            throw new Error("Image file is required for token creation");
          }

          console.log("🎉 TOKEN CREATED SUCCESSFULLY!");
          console.log("📍 Mint Address:", mintAddress.toBase58());

          console.log("✅ Token saved to backend successfully");

          return {
            mintAddress: mintAddress.toBase58(),
            metadataUri: metadataUri,
            bondingCurveAddress: "initialized",
            signature: tokenTxSignature,
            tokenAccount: associatedTokenAddress.toBase58(),
          };
        } else if (typeof (signedTx as any).partialSign === "function") {
          // Legacy Transaction with partialSign method
          console.log(
            "✅ Got Legacy Transaction with partialSign, using partialSign...",
          );
          (signedTx as any).partialSign(mintKeypair);
          const txSignature = await this.connection.sendRawTransaction(
            (signedTx as any).serialize(),
          );
          console.log("✅ Legacy transaction sent:", txSignature);

          // Wait for confirmation
          await this.connection.confirmTransaction({
            signature: txSignature,
            blockhash: mintBlockhash,
            lastValidBlockHeight: mintValidHeight,
          });
          console.log("✅ Mint created successfully with Legacy Transaction!");

          // Continue with token operations (same as above)
          throw new Error(
            "Legacy transaction token operations not implemented in this simplified version",
          );
        } else {
          // Unsupported transaction type
          console.error("❌ Unsupported transaction type or missing methods");
          console.error(
            "Available methods:",
            Object.getOwnPropertyNames(signedTx),
          );
          console.error(
            "Constructor:",
            (signedTx as any).constructor?.name || "Unknown",
          );
          throw new Error(
            `Unsupported transaction type: ${(signedTx as any).constructor?.name || "Unknown"}. Missing required signing methods.`,
          );
        }
      } catch (signError: any) {
        console.error("❌ Transaction signing failed:", signError);

        // Enhanced error reporting
        if (signError.message?.includes("User rejected")) {
          throw new Error(
            "Transaction was rejected. Please approve the transaction in your wallet and try again.",
          );
        } else if (signError.message?.includes("insufficient")) {
          throw new Error(
            "Insufficient SOL balance. Please add more SOL to your wallet.",
          );
        } else {
          throw new Error(`Transaction signing failed: ${signError.message}`);
        }
      }
    } catch (error) {
      console.error("❌ Token creation failed:", error);

      // Enhanced error reporting
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack?.split("\n").slice(0, 5),
        });

        // Specific error handling
        if (error.message.includes("insufficient")) {
          throw new Error(
            "Insufficient SOL balance for token creation. Please add more SOL to your wallet.",
          );
        } else if (error.message.includes("blockhash")) {
          throw new Error(
            "Network error: Recent blockhash expired. Please try again.",
          );
        } else if (error.message.includes("signature")) {
          throw new Error(
            "Transaction signing failed. Please approve the transaction in your wallet.",
          );
        } else if (error.message.includes("WalletSignTransactionError")) {
          throw new Error(
            "Transaction signing was cancelled. Please try again and approve the transaction.",
          );
        } else {
          // Re-throw the original error if no specific handling applies
          throw error;
        }
      } else {
        // Re-throw non-Error objects
        throw error;
      }
    }
  }

  // Note: Image upload, metadata upload, and database storage are now handled by Spring Boot backend
  // through the tokenAPI.createToken() call

  /**
   * Get token metadata from URI
   */
  async getTokenMetadata(metadataUri: string): Promise<TokenMetadata> {
    try {
      const response = await fetch(metadataUri);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch token metadata:", error);
      throw new Error(
        `Failed to fetch metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Validate token creation data
   */
  validateTokenData(tokenData: TokenCreationData): string[] {
    const errors: string[] = [];

    if (!tokenData.name || tokenData.name.trim().length === 0) {
      errors.push("Token name is required");
    }

    if (!tokenData.symbol || tokenData.symbol.trim().length === 0) {
      errors.push("Token symbol is required");
    }

    if (tokenData.symbol && tokenData.symbol.length > 8) {
      errors.push("Token symbol must be 8 characters or less");
    }

    if (tokenData.name && tokenData.name.length > 32) {
      errors.push("Token name must be 32 characters or less");
    }

    if (tokenData.description && tokenData.description.length > 500) {
      errors.push("Description must be 500 characters or less");
    }

    // Validate image file
    if (tokenData.imageFile) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (tokenData.imageFile.size > maxSize) {
        errors.push("Image file must be smaller than 5MB");
      }

      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(tokenData.imageFile.type)) {
        errors.push("Image must be JPEG, PNG, GIF, or WebP format");
      }
    }

    return errors;
  }

  // Note: Token locks and prebuy features will be handled by Spring Boot backend in future

  /**
   * Estimate creation cost
   */
  async estimateCreationCost(): Promise<{
    creationFee: number;
    rentExempt: number;
    transaction: number;
    total: number;
  }> {
    try {
      const rentExemptAmount = await getMinimumBalanceForRentExemptMint(
        this.connection,
      );
      const rentExempt = rentExemptAmount / LAMPORTS_PER_SOL;
      const creationFee = tokenDefaults.creationFee;
      const transaction = 0.005; // Estimated transaction fee

      return {
        creationFee,
        rentExempt,
        transaction,
        total: creationFee + rentExempt + transaction,
      };
    } catch (error) {
      console.error("Failed to estimate creation cost:", error);
      return {
        creationFee: tokenDefaults.creationFee,
        rentExempt: 0.002,
        transaction: 0.005,
        total: tokenDefaults.creationFee + 0.007,
      };
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService();
