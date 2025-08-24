import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import type { AccountInfo, Commitment, ConfirmOptions } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token'
import { getWalletService } from './wallet'
import { solanaConfig, programConfig, platformConfig, bondingCurveConfig, tradingConfig } from '@/config'
import { useAuthStore } from '@/stores/auth' // Assuming you have an auth store
import { supabase } from './supabase'

const walletService = getWalletService()

// Program instruction types
export enum BondingCurveInstruction {
  Initialize = 0,
  Buy = 1,
  Sell = 2,
  Graduate = 3,
  Withdraw = 4
}

// Bonding curve account structure (matches Rust program)
export interface BondingCurveAccount {
  discriminator: Buffer
  mintAddress: PublicKey
  creator: PublicKey
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  graduated: boolean
  createdAt: bigint
  bumpSeed: number
}

// Helper functions for encoding instructions
function encodeTradeInstruction(data: {
  instruction: BondingCurveInstruction
  amount: bigint
  minReceived: bigint
  maxSlippage: number
}): Buffer {
  const buffer = Buffer.alloc(1 + 8 + 8 + 2)
  let offset = 0
  
  // Instruction discriminator
  buffer.writeUInt8(data.instruction, offset)
  offset += 1
  
  // Amount (8 bytes, little endian)
  buffer.writeBigUInt64LE(data.amount, offset)
  offset += 8
  
  // Min received (8 bytes, little endian)
  buffer.writeBigUInt64LE(data.minReceived, offset)
  offset += 8
  
  // Max slippage (2 bytes, little endian)
  buffer.writeUInt16LE(data.maxSlippage, offset)
  
  return buffer
}

function encodeInitializeInstruction(data: {
  initialVirtualTokenReserves: bigint
  initialVirtualSolReserves: bigint
}): Buffer {
  const buffer = Buffer.alloc(1 + 8 + 8)
  let offset = 0
  
  // Instruction discriminator
  buffer.writeUInt8(BondingCurveInstruction.Initialize, offset)
  offset += 1
  
  // Initial virtual token reserves
  buffer.writeBigUInt64LE(data.initialVirtualTokenReserves, offset)
  offset += 8
  
  // Initial virtual SOL reserves
  buffer.writeBigUInt64LE(data.initialVirtualSolReserves, offset)
  
  return buffer
}

// Safe number helpers
const safeNumber = (value: number): number => {
  if (!isFinite(value) || isNaN(value)) return 0
  return Math.max(0, value)
}

const safePrice = (price: number, fallback: number): number => {
  if (!isFinite(price) || isNaN(price) || price <= 0) return fallback
  return price
}

const safeMarketCap = (price: number, supply: number): number => {
  const marketCap = price * supply
  if (!isFinite(marketCap) || isNaN(marketCap)) return 0
  return Math.max(0, marketCap)
}

export class SolanaProgram {
  private connection: Connection
  private programId: PublicKey
  private feeWallet: PublicKey

  constructor() {
    this.connection = new Connection(solanaConfig.rpcUrl, solanaConfig.commitment as Commitment)
    this.programId = new PublicKey(programConfig.bondingCurve)
    this.feeWallet = new PublicKey(platformConfig.feeWallet)
  }

