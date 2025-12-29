import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddress,
  getMint,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
// Import metaplex metadata (skip metadata creation if not available)
import { getWalletService } from "./wallet";
import { config } from "@/config";
import { uploadToIPFS } from "./ipfsService";
import { bondingCurveProgram } from "./bondingCurveProgram";

export interface TokenCreationParams {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  imageUrl?: string;
  decimals?: number;
  initialSupply?: number;
  creatorPercentage?: number;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  totalSupply?: number;
  lockPercentage?: number;
  lockDurationDays?: number;
  prebuyAmount?: number;
  unlockSchedule?: string;
}

export interface CreatedTokenInfo {
  mintAddress: string;
  tokenAccount: string;
  metadataAccount: string;
  signature: string;
  tokenId: string;
  prebuySignature?: string; // ADDED: Optional prebuy transaction signature
}

export class TokenCreationService {
  private connection: Connection;
  private walletService = getWalletService();

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
  }

  /**
   * Create a new SPL token with metadata and bonding curve (Pump.fun style)
   */
  async createToken(params: TokenCreationParams): Promise<CreatedTokenInfo> {
    console.log("🪙 Starting pump.fun-style token creation...");

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const payer = this.walletService.publicKey;
    const decimals = params.decimals || config.tokenDefaults.decimals;
    // Use totalSupply first (from form), then initialSupply, then default to 1B
    const initialSupply = params.totalSupply || params.initialSupply || 1_000_000_000;

    try {
      // Step 1: Upload metadata to IPFS (optional - fallback if fails)
      console.log("📤 Uploading metadata to IPFS...");
      let metadataUri = "";
      try {
        metadataUri = await this.uploadMetadata(params);
        console.log("✅ Metadata uploaded to IPFS:", metadataUri);
      } catch (ipfsError) {
        console.error("❌ CRITICAL: IPFS metadata upload failed:", ipfsError);
        throw new Error(
          `Token creation failed: Unable to upload metadata to IPFS. ${ipfsError instanceof Error ? ipfsError.message : "Unknown error"}`
        );
      }

      // Step 2: Generate mint keypair
      const { Keypair } = await import("@solana/web3.js");
      const mintKeypair = Keypair.generate();
      console.log(
        "🔑 Generated mint address:",
        mintKeypair.publicKey.toBase58(),
      );

      // Step 3: Create mint account ONLY (no initial minting)
      const mintSignature = await this.createMintAccount(
        mintKeypair,
        payer,
        decimals,
        metadataUri,
        params,
      );

      // Step 4: Initialize bonding curve (CRITICAL for production)
      console.log("🎯 Creating token with bonding curve...");
      let bondingCurveSignature = "";

      try {
        bondingCurveSignature = await bondingCurveProgram.createToken(
          mintKeypair.publicKey,
          params.name,
          params.symbol,
          metadataUri
        );
        console.log("✅ Token and bonding curve created successfully:", bondingCurveSignature);
      } catch (bondingCurveError) {
        console.error("❌ CRITICAL: Bonding curve creation failed:", bondingCurveError);
        // For production, bonding curve MUST be initialized for trading to work
        throw new Error(`Token creation failed: Bonding curve creation failed. ${bondingCurveError instanceof Error ? bondingCurveError.message : "Unknown error"}`);
      }

      // Step 5: Save to database (optional - can be done without auth)
      let tokenId = "created";
      try {
        tokenId = await this.saveTokenToDatabase(
          mintKeypair.publicKey.toBase58(),
          mintSignature,
          params,
          metadataUri,
        );
      } catch (dbError) {
        console.warn("⚠️ Database save failed (token still created on-chain):", dbError);
        // Token is still created successfully on-chain
      }

      // Step 6: Get account addresses
      const tokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        payer,
      );

      const metadataAccount = await this.getMetadataAccount(
        mintKeypair.publicKey,
      );

      console.log("✅ Pump.fun-style token creation completed successfully!");

      // Step 7: Execute prebuy if requested
      let prebuySignature = "";
      if (params.prebuyAmount && params.prebuyAmount > 0) {
        console.log(`💰 Executing prebuy: ${params.prebuyAmount} SOL`);
        try {
          const prebuyResult = await bondingCurveProgram.buyTokens(
            mintKeypair.publicKey,
            BigInt(params.prebuyAmount * LAMPORTS_PER_SOL),
            BigInt(999999999 * LAMPORTS_PER_SOL), // Max SOL cost (very high for initial buy)
          );
          prebuySignature = prebuyResult;
          console.log(`✅ Prebuy completed: ${prebuyResult}`);
        } catch (prebuyError) {
          console.error("⚠️ Prebuy failed (token still created):", prebuyError);
          // Token creation succeeded, prebuy is optional
        }
      }

      return {
        mintAddress: mintKeypair.publicKey.toBase58(),
        tokenAccount: tokenAccount.toBase58(),
        metadataAccount: metadataAccount.toBase58(),
        signature: mintSignature,
        tokenId,
        prebuySignature, // ADDED: Return prebuy signature if executed
      };
    } catch (error) {
      console.error("❌ Token creation failed:", error);
      throw new Error(`Token creation failed: ${error}`);
    }
  }

  /**
   * Upload token metadata to IPFS
   */
  private async uploadMetadata(params: TokenCreationParams): Promise<string> {
    let imageUrl = params.imageUrl;

    // Upload image to IPFS if file is provided
    if (params.imageFile) {
      console.log("📸 Uploading image to IPFS...");
      imageUrl = await uploadToIPFS(params.imageFile);
    }

    // Create metadata object
    const metadata = {
      name: params.name,
      symbol: params.symbol,
      description: params.description,
      image: imageUrl,
      attributes: [],
      properties: {
        files: [
          {
            uri: imageUrl,
            type: params.imageFile?.type || "image/png",
          },
        ],
        category: "image",
        creators: [
          {
            address: this.walletService.publicKey!.toBase58(),
            share: 100,
          },
        ],
      },
    };

    // Upload metadata to IPFS
    const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
      type: "application/json",
    });
    const metadataFile = new File([metadataBlob], "metadata.json", {
      type: "application/json",
    });

    return await uploadToIPFS(metadataFile);
  }

  /**
   * Create mint account only (no initial minting - bonding curve will handle that)
   */
  private async createMintAccount(
    mintKeypair: any,
    payer: PublicKey,
    decimals: number,
    metadataUri: string,
    params: TokenCreationParams,
  ): Promise<string> {
    const transaction = new Transaction();

    // Calculate rent for mint account
    const lamports = await getMinimumBalanceForRentExemptMint(this.connection);

    // Create mint account
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
    );

    // Initialize mint with creator as temporary authority (will transfer later)
    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        payer, // Temporary mint authority (creator)
        payer, // Freeze authority stays with creator
      ),
    );

    // NOTE: No initial minting or authority transfer here
    // The bonding curve program will handle:
    // 1. Setting itself as mint authority
    // 2. Minting the total supply to bonding curve reserves
    // 3. Managing all token distribution via bonding curve math

    // ADDED: Create Metaplex metadata account (on-chain metadata for wallets)
    try {
      const { createCreateMetadataAccountV3Instruction } = await import("@metaplex-foundation/mpl-token-metadata");

      // Derive metadata account PDA
      const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintKeypair.publicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );

      const metadataData = {
        name: params.name,
        symbol: params.symbol,
        uri: metadataUri,
        sellerFeeBasisPoints: 0,
        creators: null,
        collection: null,
        uses: null,
      };

      const createMetadataIx = createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAccount,
          mint: mintKeypair.publicKey,
          mintAuthority: payer,
          payer: payer,
          updateAuthority: payer,
        },
        {
          createMetadataAccountArgsV3: {
            data: metadataData,
            isMutable: true,
            collectionDetails: null,
          },
        },
      );

      transaction.add(createMetadataIx);
      console.log("✅ Added Metaplex metadata creation instruction");
    } catch (metadataError) {
      console.warn("⚠️ Metaplex metadata creation skipped:", metadataError);
      // Non-critical - token will still be created, but won't display properly in wallets
    }

    // Add platform fee (use config value)
    const platformFeeAccount = new PublicKey(config.platform.feeWallet);
    const creationFeeSOL = config.tokenDefaults.creationFee; // 0.02 SOL from config
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: platformFeeAccount,
        lamports: creationFeeSOL * LAMPORTS_PER_SOL,
      }),
    );
    console.log(`💰 Platform fee: ${creationFeeSOL} SOL`);

    // Sign and send transaction
    transaction.feePayer = payer;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    // Sign transaction with wallet service and mint keypair
    const signedTransaction = await this.walletService.signTransaction(transaction);
    signedTransaction.partialSign(mintKeypair);

    // Send the signed transaction directly
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    
    // Confirm the transaction
    await this.connection.confirmTransaction(signature, "confirmed");

    console.log("🎉 Token created successfully! Signature:", signature);
    return signature;
  }

  /**
   * Get metadata account PDA (with fallback)
   */
  private async getMetadataAccount(
    mintPublicKey: PublicKey,
  ): Promise<PublicKey> {
    // Fallback: return mint address (metadata creation disabled for now)
    console.warn("Using mint address as metadata account fallback");
    return mintPublicKey;
  }

  /**
   * Save token information to database
   */
  private async saveTokenToDatabase(
    mintAddress: string,
    signature: string,
    params: TokenCreationParams,
    metadataUri: string,
  ): Promise<string> {
    console.log("💾 Saving token to database...");

    try {
      // Check if user is authenticated, if not, authenticate first
      const { useAuthStore } = await import("@/stores/auth");
      const authStore = useAuthStore();

      if (!authStore.isAuthenticated) {
        console.log("🔐 User not authenticated, signing in with wallet...");
        try {
          await authStore.signInWithWallet();
          console.log("✅ User authenticated successfully");
        } catch (authError: any) {
          console.error("❌ Authentication failed:", authError);
          throw new Error(`Authentication required to create token: ${authError.message}`);
        }
      }

      // Use backend API to create token
      const { tokenAPI } = await import("@/services/api");

      const decimals = params.decimals || config.tokenDefaults.decimals;
      // Use totalSupply first (from form), then initialSupply, then default to 1B
      const supplyInTokens = params.totalSupply || params.initialSupply || 1_000_000_000;
      const totalSupply = supplyInTokens * Math.pow(10, decimals);

      // Convert image URL back to File if needed (or use the original file)
      // For now, we'll create a placeholder since the image was already uploaded
      const imageFile = params.imageFile || new File([], params.imageUrl || "image.png");

      const token = await tokenAPI.createToken({
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        imageFile: imageFile,
        mintAddress: mintAddress,
        metadataUri: metadataUri,
        totalSupply: totalSupply,
        decimals: decimals,
      });

      console.log("✅ Token saved to database:", token);
      return token.id.toString();
    } catch (error: any) {
      console.error("🚫 Database save error:", error);
      throw new Error(`Failed to save token to database: ${error.message}`);
    }
  }

  /**
   * Verify token creation
   */
  async verifyTokenCreation(mintAddress: string): Promise<boolean> {
    try {
      const mintInfo = await getMint(
        this.connection,
        new PublicKey(mintAddress),
      );
      return mintInfo !== null;
    } catch (error) {
      console.error("Token verification failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const tokenCreationService = new TokenCreationService();
