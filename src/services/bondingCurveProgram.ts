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
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { getWalletService } from './wallet';
import { config } from '@/config';
import * as borsh from 'borsh';

// Program ID for your deployed bonding curve program
const PROGRAM_ID = new PublicKey('Bucwy8sKVrTzjaQS1RkPLu9tA4ySUuhLKgj1C8B4WpSm');

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
  [BuyArgs, { kind: 'struct', fields: [['sol_amount', 'u64'], ['min_tokens_received', 'u64']] }],
  [SellArgs, { kind: 'struct', fields: [['token_amount', 'u64'], ['min_sol_received', 'u64']] }],
  [InitializeArgs, { kind: 'struct', fields: [['initial_virtual_token_reserves', 'u64'], ['initial_virtual_sol_reserves', 'u64'], ['bump', 'u8']] }],
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
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    console.log('🔗 Initialized Bonding Curve Program Client');
    console.log('📡 RPC:', config.solana.rpcUrl);
    console.log('🏪 Program ID:', PROGRAM_ID.toBase58());
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
      throw new Error('Wallet not connected');
    }

    const creator = this.walletService.publicKey;
    
    // Get bonding curve PDA
    const [bondingCurveAccount, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding_curve'), mintAddress.toBuffer()],
      PROGRAM_ID,
    );

    // Get creator's token account
    const creatorTokenAccount = await getAssociatedTokenAddress(mintAddress, creator);

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
    console.log('💰 [BUY] Starting buy transaction...');
    
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error('Wallet not connected');
    }

    const buyer = this.walletService.publicKey;
    const solAmountLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));

    try {
      // Get bonding curve account
      const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), mintAddress.toBuffer()],
        PROGRAM_ID,
      );

      // Get or create associated token account for buyer
      const buyerTokenAccount = await getAssociatedTokenAddress(mintAddress, buyer);

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // Get vault PDA
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), bondingCurveAccount.toBuffer()],
        PROGRAM_ID,
      );

      // Calculate expected tokens (simplified calculation)
      const expectedTokens = await this.calculateTokensOut(solAmountLamports, mintAddress);
      const minTokensWithSlippage = BigInt(
        Math.floor(Number(expectedTokens) * (100 - slippagePercent) / 100),
      );

      // Create buy instruction
      const buyArgs = new BuyArgs(solAmountLamports, minTokensWithSlippage);
      const data = Buffer.concat([
        INSTRUCTION_DISCRIMINATORS.buy,
        Buffer.from(borsh.serialize(SCHEMAS, buyArgs)),
      ]);

      const transaction = new Transaction();

      // Check if token account exists, create if not
      try {
        await this.connection.getAccountInfo(buyerTokenAccount);
      } catch {
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
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      transaction.add(buyInstruction);

      // Send transaction
      const signature = await this.sendTransaction(transaction);

      console.log('✅ Buy transaction completed:', signature);

      return {
        signature,
        tokensTraded: expectedTokens,
        solAmount: solAmountLamports,
        newPrice: await this.getCurrentPrice(mintAddress),
        marketCap: await this.getMarketCap(mintAddress),
      };

    } catch (error) {
      console.error('❌ Buy transaction failed:', error);
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
    console.log('💸 [SELL] Starting sell transaction...');
    
    if (!this.walletService.connected || !this.walletService.publicKey) {
      throw new Error('Wallet not connected');
    }

    const seller = this.walletService.publicKey;

    try {
      // Get bonding curve account
      const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding_curve'), mintAddress.toBuffer()],
        PROGRAM_ID,
      );

      // Get seller's token account
      const sellerTokenAccount = await getAssociatedTokenAddress(mintAddress, seller);

      // Get platform fee account
      const platformFeeAccount = new PublicKey(config.platform.feeWallet);

      // Get vault PDA
      const [vaultAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), bondingCurveAccount.toBuffer()],
        PROGRAM_ID,
      );

      // Calculate expected SOL
      const expectedSol = await this.calculateSolOut(tokenAmount, mintAddress);
      const minSolWithSlippage = BigInt(
        Math.floor(Number(expectedSol) * (100 - slippagePercent) / 100),
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
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });

      const transaction = new Transaction().add(sellInstruction);

      // Send transaction
      const signature = await this.sendTransaction(transaction);

      console.log('✅ Sell transaction completed:', signature);

      return {
        signature,
        tokensTraded: tokenAmount,
        solAmount: expectedSol,
        newPrice: await this.getCurrentPrice(mintAddress),
        marketCap: await this.getMarketCap(mintAddress),
      };

    } catch (error) {
      console.error('❌ Sell transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get bonding curve account data
   */
  async getBondingCurveAccount(mintAddress: PublicKey) {
    const [bondingCurveAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding_curve'), mintAddress.toBuffer()],
      PROGRAM_ID,
    );

    return await this.connection.getAccountInfo(bondingCurveAccount);
  }

  /**
   * Calculate tokens out for SOL input (simplified)
   */
  private async calculateTokensOut(solIn: bigint, mintAddress: PublicKey): Promise<bigint> {
    try {
      const accountInfo = await this.getBondingCurveAccount(mintAddress);
      
      if (!accountInfo) {
        // New token - use initial virtual reserves
        const virtualSolReserves = BigInt(30 * LAMPORTS_PER_SOL); // 30 SOL
        const virtualTokenReserves = BigInt(1073000000 * Math.pow(10, 9)); // 1.073B tokens
        
        // Constant product formula
        const k = virtualSolReserves * virtualTokenReserves;
        const newSolReserves = virtualSolReserves + solIn;
        const newTokenReserves = k / newSolReserves;
        const tokensOut = virtualTokenReserves - newTokenReserves;
        
        return tokensOut;
      }
      
      // For now, using simplified calculation
      return solIn * BigInt(1000); // 1 SOL = 1000 tokens
      
    } catch (error) {
      console.warn('Using fallback token calculation');
      return solIn * BigInt(1000);
    }
  }

  /**
   * Calculate SOL out for token input (simplified)
   */
  private async calculateSolOut(tokenIn: bigint, mintAddress: PublicKey): Promise<bigint> {
    return tokenIn / BigInt(1000); // 1000 tokens = 1 SOL
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

    const signedTransaction = await this.walletService.signTransaction(transaction);
    const signature = await this.connection.sendRawTransaction(signedTransaction.serialize());
    await this.connection.confirmTransaction(signature, 'confirmed');
    
    return signature;
  }
}

// Export singleton
export const bondingCurveProgram = new BondingCurveProgram();