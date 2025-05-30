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
import { walletService } from './wallet'
import { solanaConfig, programConfig, platformConfig, bondingCurveConfig, tradingConfig } from '@/config'

// Program instruction types
export enum BondingCurveInstruction {
  Initialize = 0,
  Buy = 1,
  Sell = 2,
  Graduate = 3,
  Withdraw = 4
}

// Account structures
export interface BondingCurveAccount {
  discriminator: number[]
  mintAddress: Uint8Array
  creator: Uint8Array
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  graduated: boolean
  createdAt: bigint
  bumpSeed: number
}

export interface TradeInstruction {
  instruction: number
  amount: bigint
  minReceived: bigint
  maxSlippage: number
}

// Simple buffer encoding utilities
const encodeU8 = (value: number): Buffer => {
  const buf = Buffer.alloc(1)
  buf.writeUInt8(value, 0)
  return buf
}

const encodeU64 = (value: bigint): Buffer => {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(value, 0)
  return buf
}

const encodeU16 = (value: number): Buffer => {
  const buf = Buffer.alloc(2)
  buf.writeUInt16LE(value, 0)
  return buf
}

const encodeTradeInstruction = (instruction: TradeInstruction): Buffer => {
  return Buffer.concat([
    encodeU8(instruction.instruction),
    encodeU64(instruction.amount),
    encodeU64(instruction.minReceived),
    encodeU16(instruction.maxSlippage)
  ])
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
   * Derive bonding curve account address for a token mint
   */
  deriveBondingCurveAddress(mintAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('bonding-curve'),
        mintAddress.toBuffer()
      ],
      this.programId
    )
  }

  /**
   * Get bonding curve account data
   */
  async getBondingCurveAccount(mintAddress: PublicKey): Promise<BondingCurveAccount | null> {
    try {
      const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
      
      const accountInfo = await this.connection.getAccountInfo(bondingCurveAddress)
      if (!accountInfo || !accountInfo.data) {
        return null
      }

      // For now, return a mock bonding curve account since we don't have the actual program deployed
      // In production, this would deserialize the actual account data
      return {
        discriminator: [0, 0, 0, 0, 0, 0, 0, 0],
        mintAddress: mintAddress.toBytes(),
        creator: new Uint8Array(32),
        virtualTokenReserves: BigInt(bondingCurveConfig.initialVirtualTokenReserves),
        virtualSolReserves: BigInt(bondingCurveConfig.initialVirtualSolReserves),
        realTokenReserves: BigInt(bondingCurveConfig.initialVirtualTokenReserves),
        realSolReserves: BigInt(bondingCurveConfig.initialRealSolReserves),
        tokenTotalSupply: BigInt(1_000_000_000 * Math.pow(10, 9)),
        graduated: false,
        createdAt: BigInt(Date.now()),
        bumpSeed: 255
      }
    } catch (error) {
      console.error('Failed to get bonding curve account:', error)
      return null
    }
  }

  /**
   * Initialize bonding curve for a new token
   */
  async initializeBondingCurve(
    mintAddress: PublicKey,
    creator: PublicKey
  ): Promise<TransactionInstruction> {
    const [bondingCurveAddress, bumpSeed] = this.deriveBondingCurveAddress(mintAddress)
    
    // Create initialization instruction
    const initData = encodeTradeInstruction({
      instruction: BondingCurveInstruction.Initialize,
      amount: BigInt(bondingCurveConfig.initialVirtualTokenReserves),
      minReceived: BigInt(bondingCurveConfig.initialVirtualSolReserves),
      maxSlippage: 0
    })

    return new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Bonding curve account (writable, to be created)
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        // Token mint account (readable)
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        // Creator account (signer, pays for account creation)
        { pubkey: creator, isSigner: true, isWritable: true },
        // System program for account creation
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: initData
    })
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
    const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
    
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

    // Create buy instruction data
    const buyData = encodeTradeInstruction({
      instruction: BondingCurveInstruction.Buy,
      amount: solAmount,
      minReceived: minTokensReceived,
      maxSlippage: slippageBps
    })

    // Add buy instruction
    instructions.push(new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Bonding curve account (writable)
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        // Token mint account (writable for minting)
        { pubkey: mintAddress, isSigner: false, isWritable: true },
        // Buyer account (signer, pays SOL)
        { pubkey: buyer, isSigner: true, isWritable: true },
        // Buyer's token account (writable, receives tokens)
        { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
        // Platform fee wallet (receives fees)
        { pubkey: this.feeWallet, isSigner: false, isWritable: true },
        // Token program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: buyData
    }))

    return instructions
  }

  /**
   * Create sell transaction instruction
   */
  async createSellInstruction(
    mintAddress: PublicKey,
    seller: PublicKey,
    tokenAmount: bigint,
    minSolReceived: bigint,
    slippageBps: number = tradingConfig.slippageToleranceDefault * 100
  ): Promise<TransactionInstruction[]> {
    const [bondingCurveAddress] = this.deriveBondingCurveAddress(mintAddress)
    
    // Get seller's associated token account
    const sellerTokenAccount = await getAssociatedTokenAddress(mintAddress, seller)
    
    // Create sell instruction data
    const sellData = encodeTradeInstruction({
      instruction: BondingCurveInstruction.Sell,
      amount: tokenAmount,
      minReceived: minSolReceived,
      maxSlippage: slippageBps
    })

    return [new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Bonding curve account (writable)
        { pubkey: bondingCurveAddress, isSigner: false, isWritable: true },
        // Token mint account (readable)
        { pubkey: mintAddress, isSigner: false, isWritable: false },
        // Seller account (signer, receives SOL)
        { pubkey: seller, isSigner: true, isWritable: true },
        // Seller's token account (writable, tokens burned from here)
        { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
        // Platform fee wallet (receives fees)
        { pubkey: this.feeWallet, isSigner: false, isWritable: true },
        // Token program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // System program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data: sellData
    })]
  }

  /**
   * Execute buy transaction
   */
  async buyTokens(
    mintAddress: PublicKey,
    solAmount: number,
    slippagePercent: number = tradingConfig.slippageToleranceDefault
  ): Promise<string> {
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

    // Get bonding curve state to calculate expected tokens
    const bondingCurve = await this.getBondingCurveAccount(mintAddress)
    if (!bondingCurve) {
      throw new Error('Bonding curve not found for this token')
    }

    if (bondingCurve.graduated) {
      throw new Error('This token has graduated and can only be traded on DEX')
    }

    // Calculate expected tokens received (simplified calculation)
    // In a real implementation, you'd call the program's view function
    const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves
    const newSolReserves = bondingCurve.virtualSolReserves + solAmountLamports
    const newTokenReserves = k / newSolReserves
    const tokensOut = bondingCurve.virtualTokenReserves - newTokenReserves
    
    // Apply slippage tolerance
    const minTokensReceived = (tokensOut * BigInt(Math.floor((100 - slippagePercent) * 100))) / BigInt(10000)

    // Create transaction
    const transaction = new Transaction()
    
    // Add buy instructions
    const buyInstructions = await this.createBuyInstruction(
      mintAddress,
      walletService.publicKey,
      solAmountLamports,
      minTokensReceived,
      Math.floor(slippagePercent * 100)
    )
    
    transaction.add(...buyInstructions)

    // Send transaction
    const signature = await walletService.sendTransaction(transaction)
    
    console.log('Buy transaction sent:', signature)
    return signature
  }

  /**
   * Execute sell transaction
   */
  async sellTokens(
    mintAddress: PublicKey,
    tokenAmount: number,
    slippagePercent: number = tradingConfig.slippageToleranceDefault
  ): Promise<string> {
    if (!walletService.connected || !walletService.publicKey) {
      throw new Error('Wallet not connected')
    }

    // Convert token amount to proper decimals
    const tokenAmountWithDecimals = BigInt(Math.floor(tokenAmount * Math.pow(10, 9))) // 9 decimals

    // Get bonding curve state to calculate expected SOL
    const bondingCurve = await this.getBondingCurveAccount(mintAddress)
    if (!bondingCurve) {
      throw new Error('Bonding curve not found for this token')
    }

    if (bondingCurve.graduated) {
      throw new Error('This token has graduated and can only be traded on DEX')
    }

    // Calculate expected SOL received (simplified calculation)
    const k = bondingCurve.virtualSolReserves * bondingCurve.virtualTokenReserves
    const newTokenReserves = bondingCurve.virtualTokenReserves + tokenAmountWithDecimals
    const newSolReserves = k / newTokenReserves
    const solOut = bondingCurve.virtualSolReserves - newSolReserves
    
    // Apply slippage tolerance
    const minSolReceived = (solOut * BigInt(Math.floor((100 - slippagePercent) * 100))) / BigInt(10000)

    // Create transaction
    const transaction = new Transaction()
    
    // Add sell instructions
    const sellInstructions = await this.createSellInstruction(
      mintAddress,
      walletService.publicKey,
      tokenAmountWithDecimals,
      minSolReceived,
      Math.floor(slippagePercent * 100)
    )
    
    transaction.add(...sellInstructions)

    // Send transaction
    const signature = await walletService.sendTransaction(transaction)
    
    console.log('Sell transaction sent:', signature)
    return signature
  }

  /**
   * Get user's token balance
   */
  async getUserTokenBalance(mintAddress: PublicKey, userPublicKey: PublicKey): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(mintAddress, userPublicKey)
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount)
      
      return accountInfo.value.uiAmount || 0
    } catch (error) {
      // Token account doesn't exist or other error
      return 0
    }
  }

  /**
   * Get all token accounts for a user (for portfolio)
   */
  async getUserTokenAccounts(userPublicKey: PublicKey): Promise<Array<{
    mint: string
    balance: number
    decimals: number
  }>> {
    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        userPublicKey,
        { programId: TOKEN_PROGRAM_ID }
      )

      return tokenAccounts.value
        .filter(account => {
          const amount = account.account.data.parsed.info.tokenAmount.uiAmount
          return amount && amount > 0 // Only return accounts with balance
        })
        .map(account => ({
          mint: account.account.data.parsed.info.mint,
          balance: account.account.data.parsed.info.tokenAmount.uiAmount,
          decimals: account.account.data.parsed.info.tokenAmount.decimals
        }))
    } catch (error) {
      console.error('Failed to get user token accounts:', error)
      return []
    }
  }
}

// Create singleton instance
export const solanaProgram = new SolanaProgram() 