  /**
   * Derive bonding curve PDA address
   */
  deriveBondingCurveAddress(mintAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mintAddress.toBuffer()],
      this.programId
    )
  }

  /**
   * Parse bonding curve account data from blockchain
   */
  private parseBondingCurveAccount(data: Buffer): BondingCurveAccount {
    let offset = 0
    
    // Discriminator (8 bytes)
    const discriminator = data.subarray(offset, offset + 8)
    offset += 8
    
    // Mint address (32 bytes)
    const mintAddress = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    
    // Creator (32 bytes)
    const creator = new PublicKey(data.subarray(offset, offset + 32))
    offset += 32
    
    // Virtual token reserves (8 bytes)
    const virtualTokenReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Virtual SOL reserves (8 bytes)
    const virtualSolReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Real token reserves (8 bytes)
    const realTokenReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Real SOL reserves (8 bytes)
    const realSolReserves = data.readBigUInt64LE(offset)
    offset += 8
    
    // Token total supply (8 bytes)
    const tokenTotalSupply = data.readBigUInt64LE(offset)
    offset += 8
    
    // Graduated (1 byte)
    const graduated = data.readUInt8(offset) === 1
    offset += 1
    
    // Created at (8 bytes)
    const createdAt = data.readBigUInt64LE(offset)
    offset += 8
    
    // Bump seed (1 byte)
    const bumpSeed = data.readUInt8(offset)
    
    return {
      discriminator,
      mintAddress,
      creator,
      virtualTokenReserves,
      virtualSolReserves,
      realTokenReserves,
      realSolReserves,
      tokenTotalSupply,
      graduated,
      createdAt,
      bumpSeed
    }
  }

  /**
   * Get bonding curve account data from blockchain
   */
  async getBondingCurveAccount(mintAddress: PublicKey): Promise<BondingCurveAccount | null> {
    try {
      const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
      console.log('[BondingCurve] Derived PDA:', bondingCurveAddress.toBase58(), 'for mint:', mintAddress.toBase58(), 'and program:', this.programId.toBase58())
      const accountInfo = await this.connection.getAccountInfo(bondingCurveAddress)
      
      if (!accountInfo) {
        console.log('Bonding curve account not found for:', mintAddress.toBase58())
        return null
      }
      
      return this.parseBondingCurveAccount(accountInfo.data)
    } catch (error) {
      console.error('Failed to get bonding curve account:', error)
      return null
    }
  }

  /**
   * Get bonding curve data from database (for standard SPL tokens)
   */
  async getBondingCurveFromDatabase(mintAddress: string): Promise<BondingCurveAccount | null> {
    try {
      const { data: tokenData, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .single()

      if (error || !tokenData) {
        console.log('Token not found in database for:', mintAddress)
        return null
      }

      // Convert database data to BondingCurveAccount format
      return {
        discriminator: Buffer.from([]), // Not needed for database approach
        mintAddress: new PublicKey(mintAddress),
        creator: new PublicKey(tokenData.creator || platformConfig.authority),
        virtualTokenReserves: BigInt(tokenData.virtual_token_reserves || tokenData.total_supply || 1000000000),
        virtualSolReserves: BigInt(tokenData.virtual_sol_reserves || 1073000000), // Default from your logs
        realTokenReserves: BigInt(tokenData.real_token_reserves || 0),
        realSolReserves: BigInt(tokenData.real_sol_reserves || 0),
        tokenTotalSupply: BigInt(tokenData.total_supply || 1000000000),
        graduated: tokenData.graduated || false,
        createdAt: BigInt(new Date(tokenData.created_at).getTime()),
        bumpSeed: 255 // Default bump seed
      }
    } catch (error) {
      console.error('Failed to get bonding curve from database:', error)
      return null
    }
  }

  /**
   * Create initialize bonding curve instruction
   */
  async createInitializeInstruction(
    mintAddress: PublicKey,
    creator: PublicKey,
    initialVirtualTokenReserves: bigint,
    initialVirtualSolReserves: bigint
  ): Promise<TransactionInstruction[]> {
    const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
    
    const instructionData = encodeInitializeInstruction({
      initialVirtualTokenReserves,
      initialVirtualSolReserves
    })
    
    return [new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: instructionData
    })]
  }

  /**
   * Create buy transaction instruction
   */
  async createBuyInstruction(
    mintAddress: PublicKey,
    buyer: PublicKey,
    solAmount: bigint,
    minTokensReceived: bigint,
    slippageBps: number = tradingConfig.slippageToleranceDefault * 100
  ): Promise<TransactionInstruction[]> {
    // Get or create buyer's associated token account
    const buyerTokenAccount = await getAssociatedTokenAddress(mintAddress, buyer)
    
    const instructions: TransactionInstruction[] = []
    
    // Check if buyer's token account exists, create if not
    const tokenAccountInfo = await this.connection.getAccountInfo(buyerTokenAccount)
    if (!tokenAccountInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          buyer, // payer
          buyerTokenAccount, // associated token account
          buyer, // owner
          mintAddress // mint
        )
      )
    }

    // Calculate platform fee (1%) and treasury amount (99%)
    const feeAmount = solAmount / BigInt(100)          // 1% fee to platform
    const treasuryAmount = solAmount - feeAmount       // 99% to treasury/pool
    
    console.log('💰 [TX] Full trade amount:', Number(solAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💰 [TX] Platform fee:', Number(feeAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💰 [TX] Treasury amount:', Number(treasuryAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💳 [TX] Fee wallet:', this.feeWallet.toBase58())

    // Transfer treasury amount (99% of trade) to treasury wallet
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: new PublicKey(platformConfig.treasury), // Treasury wallet
        lamports: treasuryAmount
      })
    )
    
    // Transfer platform fee (1% of trade) to fee wallet
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: buyer,
        toPubkey: this.feeWallet,
        lamports: feeAmount
      })
    )
    
    console.log('✅ [TX] Added treasury transfer instruction:', Number(treasuryAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('✅ [TX] Added fee transfer instruction:', Number(feeAmount) / LAMPORTS_PER_SOL, 'SOL')

    return instructions
  }

  /**
   * Create sell transaction instruction (simplified for standard SPL tokens)
   */
  async createSellInstruction(
    mintAddress: PublicKey,
    seller: PublicKey,
    tokenAmount: bigint,
    minSolReceived: bigint,
    slippageBps: number = tradingConfig.slippageToleranceDefault * 100
  ): Promise<TransactionInstruction[]> {
    // Calculate platform fee (1% of the SOL to be received)
    const feeAmount = minSolReceived / BigInt(100)
    
    console.log('💰 [TX] Sell fee:', Number(feeAmount) / LAMPORTS_PER_SOL, 'SOL')
    console.log('💳 [TX] Fee wallet:', this.feeWallet.toBase58())

    // Transfer platform fee to fee wallet (simplified sell transaction)
    return [SystemProgram.transfer({
      fromPubkey: seller,
      toPubkey: this.feeWallet,
      lamports: feeAmount
    })]
  }

  /**
   * Execute buy transaction (PRODUCTION - Real blockchain transactions)
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: number,
    slippagePercent: number = tradingConfig.slippageToleranceDefault
  ): Promise<string> {
    console.log('💰 [BUY] Starting buy transaction...')
    console.log('📊 [BUY] Parameters:', { 
      mintAddress: mintAddress.toBase58(), 
      solAmount, 
      slippagePercent 
    })

    // Get the authenticated user ID from the centralized auth store.
    // This store is responsible for handling all authentication and state consistency.
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated || !authStore.user?.id) {
      // The UI should prevent this, but as a safeguard:
      throw new Error('User not authenticated. Please connect and sign in with your wallet.');
    }
    const actualUserId = authStore.user.id;
    console.log('✅ [BUY] Proceeding with consistent user ID from auth store:', actualUserId);

    if (!walletService.connected || !walletService.publicKey) {
      throw new Error('Wallet not connected')
    }

    // Validate trade amount
    const solAmountLamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL))
    if (solAmountLamports < BigInt(tradingConfig.minTradeAmount)) {
      throw new Error(`Minimum trade amount is ${tradingConfig.minTradeAmount / LAMPORTS_PER_SOL} SOL`)
    }
    if (solAmountLamports > BigInt(tradingConfig.maxTradeAmount)) {
      throw new Error(`Maximum trade amount is ${tradingConfig.maxTradeAmount / LAMPORTS_PER_SOL} SOL`)
    }

    // Get the most up-to-date bonding curve state directly from the blockchain for a real trade.
    let bondingCurve = await this.getBondingCurveAccount(mintAddress)
    let needsInit = false;
    if (!bondingCurve) {
      bondingCurve = await this.getBondingCurveFromDatabase(mintAddress.toBase58())
      if (!bondingCurve) {
        needsInit = true;
      }
    }


    // Graduation check
    if (bondingCurve && bondingCurve.graduated) {
      throw new Error('This token has graduated and can only be traded on DEX');
    }

    // Declare output variables for use throughout function
    let tokensOut: bigint = BigInt(0);
    let minTokensReceived: bigint = BigInt(0);

    // Calculate expected tokens with slippage protection
    if (needsInit) {
      const k = BigInt(bondingCurveConfig.initialVirtualSolReserves) * BigInt(bondingCurveConfig.initialVirtualTokenReserves);
      const newSolReserves = BigInt(bondingCurveConfig.initialVirtualSolReserves) + solAmountLamports;
      const newTokenReserves = k / newSolReserves;
      tokensOut = BigInt(bondingCurveConfig.initialVirtualTokenReserves) - newTokenReserves;
      const slippageFactor = (100 - slippagePercent) / 100;
      minTokensReceived = BigInt(Math.floor(Number(tokensOut) * slippageFactor));
    } else if (bondingCurve) {
      const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves;
      const newSolReserves = bondingCurve.virtualSolReserves + solAmountLamports;
      const newTokenReserves = k / newSolReserves;
      tokensOut = bondingCurve.virtualTokenReserves - newTokenReserves;
      const slippageFactor = (100 - slippagePercent) / 100;
      minTokensReceived = BigInt(Math.floor(Number(tokensOut) * slippageFactor));
    } else {
      throw new Error('Bonding curve state could not be determined.');
    }

    // 🚀 CREATE REAL BLOCKCHAIN TRANSACTION
    let instructions: TransactionInstruction[] = [];
    if (needsInit) {
      // Add initialize instruction first
      if (!walletService.publicKey) throw new Error('Wallet not connected');
      const creator = walletService.publicKey;
      const initInstructions = await this.createInitializeInstruction(
        mintAddress,
        creator,
        BigInt(bondingCurveConfig.initialVirtualTokenReserves),
        BigInt(bondingCurveConfig.initialVirtualSolReserves)
      );
      instructions.push(...initInstructions);
    }

    // Add buy instructions
    const buyInstructions = await this.createBuyInstruction(
      mintAddress,
      walletService.publicKey,
      solAmountLamports,
      minTokensReceived,
      slippagePercent * 100 // Convert to basis points
    );
    instructions.push(...buyInstructions);

    // Create transaction
    const transaction = new Transaction();
    transaction.add(...instructions);

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = walletService.publicKey!;

    // Send transaction
    console.log('📤 Sending buy transaction to Solana...');
    const signature = await walletService.sendTransaction(transaction);
    console.log('✅ Transaction sent:', signature);

    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const confirmation = await this.connection.confirmTransaction(
      signature,
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    // Optionally: update database, analytics, etc. here

    return signature;
  }

  /**
   * Handle Solana-specific errors with user-friendly messages
   */
  private handleSolanaError(error: any): never {
    console.error('Solana transaction error:', error)
    
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Insufficient SOL balance. Please add more SOL to your wallet.')
    } else if (error.message?.includes('0x1771')) { // Custom program error
      throw new Error('Token has already graduated to DEX trading.')
    } else if (error.message?.includes('0x1772')) { // Custom program error  
      throw new Error('Price slippage too high. Try again with higher slippage tolerance.')
    } else if (error.message?.includes('User rejected')) {
      throw new Error('Transaction was cancelled.')
    } else if (error.message?.includes('blockhash not found')) {
      throw new Error('Network congestion. Please try again.')
    } else if (error.message?.includes('0x0')) {
      throw new Error('Program error: Invalid instruction.')
    } else if (error.message?.includes('0x1')) {
      throw new Error('Program error: Already graduated.')
    } else if (error.message?.includes('0x2')) {
      throw new Error('Program error: Slippage tolerance exceeded.')
    } else {
      throw new Error(`Transaction failed: ${error.message}`)
    }
  }

  /**
   * Get user's token balance from blockchain
   */
  async getUserTokenBalance(mintAddress: PublicKey, userPublicKey: PublicKey): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(mintAddress, userPublicKey)
      const accountInfo = await this.connection.getAccountInfo(tokenAccount)
      
      if (!accountInfo) {
        return 0
      }
      
      // Parse token account data to get balance
      // This is a simplified version - you'd need proper token account parsing
      const balance = accountInfo.data.readBigUInt64LE(64) // Token amount is at offset 64
      return Number(balance) / Math.pow(10, 9) // Convert from lamports to tokens
    } catch (error) {
      console.error('Failed to get user token balance:', error)
      return 0
    }
  }
}

// Export singleton instance
export const solanaProgram = new SolanaProgram()