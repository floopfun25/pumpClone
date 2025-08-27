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
  getAssociatedTokenAddress,
  getMint,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
} from "@solana/spl-token";
import {
  createCreateMetadataAccountV3Instruction,
  PROGRAM_ID as METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
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
   * Create a new SPL token with metadata
   */
  async createToken(params: TokenCreationParams): Promise<CreatedTokenInfo> {
    console.log("🪙 Starting token creation process...");

    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    const payer = this.walletService.publicKey;
    const decimals = params.decimals || 9;
    const initialSupply = params.initialSupply || 1_000_000_000; // 1B tokens default

    try {
      // Step 1: Upload metadata to IPFS
      console.log("📤 Uploading metadata to IPFS...");
      const metadataUri = await this.uploadMetadata(params);

      // Step 2: Generate mint keypair
      const { Keypair } = await import("@solana/web3.js");
      const mintKeypair = Keypair.generate();
      console.log(
        "🔑 Generated mint address:",
        mintKeypair.publicKey.toBase58(),
      );

      // Step 3: Create mint account and token
      const signature = await this.createMintAndToken(
        mintKeypair,
        payer,
        decimals,
        initialSupply,
        metadataUri,
        params,
      );

      // Step 4: Initialize bonding curve
      console.log("🎯 Initializing bonding curve...");
      const { bondingCurveProgram } = await import("./bondingCurveProgram");
      try {
        await bondingCurveProgram.initializeBondingCurve(mintKeypair.publicKey);
        console.log("✅ Bonding curve initialized successfully");
      } catch (error) {
        console.warn("⚠️ Bonding curve initialization failed:", error);
        // Continue anyway - the token is still created
      }

      // Step 5: Save to database
      const tokenId = await this.saveTokenToDatabase(
        mintKeypair.publicKey.toBase58(),
        signature,
        params,
        metadataUri,
      );

      // Step 5: Create associated token account
      const tokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        payer,
      );

      // Step 6: Get metadata account address
      const metadataAccount = await this.getMetadataAccount(
        mintKeypair.publicKey,
      );

      console.log("✅ Token creation completed successfully!");

      return {
        mintAddress: mintKeypair.publicKey.toBase58(),
        tokenAccount: tokenAccount.toBase58(),
        metadataAccount: metadataAccount.toBase58(),
        signature,
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
   * Create mint account and initial token supply
   */
  private async createMintAndToken(
    mintKeypair: any,
    payer: PublicKey,
    decimals: number,
    initialSupply: number,
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

    // Initialize mint
    transaction.add(
      createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        payer, // Mint authority
        payer, // Freeze authority
      ),
    );

    // Create associated token account for creator
    const creatorTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      payer,
    );

    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer,
        creatorTokenAccount,
        payer,
        mintKeypair.publicKey,
      ),
    );

    // Calculate creator tokens (default 20% of supply goes to creator)
    const creatorPercentage = params.creatorPercentage || 20;
    const creatorTokens = Math.floor((initialSupply * creatorPercentage) / 100);
    const creatorTokensWithDecimals = BigInt(
      creatorTokens * Math.pow(10, decimals),
    );

    // Mint initial supply to creator
    transaction.add(
      createMintToInstruction(
        mintKeypair.publicKey,
        creatorTokenAccount,
        payer,
        creatorTokensWithDecimals,
      ),
    );

    // Create metadata account
    const metadataAccount = await this.getMetadataAccount(
      mintKeypair.publicKey,
    );

    transaction.add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAccount,
          mint: mintKeypair.publicKey,
          mintAuthority: payer,
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
   * Get metadata account PDA
   */
  private async getMetadataAccount(
    mintPublicKey: PublicKey,
  ): Promise<PublicKey> {
    const [metadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID,
    );
    return metadataAccount;
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
