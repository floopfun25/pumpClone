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
  AccountLayout,
} from "@solana/spl-token";
import { getWalletService } from "./wallet";
import { config } from "@/config";
import * as borsh from "borsh";

// Program ID for your custom bonding curve program (deployed on devnet Dec 29, 2025)
const PROGRAM_ID = new PublicKey(config.programs.bondingCurve);

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
    public creator_allocation_bps: number, // ADDED: Creator allocation in basis points
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
        ["creator_allocation_bps", "u16"], // ADDED
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
  private programId: PublicKey = PROGRAM_ID;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
  }

  /**
   * Initialize bonding curve for a token (Pump.fun style)
   */
  async initializeBondingCurve(
    mintAddress: PublicKey,
    totalSupply: bigint, // Total token supply in base units
    initialVirtualSolReserves: bigint = BigInt(config.bondingCurve.initialVirtualSolReserves), // 30 SOL
    creatorAllocationBps: number = 0, // Creator allocation in basis points (0-10000)
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

    // Use fixed virtual token reserves from config (pump.fun style)
    // FIXED: Config value is in human-readable tokens, must convert to base units with decimals
    const decimals = config.tokenDefaults.decimals; // 6 decimals
    const initialVirtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves * Math.pow(10, decimals));
    
    // Create initialize instruction
    const initializeArgs = new InitializeArgs(
      initialVirtualTokenReserves,
      initialVirtualSolReserves,
      bump,
      creatorAllocationBps, // ADDED: Creator allocation parameter
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

    // ADDED: Get creator's token account for allocation
    const creatorTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      creator,
    );

    // Create transaction first
    const transaction = new Transaction();

    // Check if creator token account exists, if not create it
    const creatorTokenAccountInfo = await this.connection.getAccountInfo(creatorTokenAccount);
    if (!creatorTokenAccountInfo) {
      console.log("Creating creator token account:", creatorTokenAccount.toBase58());
      const createAtaIx = createAssociatedTokenAccountInstruction(
        creator,
        creatorTokenAccount,
        creator,
        mintAddress,
      );
      transaction.add(createAtaIx);
    }

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: bondingCurveAccount, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        { pubkey: vaultAccount, isSigner: false, isWritable: true }, // Vault to hold bonding curve tokens
        { pubkey: creatorTokenAccount, isSigner: false, isWritable: true }, // ADDED: Creator's token account for allocation
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: PROGRAM_ID,
      data,
    });
    
    // PRODUCTION FIX: Fund with minimal real SOL, use virtual reserves for math
    // Users can't afford 30 SOL upfront - this grows from trading activity
    const minimalRealSolFunding = 0.1 * LAMPORTS_PER_SOL; // Start with 0.1 SOL

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: creator,
        toPubkey: bondingCurveAccount,
        lamports: minimalRealSolFunding,
      })
    );

    transaction.add(instruction);
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
        await this.initializeBondingCurve(
          mintAddress,
          BigInt(1_000_000_000 * Math.pow(10, 9)), // Default 1B tokens
        );
      }

      // Get or create associated token account for buyer
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mintAddress,
        buyer,
      );

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // CRITICAL FIX: Your program expects vault authority to be the bonding curve account itself
      const vaultAccount = await getAssociatedTokenAddress(
        mintAddress,
        bondingCurveAccount, // Use bonding curve account directly as authority
        true // Allow PDA as owner
      );

      const vaultInfo = await this.connection.getAccountInfo(vaultAccount);
    

      // CRITICAL: Calculate expected tokens AFTER platform fee deduction to match Rust program
      const platformFeePercent = config.tokenDefaults.platformFeePercentage; // 1%
      const platformFee = (solAmountLamports * BigInt(Math.floor(platformFeePercent * 100))) / BigInt(10000);
      const tradeAmount = solAmountLamports - platformFee; // This is what the Rust program uses
      
      const expectedTokens = await this.calculateTokensOut(
        tradeAmount, // Use trade amount after fees, not full SOL amount
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

      if (!tokenAccountInfo) {
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
          buyer,
          buyerTokenAccount,
          buyer,
          mintAddress,
        );
        transaction.add(createTokenAccountIx);
      }

      // Handle vault creation if it doesn't exist (your program expects an ATA)
      if (!vaultInfo) {
        const createVaultIx = createAssociatedTokenAccountInstruction(
          buyer, // Payer
          vaultAccount, // ATA address
          bondingCurveAccount, // Owner (bonding curve PDA)
          mintAddress // Mint
        );
        transaction.add(createVaultIx);
      }

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

      transaction.add(buyInstruction);

      try {
        const signature = await this.sendTransaction(transaction);

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
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Check user's actual token balance before attempting to sell
    const seller = this.walletService.publicKey;
    const sellerTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      seller,
    );

    let sellerTokenInfo;
    try {
      sellerTokenInfo = await this.connection.getAccountInfo(sellerTokenAccount);
      if (sellerTokenInfo && sellerTokenInfo.data.length > 0) {
        const accountData = AccountLayout.decode(sellerTokenInfo.data);
        const balance = BigInt(accountData.amount.toString());

        if (tokenAmount > balance) {
          throw new Error(`Insufficient token balance. Trying to sell ${Number(tokenAmount) / 1e9} tokens but only have ${Number(balance) / 1e9} tokens`);
        }
      } else {
        throw new Error("Token account does not exist - cannot sell tokens you don't have");
      }
    } catch (balanceError) {
      console.error("Failed to check balance:", balanceError);
      throw balanceError;
    }

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

      // CRITICAL FIX: For sell operations, SOL comes from bonding curve PDA, not token vault
      // The vaultAccount should be the bonding curve's token vault for burning tokens
      const vaultAccount = await getAssociatedTokenAddress(
        mintAddress,
        bondingCurveAccount,
        true // Allow owner to be a PDA
      );

      // Check vault account existence and create if needed
      const vaultInfo = await this.connection.getAccountInfo(vaultAccount);

      // Check bonding curve PDA SOL balance (this is where SOL should come from)
      const bondingCurveInfo = await this.connection.getAccountInfo(bondingCurveAccount);

      // Calculate expected SOL
      const expectedSol = await this.calculateSolOut(tokenAmount, mintAddress);
      
      // Calculate platform fee (1% as per config)
      const platformFeePercent = config.tokenDefaults.platformFeePercentage; // 1%
      const platformFee = (expectedSol * BigInt(Math.floor(platformFeePercent * 100))) / BigInt(10000);
      const expectedSolAfterFee = expectedSol - platformFee;

      // Calculate slippage based on the expected SOL after fees, with extra buffer for rounding
      const slippageBuffer = BigInt(100000); // Extra 0.0001 SOL buffer for program rounding differences
      const minSolWithSlippage = (expectedSolAfterFee * BigInt(100 - slippagePercent)) / BigInt(100) - slippageBuffer;

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

      const sellArgs = new SellArgs(tokenAmount, correctedMinSol);
      const data = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.sell,
        Buffer.from(borsh.serialize(SCHEMAS, sellArgs)),
      ]);

      // CRITICAL FIX: TWO-TRANSACTION APPROACH
      // The issue: Adding rent in the same transaction doesn't work because Solana
      // validates account states at transaction boundaries. The sell operation itself
      // might be consuming lamports during execution, causing the rent error.
      // Solution: Fund the token account FIRST in a separate transaction, THEN sell.

      // CRITICAL: The SPL Token burn operation may reclaim rent during execution
      // We need a MUCH larger buffer to ensure the account stays rent-exempt
      // even after the burn completes and any internal rent adjustments
      const TOKEN_ACCOUNT_RENT_EXEMPT = 2039280; // lamports for rent exemption
      const RENT_BUFFER = 5000000; // 0.005 SOL buffer - large enough to absorb any rent reclamation
      const REQUIRED_RENT = TOKEN_ACCOUNT_RENT_EXEMPT + RENT_BUFFER;

      console.log(`🔍 [RENT CHECK] Seller token account: ${sellerTokenAccount.toBase58()}`);
      console.log(`🔍 [RENT CHECK] Token account lamports: ${sellerTokenInfo?.lamports || 0}`);
      console.log(`🔍 [RENT CHECK] Required for rent (with buffer): ${REQUIRED_RENT}`);

      // STEP 1: If needed, fund the token account FIRST in a separate transaction
      if (sellerTokenInfo && sellerTokenInfo.lamports < REQUIRED_RENT) {
        const rentDeficit = REQUIRED_RENT - sellerTokenInfo.lamports;
        console.log(`⚠️ [SELL STEP 1/2] Token account needs ${rentDeficit} more lamports for rent`);
        console.log(`⚠️ [SELL STEP 1/2] Sending rent funding transaction first (${rentDeficit / LAMPORTS_PER_SOL} SOL)...`);

        const rentTransaction = new Transaction();

        // Add compute budget for rent transaction
        rentTransaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 50_000,
          }),
        );
        rentTransaction.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1000,
          }),
        );

        // Add SOL transfer to fund the token account
        rentTransaction.add(
          SystemProgram.transfer({
            fromPubkey: seller,
            toPubkey: sellerTokenAccount,
            lamports: rentDeficit,
          })
        );

        // Send and confirm rent funding transaction
        try {
          const rentSignature = await this.sendTransaction(rentTransaction);
          console.log(`✅ [SELL STEP 1/2] Rent funding confirmed: ${rentSignature}`);

          // Wait a bit for the transaction to fully settle
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Verify the account now has sufficient rent
          const updatedTokenInfo = await this.connection.getAccountInfo(sellerTokenAccount);
          console.log(`✅ [SELL STEP 1/2] Token account now has ${updatedTokenInfo?.lamports || 0} lamports`);
        } catch (rentError) {
          console.error("❌ [SELL STEP 1/2] Failed to fund token account for rent:", rentError);
          throw new Error(`Failed to prepare token account for sell: ${rentError instanceof Error ? rentError.message : String(rentError)}`);
        }
      } else {
        console.log(`✅ [RENT CHECK] Account has sufficient rent: ${sellerTokenInfo?.lamports || 0} >= ${REQUIRED_RENT}`);
      }

      // STEP 2: Now execute the actual sell transaction
      console.log(`🔄 [SELL STEP 2/2] Executing sell transaction...`);

      // CRITICAL: Refetch the token account to get the updated state after rent funding
      const refreshedTokenInfo = await this.connection.getAccountInfo(sellerTokenAccount);
      console.log(`🔍 [SELL STEP 2/2] Refreshed token account lamports: ${refreshedTokenInfo?.lamports || 0}`);

      const transaction = new Transaction();

      // CRITICAL: Add additional rent buffer as FIRST instruction to ensure account has enough
      // even after any potential rent reclamation during burn
      const ADDITIONAL_BUFFER = 10000000; // 0.01 SOL - very large buffer
      console.log(`🔍 [SELL STEP 2/2] Adding extra ${ADDITIONAL_BUFFER} lamport buffer to token account`);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: seller,
          toPubkey: sellerTokenAccount,
          lamports: ADDITIONAL_BUFFER,
        })
      );

      // Handle vault creation if it doesn't exist (your program expects an ATA)
      if (!vaultInfo) {
        const createVaultIx = createAssociatedTokenAccountInstruction(
          seller, // Payer
          vaultAccount, // ATA address
          bondingCurveAccount, // Owner (bonding curve PDA)
          mintAddress // Mint
        );
        transaction.add(createVaultIx);
      }

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

      // PRODUCTION FIX: If bonding curve PDA doesn't have enough SOL, it might use authority/treasury
      let solSourceAccount = bondingCurveAccount; // Default expectation

      // PRODUCTION CHECK: Ensure adequate SOL for transaction
      const availableSol = bondingCurveInfo ? Number(bondingCurveInfo.lamports) : 0;
      const neededSol = Number(expectedSol);

      if (availableSol < neededSol) {
        // Calculate maximum sellable amount based on available SOL
        const maxSellableSOL = availableSol * 0.9; // 90% safety margin for fees

        if (maxSellableSOL < 10000000) { // Less than 0.01 SOL
          throw new Error(`Insufficient liquidity for any trades. The bonding curve only has ${availableSol / LAMPORTS_PER_SOL} SOL. More buy volume needed before sells are possible.`);
        }

        // Calculate what percentage of tokens this represents
        const recommendedTokenAmount = Number(tokenAmount) * (maxSellableSOL / neededSol);

        throw new Error(`💧 Insufficient liquidity for this trade size

🏦 Available liquidity: ${(availableSol / LAMPORTS_PER_SOL).toFixed(3)} SOL
💰 Your trade needs: ${(neededSol / LAMPORTS_PER_SOL).toFixed(3)} SOL

✅ Maximum you can sell now: ${(recommendedTokenAmount / Math.pow(10, 6)).toFixed(6)} tokens

💡 The bonding curve needs more buy volume before larger sells are possible.`);
      }

      // Create sell instruction matching exact Rust Sell struct order
      const sellInstruction = new TransactionInstruction({
        keys: [
          // Must match EXACT order in Rust Sell struct:
          { pubkey: seller, isSigner: true, isWritable: true }, // 0: seller
          { pubkey: solSourceAccount, isSigner: false, isWritable: true }, // 1: sol_source (bonding_curve or treasury)
          { pubkey: mintAddress, isSigner: false, isWritable: true }, // 2: mint
          { pubkey: sellerTokenAccount, isSigner: false, isWritable: true }, // 3: seller_token_account
          { pubkey: platformFeeAccount, isSigner: false, isWritable: true }, // 4: platform_fee
          { pubkey: vaultAccount, isSigner: false, isWritable: true }, // 5: vault
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // 6: token_program
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // 7: system_program
        ],
        programId: PROGRAM_ID,
        data,
      });

      transaction.add(sellInstruction);

      // Send transaction with normal simulation
      // We've added a massive rent buffer (0.01 SOL) in the same transaction to prevent rent issues
      console.log("🚀 [SELL] Sending transaction with rent buffer...");
      const signature = await this.sendTransaction(transaction); // Normal simulation

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
   * FIXED: Parse bonding curve account data from blockchain
   */
  private parseBondingCurveAccount(accountData: Buffer): {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    graduated: boolean;
  } | null {
    if (accountData.length < 114) {
      console.warn(`Account data too small: ${accountData.length} bytes, expected at least 114`);
      return null;
    }

    try {
      const readU64LE = (buffer: Buffer, offset: number): bigint => {
        const low = buffer.readUInt32LE(offset);
        const high = buffer.readUInt32LE(offset + 4);
        return BigInt(low) + (BigInt(high) << 32n);
      };

      // FIXED: Correct Rust BondingCurve struct layout after Anchor discriminator:
      // [0-7]   = Anchor discriminator (8 bytes)
      // [8-39]  = mint_address: Pubkey (32 bytes)
      // [40-71] = creator: Pubkey (32 bytes)
      // [72-79] = virtual_token_reserves: u64 (8 bytes)
      // [80-87] = virtual_sol_reserves: u64 (8 bytes)
      // [88-95] = real_token_reserves: u64 (8 bytes)
      // [96-103] = real_sol_reserves: u64 (8 bytes)
      // [104-111] = token_total_supply: u64 (8 bytes)
      // [112] = graduated: bool (1 byte)

      const virtualTokenReserves = readU64LE(accountData, 72);
      const virtualSolReserves = readU64LE(accountData, 80);
      const realTokenReserves = readU64LE(accountData, 88);
      const realSolReserves = readU64LE(accountData, 96);
      const tokenTotalSupply = readU64LE(accountData, 104);
      const graduated = accountData[112] !== 0;

      console.log(`📊 [BONDING CURVE] Parsed state:`, {
        virtualSolReserves: `${Number(virtualSolReserves) / 1e9} SOL`,
        virtualTokenReserves: `${Number(virtualTokenReserves) / 1e6} tokens`,
        realSolReserves: `${Number(realSolReserves) / 1e9} SOL`,
        realTokenReserves: `${Number(realTokenReserves) / 1e6} tokens`,
        totalSupply: `${Number(tokenTotalSupply) / 1e6} tokens`,
        graduated,
      });

      return {
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves,
        realSolReserves,
        tokenTotalSupply,
        graduated,
      };
    } catch (error) {
      console.error("Failed to parse bonding curve account:", error);
      return null;
    }
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

      // FIXED: Parse actual bonding curve state from blockchain account
      let virtualSolReserves = BigInt(config.bondingCurve.initialVirtualSolReserves);
      let virtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves * Math.pow(10, config.tokenDefaults.decimals));

      if (accountInfo) {
        const parsedState = this.parseBondingCurveAccount(accountInfo.data);
        if (parsedState) {
          virtualSolReserves = parsedState.virtualSolReserves;
          virtualTokenReserves = parsedState.virtualTokenReserves;
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
        return this.fallbackTokenCalculation(solIn);
      }

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
    // TODO: Get bonding curve state from Spring Boot backend
    console.log('Getting bonding curve state for:', mintAddress.toBase58());
    // For now, return null - this should be fetched from backend
    return null;
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
   * Diagnostic: Check SOL flow and account balances
   */
  async diagnoseSOLFlow(mintAddress: PublicKey): Promise<void> {
    console.log("🔍 [DIAGNOSTIC] Analyzing SOL flow for token:", mintAddress.toBase58());
    
    try {
      // 1. Check bonding curve PDA balance
      const [bondingCurvePDA] = await PublicKey.findProgramAddress(
        [Buffer.from("bonding_curve"), mintAddress.toBytes()],
        this.programId
      );
      
      const pdaBalance = await this.connection.getBalance(bondingCurvePDA);
      console.log(`💰 [DIAGNOSTIC] Bonding Curve PDA: ${bondingCurvePDA.toBase58()}`);
      console.log(`💰 [DIAGNOSTIC] PDA Balance: ${pdaBalance / LAMPORTS_PER_SOL} SOL`);
      
      // 2. Check platform accounts
      const feeWallet = new PublicKey(config.platform.feeWallet);
      const authority = new PublicKey(config.platform.authority);
      const treasury = new PublicKey(config.platform.treasury);
      
      const [feeBalance, authBalance, treasuryBalance] = await Promise.all([
        this.connection.getBalance(feeWallet),
        this.connection.getBalance(authority), 
        this.connection.getBalance(treasury)
      ]);
      
      console.log(`💰 [DIAGNOSTIC] Fee Wallet: ${(feeBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      console.log(`💰 [DIAGNOSTIC] Authority: ${(authBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      console.log(`💰 [DIAGNOSTIC] Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
      
      // 3. Parse bonding curve state
      const accountInfo = await this.connection.getAccountInfo(bondingCurvePDA);
      if (accountInfo) {
        const data = accountInfo.data;
        const readU64LE = (buffer: Buffer, offset: number): bigint => {
          const low = buffer.readUInt32LE(offset);
          const high = buffer.readUInt32LE(offset + 4);
          return BigInt(low) + (BigInt(high) << 32n);
        };
        
        const virtualTokenReserves = readU64LE(data, 72);
        const virtualSolReserves = readU64LE(data, 80);
        
        console.log(`📊 [DIAGNOSTIC] Virtual SOL Reserves: ${Number(virtualSolReserves) / LAMPORTS_PER_SOL} SOL`);
        console.log(`📊 [DIAGNOSTIC] Virtual Token Reserves: ${virtualTokenReserves.toString()} tokens`);
        console.log(`⚠️ [DIAGNOSTIC] SOL Mismatch: Virtual=${Number(virtualSolReserves) / LAMPORTS_PER_SOL} SOL vs Actual=${pdaBalance / LAMPORTS_PER_SOL} SOL`);
      }
      
    } catch (error) {
      console.error("❌ [DIAGNOSTIC] Failed:", error);
    }
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

      // FIXED: Parse actual bonding curve state from blockchain account
      let virtualSolReserves = BigInt(config.bondingCurve.initialVirtualSolReserves);
      let virtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves * Math.pow(10, config.tokenDefaults.decimals));

      if (accountInfo) {
        const parsedState = this.parseBondingCurveAccount(accountInfo.data);
        if (parsedState) {
          virtualSolReserves = parsedState.virtualSolReserves;
          virtualTokenReserves = parsedState.virtualTokenReserves;
        }
      }

      // Constant product formula: k = x * y
      // After sell: (virtualSolReserves - solOut) * (virtualTokenReserves + tokenIn) = k
      const k = virtualSolReserves * virtualTokenReserves;
      const newTokenReserves = virtualTokenReserves + tokenIn;
      const newSolReserves = k / newTokenReserves;
      const solOut = virtualSolReserves - newSolReserves;

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
      // Get actual bonding curve state from blockchain
      const accountInfo = await this.getBondingCurveAccount(mintAddress);

      let virtualSolReserves = BigInt(config.bondingCurve.initialVirtualSolReserves);
      let virtualTokenReserves = BigInt(config.bondingCurve.initialVirtualTokenReserves * Math.pow(10, config.tokenDefaults.decimals));

      if (accountInfo) {
        const parsedState = this.parseBondingCurveAccount(accountInfo.data);
        if (parsedState) {
          virtualSolReserves = parsedState.virtualSolReserves;
          virtualTokenReserves = parsedState.virtualTokenReserves;
        }
      }

      // Get token decimals from mint account to properly convert base units to human-readable
      const mintInfo = await getMint(this.connection, mintAddress);
      const TOKEN_DECIMALS = mintInfo.decimals;

      // FIXED: Calculate current price: (SOL reserves / token reserves)
      // Convert SOL from lamports (10^9) and tokens from base units (using actual decimals)
      const solInHumanForm = Number(virtualSolReserves) / LAMPORTS_PER_SOL;
      const tokensInHumanForm = Number(virtualTokenReserves) / Math.pow(10, TOKEN_DECIMALS);
      const priceInSOL = solInHumanForm / tokensInHumanForm;

      return priceInSOL;
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
  async getMarketCap(mintAddress: PublicKey, solPriceUSD?: number): Promise<number> {
    try {
      const mintInfo = await getMint(this.connection, mintAddress);
      const currentPrice = await this.getCurrentPrice(mintAddress);

      // Market cap = Total supply × Current price
      const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
      const marketCapSOL = totalSupply * currentPrice;

      // Convert to USD using provided SOL price or fetch from price oracle
      let solPrice = solPriceUSD;
      if (!solPrice) {
        try {
          const { priceOracleService } = await import("@/services/priceOracle");
          const solPriceData = await priceOracleService.getSOLPrice();
          solPrice = solPriceData.price;
        } catch {
          solPrice = 100; // Fallback SOL price if fetch fails
        }
      }

      const marketCapUSD = marketCapSOL * solPrice;

      return marketCapUSD;
    } catch (error) {
      console.error("Failed to calculate market cap:", error);
      return 0; // Return 0 instead of placeholder for new tokens
    }
  }

  /**
   * Get 24h trading volume from backend transactions
   */
  async get24hVolume(tokenId: string, solPriceUSD?: number): Promise<number> {
    try {
      // Import tradingAPI dynamically to avoid circular dependencies
      const { tradingAPI } = await import("@/services/api");

      // Get all transactions (we'll filter by time)
      const response = await tradingAPI.getTokenTransactions(Number(tokenId), 0, 1000);
      const transactions = response.content;

      // Filter transactions from last 24 hours
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const recent24hTransactions = transactions.filter((tx: any) => {
        const txTime = new Date(tx.createdAt).getTime();
        return txTime >= oneDayAgo;
      });

      // Calculate volume (sum of all SOL amounts in last 24h)
      const volumeSOL = recent24hTransactions.reduce((sum: number, tx: any) => {
        return sum + (Number(tx.solAmount) || 0);
      }, 0);

      // Convert to USD
      let solPrice = solPriceUSD;
      if (!solPrice) {
        try {
          const { priceOracleService } = await import("@/services/priceOracle");
          const solPriceData = await priceOracleService.getSOLPrice();
          solPrice = solPriceData.price;
        } catch {
          solPrice = 100; // Fallback
        }
      }

      const volumeUSD = volumeSOL * solPrice;

      return volumeUSD;
    } catch (error) {
      console.error("Failed to calculate 24h volume:", error);
      return 0;
    }
  }

  /**
   * Get number of token holders by counting unique token accounts
   */
  async getHolderCount(mintAddress: PublicKey): Promise<number> {
    try {
      // Get all token accounts for this mint
      const tokenAccounts = await this.connection.getParsedProgramAccounts(
        TOKEN_PROGRAM_ID,
        {
          filters: [
            {
              dataSize: 165, // Size of token account
            },
            {
              memcmp: {
                offset: 0, // Mint address is at offset 0
                bytes: mintAddress.toBase58(),
              },
            },
          ],
        }
      );

      // Count accounts with non-zero balance
      const holdersWithBalance = tokenAccounts.filter((account) => {
        const parsedInfo = (account.account.data as any).parsed?.info;
        if (!parsedInfo) return false;

        const balance = Number(parsedInfo.tokenAmount?.uiAmount) || 0;
        return balance > 0;
      });

      return holdersWithBalance.length;
    } catch (error) {
      console.error("Failed to get holder count:", error);
      return 0;
    }
  }

  /**
   * Send and confirm transaction
   */
  private async sendTransaction(transaction: Transaction, skipSimulation: boolean = false): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.walletService.publicKey!;

    // CRITICAL FIX: Simulate transaction first to get better error details
    // Unless explicitly skipped (for transactions with known simulation issues)
    if (!skipSimulation) {
      try {
        const simulationResult = await this.connection.simulateTransaction(transaction);

        if (simulationResult.value.err) {
          console.error("Transaction simulation failed:", simulationResult.value.err);
          console.error("Simulation logs:", simulationResult.value.logs);

          // DEBUG: Log all accounts involved in the transaction to identify which one has rent issues
          console.error("🔍 [DEBUG] Transaction accounts:");
          transaction.instructions.forEach((ix, ixIdx) => {
            console.error(`  Instruction ${ixIdx}:`);
            ix.keys.forEach((key, keyIdx) => {
              console.error(`    [${keyIdx}] ${key.pubkey.toBase58()} - writable: ${key.isWritable}, signer: ${key.isSigner}`);
            });
          });

          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
        }
      } catch (simError) {
        console.error("Simulation error:", simError);
        throw simError;
      }
    } else {
      console.log("⚠️ [TRANSACTION] Skipping simulation (known simulation issue - will send directly)");
    }

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
