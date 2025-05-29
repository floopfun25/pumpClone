import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createSetAuthorityInstruction,
  AuthorityType
} from '@solana/spl-token'
import { walletService } from './wallet'
import { BondingCurveService } from './bondingCurve'
import { SupabaseService, supabase } from './supabase'
import type { Database } from './supabase'
import { tokenDefaults, solanaConfig } from '@/config'

// Token creation types
export interface TokenCreationData {
  name: string
  symbol: string
  description: string
  imageFile?: File
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
}

export interface TokenMetadata {
  name: string
  symbol: string
  description: string
  image: string
  external_url?: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  properties: {
    files: Array<{
      uri: string
      type: string
    }>
    category: string
    creators?: Array<{
      address: string
      share: number
      verified?: boolean
    }>
  }
}

export interface CreatedToken {
  mintAddress: string
  metadataUri: string
  bondingCurveAddress: string
  signature: string
  tokenAccount: string
}

class TokenService {
  private connection: Connection

  constructor() {
    this.connection = new Connection(
      solanaConfig.rpcUrl,
      solanaConfig.commitment
    )
  }

  /**
   * Create a new SPL token with metadata and bonding curve
   */
  async createToken(tokenData: TokenCreationData): Promise<CreatedToken> {
    if (!walletService.connected || !walletService.publicKey) {
      throw new Error('Wallet not connected')
    }

    try {
      // Step 1: Upload image to storage if provided
      let imageUrl = ''
      if (tokenData.imageFile) {
        imageUrl = await this.uploadImage(tokenData.imageFile)
      }

      // Step 2: Create and upload metadata
      const metadata: TokenMetadata = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        description: tokenData.description,
        image: imageUrl,
        external_url: tokenData.website,
        properties: {
          files: imageUrl ? [{
            uri: imageUrl,
            type: tokenData.imageFile?.type || 'image/png'
          }] : [],
          category: 'image',
          creators: [{
            address: walletService.publicKey.toBase58(),
            share: 100,
            verified: true
          }]
        }
      }

      const metadataUri = await this.uploadMetadata(metadata)

      // Step 3: Create the mint account
      const mintKeypair = Keypair.generate()
      const mintAddress = mintKeypair.publicKey

      // Step 4: Create associated token account for creator
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintAddress,
        walletService.publicKey
      )

      // Step 5: Build the transaction
      const transaction = new Transaction()

      // Get rent exemption amount for mint account
      const rentExemptAmount = await getMinimumBalanceForRentExemptMint(this.connection)

      // Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: walletService.publicKey,
          newAccountPubkey: mintAddress,
          space: MINT_SIZE,
          lamports: rentExemptAmount,
          programId: TOKEN_PROGRAM_ID
        })
      )

      // Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintAddress,
          tokenDefaults.decimals,
          walletService.publicKey, // mint authority
          walletService.publicKey  // freeze authority (optional)
        )
      )

      // Create associated token account for creator
      transaction.add(
        createAssociatedTokenAccountInstruction(
          walletService.publicKey, // payer
          associatedTokenAddress,
          walletService.publicKey, // owner
          mintAddress
        )
      )

      // Mint total supply to creator
      const totalSupplyWithDecimals = BigInt(tokenDefaults.totalSupply) * BigInt(10 ** tokenDefaults.decimals)
      transaction.add(
        createMintToInstruction(
          mintAddress,
          associatedTokenAddress,
          walletService.publicKey,
          totalSupplyWithDecimals
        )
      )

      // Revoke mint authority to make it non-mintable
      transaction.add(
        createSetAuthorityInstruction(
          mintAddress,
          walletService.publicKey,
          AuthorityType.MintTokens,
          null // Setting to null removes the authority
        )
      )

      // Add creation fee payment
      const creationFee = LAMPORTS_PER_SOL * tokenDefaults.creationFee
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: walletService.publicKey,
          toPubkey: new PublicKey('11111111111111111111111111111112'), // TODO: Replace with platform fee account
          lamports: creationFee
        })
      )

      // Step 6: Send transaction
      transaction.partialSign(mintKeypair)
      const signature = await walletService.sendTransaction(transaction)

      // Step 7: Create bonding curve address (derived)
      const bondingCurveAddress = this.deriveBondingCurveAddress(mintAddress)

      // Step 8: Save token to database
      await this.saveTokenToDatabase({
        mintAddress: mintAddress.toBase58(),
        metadataUri,
        tokenData,
        creatorId: walletService.publicKey.toBase58(),
        signature,
        imageUrl
      })

      return {
        mintAddress: mintAddress.toBase58(),
        metadataUri,
        bondingCurveAddress: bondingCurveAddress.toBase58(),
        signature,
        tokenAccount: associatedTokenAddress.toBase58()
      }

    } catch (error) {
      console.error('Token creation failed:', error)
      throw new Error(`Failed to create token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload image to Supabase Storage
   */
  private async uploadImage(file: File): Promise<string> {
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `token-images/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('token-assets')
        .upload(filePath, file)
      
      if (error) {
        throw error
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('token-assets')
        .getPublicUrl(filePath)
      
      return publicUrl.publicUrl

    } catch (error) {
      console.error('Image upload failed:', error)
      throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Upload metadata JSON to storage
   */
  private async uploadMetadata(metadata: TokenMetadata): Promise<string> {
    try {
      // Convert metadata to JSON
      const metadataJson = JSON.stringify(metadata, null, 2)
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' })
      
      // Generate unique filename
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.json`
      const filePath = `token-metadata/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('token-assets')
        .upload(filePath, metadataBlob)
      
      if (error) {
        throw error
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('token-assets')
        .getPublicUrl(filePath)
      
      return publicUrl.publicUrl

    } catch (error) {
      console.error('Metadata upload failed:', error)
      throw new Error(`Failed to upload metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Derive bonding curve address from mint
   */
  private deriveBondingCurveAddress(mintAddress: PublicKey): PublicKey {
    // This would be derived from your bonding curve program
    // For now, we'll create a deterministic address
    const [bondingCurveAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('bonding-curve'),
        mintAddress.toBuffer()
      ],
      new PublicKey('11111111111111111111111111111112') // TODO: Replace with actual program ID
    )
    
    return bondingCurveAddress
  }

  /**
   * Save token data to Supabase database
   */
  private async saveTokenToDatabase(data: {
    mintAddress: string
    metadataUri: string
    tokenData: TokenCreationData
    creatorId: string
    signature: string
    imageUrl: string
  }) {
    try {
      // First, ensure user exists in database
      const user = await SupabaseService.getUserByWallet(data.creatorId)
      let userId = user?.id

      if (!user) {
        // Create user if doesn't exist
        const newUser = await SupabaseService.upsertUser({
          wallet_address: data.creatorId,
          username: `user_${data.creatorId.slice(0, 8)}`,
          tokens_created: 1
        })
        userId = newUser.id
      } else {
        // Update user's token count
        const { error } = await supabase
          .from('users')
          .update({ tokens_created: (user.tokens_created || 0) + 1 })
          .eq('id', user.id)
        
        if (error) throw error
      }

      // Create initial bonding curve state
      const initialState = BondingCurveService.createInitialState(new PublicKey(data.mintAddress))

      // Prepare token data for database
      const tokenInsert: Database['public']['Tables']['tokens']['Insert'] = {
        mint_address: data.mintAddress,
        name: data.tokenData.name,
        symbol: data.tokenData.symbol,
        description: data.tokenData.description || '',
        image_url: data.imageUrl,
        metadata_uri: data.metadataUri,
        creator_id: userId!,
        total_supply: tokenDefaults.totalSupply,
        decimals: tokenDefaults.decimals,
        dev_share_percentage: 20, // 20% for DEX liquidity
        dev_tokens_amount: tokenDefaults.totalSupply * 0.2,
        lock_duration_days: null, // No lock duration for pump.fun style tokens
        locked_tokens_amount: tokenDefaults.totalSupply * 0.8, // 80% in bonding curve
        current_price: BondingCurveService.calculatePrice(initialState),
        market_cap: BondingCurveService.calculateMarketCap(initialState),
        volume_24h: 0,
        holders_count: 1,
        status: 'active',
        graduation_threshold: tokenDefaults.graduationThreshold,
        graduated_at: null, // Not graduated yet
        website: data.tokenData.website || null,
        twitter: data.tokenData.twitter || null,
        telegram: data.tokenData.telegram || null,
        discord: data.tokenData.discord || null,
        last_trade_at: null, // No trades yet
        bonding_curve_progress: 0,
        tags: [],
        is_nsfw: false,
        is_featured: false
      }

      // Save token to database
      const { error } = await supabase
        .from('tokens')
        .insert(tokenInsert)
      
      if (error) throw error

      console.log('Token saved to database successfully')

    } catch (error) {
      console.error('Failed to save token to database:', error)
      // Don't throw here as the token was already created on-chain
      // Just log the error for debugging
    }
  }

  /**
   * Get token metadata from URI
   */
  async getTokenMetadata(metadataUri: string): Promise<TokenMetadata> {
    try {
      const response = await fetch(metadataUri)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error('Failed to fetch token metadata:', error)
      throw new Error(`Failed to fetch metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate token creation data
   */
  validateTokenData(tokenData: TokenCreationData): string[] {
    const errors: string[] = []

    if (!tokenData.name || tokenData.name.trim().length === 0) {
      errors.push('Token name is required')
    }

    if (!tokenData.symbol || tokenData.symbol.trim().length === 0) {
      errors.push('Token symbol is required')
    }

    if (tokenData.symbol && tokenData.symbol.length > 8) {
      errors.push('Token symbol must be 8 characters or less')
    }

    if (tokenData.name && tokenData.name.length > 32) {
      errors.push('Token name must be 32 characters or less')
    }

    if (tokenData.description && tokenData.description.length > 500) {
      errors.push('Description must be 500 characters or less')
    }

    // Validate image file
    if (tokenData.imageFile) {
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (tokenData.imageFile.size > maxSize) {
        errors.push('Image file must be smaller than 5MB')
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(tokenData.imageFile.type)) {
        errors.push('Image must be JPEG, PNG, GIF, or WebP format')
      }
    }

    return errors
  }

  /**
   * Estimate creation cost
   */
  async estimateCreationCost(): Promise<{
    creationFee: number
    rentExempt: number
    transaction: number
    total: number
  }> {
    try {
      const rentExemptAmount = await getMinimumBalanceForRentExemptMint(this.connection)
      const rentExempt = rentExemptAmount / LAMPORTS_PER_SOL
      const creationFee = tokenDefaults.creationFee
      const transaction = 0.005 // Estimated transaction fee
      
      return {
        creationFee,
        rentExempt,
        transaction,
        total: creationFee + rentExempt + transaction
      }
    } catch (error) {
      console.error('Failed to estimate creation cost:', error)
      return {
        creationFee: tokenDefaults.creationFee,
        rentExempt: 0.002,
        transaction: 0.005,
        total: tokenDefaults.creationFee + 0.007
      }
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService() 