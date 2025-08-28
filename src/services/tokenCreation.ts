import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
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
import type { PublicKey } from "@solana/web3.js";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import { supabase } from "./supabase";
import { uploadToIPFS } from "./ipfsService";

export interface TokenCreationParams {
  name: string;
  symbol: string;
  description: string;
  imageFile?: File;
  imageUrl?: string;
  decimals?: number;
  initialSupply?: number;
  creatorPercentage?: number;
}

export interface CreatedTokenInfo {
  mintAddress: string;
  tokenAccount: string;
  metadataAccount: string;
  signature: string;
  tokenId: string;
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
    const decimals = params.decimals || 9;
    const initialSupply = params.initialSupply || 1_000_000_000; // 1B tokens default

    try {
      // Step 1: Upload metadata to IPFS (optional - fallback if fails)
      console.log("📤 Uploading metadata to IPFS...");
      let metadataUri = "";
      try {
        metadataUri = await this.uploadMetadata(params);
        console.log("✅ Metadata uploaded to IPFS:", metadataUri);
      } catch (ipfsError) {
        console.warn("⚠️ IPFS upload failed, using fallback metadata:", ipfsError);
        // Create fallback metadata URI for testing
        metadataUri = `data:application/json,${encodeURIComponent(JSON.stringify({
          name: params.name,
          symbol: params.symbol,
          description: params.description,
          image: params.imageUrl || "",
        }))}`;
        console.log("📝 Using fallback metadata URI for testing");
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

      // Step 4: Initialize bonding curve (this will handle minting)
      console.log("🎯 Initializing bonding curve...");
      const { bondingCurveProgram } = await import("./bondingCurveProgram");
      const bondingCurveSignature = await bondingCurveProgram.initializeBondingCurve(
        mintKeypair.publicKey,
        BigInt(initialSupply * Math.pow(10, decimals)), // Total supply in base units
      );
      console.log("✅ Bonding curve initialized successfully");

      // Step 5: Save to database (optional - can be done without auth)
      let tokenId = "created";
      try {
        tokenId = await this.saveTokenToDatabase(
          mintKeypair.publicKey.toBase58(),
          bondingCurveSignature,
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

      return {
        mintAddress: mintKeypair.publicKey.toBase58(),
        tokenAccount: tokenAccount.toBase58(),
        metadataAccount: metadataAccount.toBase58(),
        signature: bondingCurveSignature,
        tokenId,
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

    // Create metadata account (skip if Metaplex library not available)
    try {
      const metaplexModule = await import("@metaplex-foundation/mpl-token-metadata");
      const createCreateMetadataAccountV3Instruction = metaplexModule.createCreateMetadataAccountV3Instruction;
      
      const metadataAccount = await this.getMetadataAccount(
        mintKeypair.publicKey,
      );

      transaction.add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataAccount,
            mint: mintKeypair.publicKey,
            mintAuthority: payer, // Creator is initial authority (bonding curve will take over)
            payer: payer,
            updateAuthority: payer,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: params.name,
                symbol: params.symbol,
                uri: metadataUri,
                sellerFeeBasisPoints: 0,
                creators: [
                  {
                    address: payer,
                    verified: true,
                    share: 100,
                  },
                ],
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          },
        ),
      );
      console.log("✅ Metadata account instruction added");
    } catch (metaplexError) {
      console.warn("⚠️ Skipping metadata creation (Metaplex library not available):", metaplexError);
    }

    // Add platform fee (0.1 SOL)
    const platformFeeAccount = new PublicKey(config.platform.feeWallet);
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: platformFeeAccount,
        lamports: 0.1 * LAMPORTS_PER_SOL, // 0.1 SOL fee
      }),
    );

    // Sign and send transaction
    transaction.feePayer = payer;
    transaction.recentBlockhash = (
      await this.connection.getLatestBlockhash()
    ).blockhash;

    // This would need to be signed by the wallet
    const signedTransaction =
      await this.walletService.signTransaction(transaction);
    signedTransaction.partialSign(mintKeypair);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      signedTransaction,
      [],
    );

    console.log("🎉 Token created successfully! Signature:", signature);
    return signature;
  }

  /**
   * Get metadata account PDA (with fallback)
   */
  private async getMetadataAccount(
    mintPublicKey: PublicKey,
  ): Promise<PublicKey> {
    try {
      const metaplexModule = await import("@metaplex-foundation/mpl-token-metadata");
      const METADATA_PROGRAM_ID = metaplexModule.PROGRAM_ID;
      
      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintPublicKey.toBuffer(),
        ],
        METADATA_PROGRAM_ID,
      );
      return metadataAccount;
    } catch (error) {
      // Fallback: return mint address if metadata program not available
      console.warn("Using mint address as metadata account fallback");
      return mintPublicKey;
    }
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

    const { data, error } = await supabase
      .from("tokens")
      .insert({
        mint_address: mintAddress,
        name: params.name,
        symbol: params.symbol,
        description: params.description,
        image_url: params.imageUrl,
        metadata_uri: metadataUri,
        creator_id: this.walletService.publicKey!.toBase58(),
        total_supply:
          (params.initialSupply || 1_000_000_000) *
          Math.pow(10, params.decimals || 9),
        current_price: 0,
        market_cap: 0,
        volume_24h: 0,
        status: "active",
        creation_signature: signature,
        decimals: params.decimals || 9,
      })
      .select()
      .single();

    if (error) {
      console.error("Database save error:", error);
      throw new Error(`Failed to save token to database: ${error.message}`);
    }

    return data.id;
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
