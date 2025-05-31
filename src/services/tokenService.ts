import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Keypair,
  TransactionMessage,
  VersionedTransaction
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
  AuthorityType,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo
} from '@solana/spl-token'
import { walletService } from './wallet'
import { BondingCurveService } from './bondingCurve'
import { solanaProgram } from './solanaProgram'
import { SupabaseService, supabase } from './supabase'
import type { Database } from './supabase'
import { tokenDefaults, solanaConfig, platformConfig } from '@/config'

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
    console.log('TokenService: Using RPC URL:', solanaConfig.rpcUrl)
    console.log('TokenService: Network:', solanaConfig.network)
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
      // Step 0: Pre-flight checks
      console.log('🔍 Creating token...')
      
      // Check wallet balance
      const balance = await this.connection.getBalance(walletService.publicKey)
      const balanceSOL = balance / LAMPORTS_PER_SOL
      console.log('💰 Wallet balance:', balanceSOL.toFixed(4), 'SOL')
      
      if (balanceSOL < 0.01) {
        throw new Error(`Insufficient SOL balance. You have ${balanceSOL.toFixed(4)} SOL, but need at least 0.01 SOL for transaction fees.`)
      }

      // Step 1: Upload image to storage if provided
      let imageUrl = ''
      if (tokenData.imageFile) {
        console.log('📸 Uploading image...')
        imageUrl = await this.uploadImage(tokenData.imageFile)
        console.log('✅ Image uploaded successfully')
      }

      // Step 2: Create and upload metadata
      console.log('📝 Creating metadata...')
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
      console.log('✅ Metadata uploaded successfully')

      // Step 3: Create mint account
      console.log('🔨 Creating mint account...')
      
      // Generate mint keypair
      const mintKeypair = Keypair.generate()
      const mintAddress = mintKeypair.publicKey
      
      console.log('🎯 Mint address:', mintAddress.toBase58())

      // Step 3A: Create mint account using VersionedTransaction
      const rentExemptAmount = await getMinimumBalanceForRentExemptMint(this.connection)
      
      // Get fresh blockhash for the mint transaction
      const { blockhash: mintBlockhash, lastValidBlockHeight: mintValidHeight } = await this.connection.getLatestBlockhash('finalized')
      
      const instructions = [
        SystemProgram.createAccount({
          fromPubkey: walletService.publicKey,
          newAccountPubkey: mintAddress,
          space: MINT_SIZE,
          lamports: rentExemptAmount,
          programId: TOKEN_PROGRAM_ID
        }),
        createInitializeMintInstruction(
          mintAddress,
          tokenDefaults.decimals,
          walletService.publicKey, // mint authority
          walletService.publicKey  // freeze authority
        )
      ]

      // Create VersionedTransaction using TransactionMessage
      const messageV0 = new TransactionMessage({
        payerKey: walletService.publicKey,
        recentBlockhash: mintBlockhash,
        instructions: instructions
      }).compileToV0Message()

      const transactionV0 = new VersionedTransaction(messageV0)

      console.log('🖊️ Signing mint transaction...')
      
      try {
        // Sign with wallet (this will work with VersionedTransaction)
        const signedTx = await walletService.signTransaction(transactionV0)
        
        // Add mint keypair signature manually for account creation
        if (signedTx instanceof VersionedTransaction || typeof signedTx.sign === 'function') {
          try {
            // For VersionedTransaction, we need to use a different approach
            // Add the mint keypair signature manually
            const signMethod = (signedTx as any).sign
            if (typeof signMethod === 'function') {
              signMethod.call(signedTx, [mintKeypair])
            } else {
              throw new Error('Sign method not available on transaction')
            }
          } catch (signMethodError: any) {
            console.error('❌ Failed to add mint signature:', signMethodError)
            throw new Error(`Failed to add mint keypair signature: ${signMethodError.message}`)
          }
          
          const txSignature = await this.connection.sendRawTransaction(signedTx.serialize())
          console.log('✅ Mint created:', txSignature.slice(0, 8) + '...')
          
          // Wait for confirmation
          await this.connection.confirmTransaction({
            signature: txSignature,
            blockhash: mintBlockhash,
            lastValidBlockHeight: mintValidHeight
          })
          
          // Continue with token operations...
          console.log('🏦 Creating token account...')
          const associatedTokenAddress = await getAssociatedTokenAddress(
            mintAddress,
            walletService.publicKey
          )

          const tokenTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              walletService.publicKey, // payer
              associatedTokenAddress,   // ata
              walletService.publicKey, // owner
              mintAddress              // mint
            ),
            createMintToInstruction(
              mintAddress,
              associatedTokenAddress,
              walletService.publicKey, // mint authority
              tokenDefaults.totalSupply * Math.pow(10, tokenDefaults.decimals)
            )
          )

          console.log('🖊️ Signing token operations...')
          const tokenTxSignature = await walletService.sendTransaction(tokenTx)
          console.log('✅ Token minted:', tokenTxSignature.slice(0, 8) + '...')

          // Step 4: Initialize bonding curve state (no transaction needed)
          const bondingCurveState = BondingCurveService.createInitialState(mintAddress)

          // Step 5: Save to database
          console.log('💾 Saving to database...')
          await this.saveTokenToDatabase({
            mintAddress: mintAddress.toBase58(),
            metadataUri,
            tokenData,
            creatorId: walletService.publicKey.toBase58(),
            signature: tokenTxSignature,
            imageUrl
          })

          console.log('🎉 TOKEN CREATED SUCCESSFULLY!')
          console.log('📍 Mint Address:', mintAddress.toBase58())
          
          return {
            mintAddress: mintAddress.toBase58(),
            metadataUri,
            bondingCurveAddress: 'initialized',
            signature: tokenTxSignature,
            tokenAccount: associatedTokenAddress.toBase58()
          }
        } else if (typeof (signedTx as any).partialSign === 'function') {
          // Legacy Transaction with partialSign method
          console.log('✅ Got Legacy Transaction with partialSign, using partialSign...')
          ;(signedTx as any).partialSign(mintKeypair)
          const txSignature = await this.connection.sendRawTransaction((signedTx as any).serialize())
          console.log('✅ Legacy transaction sent:', txSignature)
          
          // Wait for confirmation
          await this.connection.confirmTransaction({
            signature: txSignature,
            blockhash: mintBlockhash,
            lastValidBlockHeight: mintValidHeight
          })
          console.log('✅ Mint created successfully with Legacy Transaction!')
          
          // Continue with token operations (same as above)
          throw new Error('Legacy transaction token operations not implemented in this simplified version')
        } else {
          // Unsupported transaction type
          console.error('❌ Unsupported transaction type or missing methods')
          console.error('Available methods:', Object.getOwnPropertyNames(signedTx))
          console.error('Constructor:', signedTx.constructor.name)
          throw new Error(`Unsupported transaction type: ${signedTx.constructor.name}. Missing required signing methods.`)
        }
      } catch (signError: any) {
        console.error('❌ Transaction signing failed:', signError)
        
        // Enhanced error reporting
        if (signError.message?.includes('User rejected')) {
          throw new Error('Transaction was rejected. Please approve the transaction in your wallet and try again.')
        } else if (signError.message?.includes('insufficient')) {
          throw new Error('Insufficient SOL balance. Please add more SOL to your wallet.')
        } else {
          throw new Error(`Transaction signing failed: ${signError.message}`)
        }
      }

    } catch (error) {
      console.error('❌ Token creation failed:', error)
      
      // Enhanced error reporting
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5)
        })
        
        // Specific error handling
        if (error.message.includes('insufficient')) {
          throw new Error('Insufficient SOL balance for token creation. Please add more SOL to your wallet.')
        } else if (error.message.includes('blockhash')) {
          throw new Error('Network error: Recent blockhash expired. Please try again.')
        } else if (error.message.includes('signature')) {
          throw new Error('Transaction signing failed. Please approve the transaction in your wallet.')
        } else if (error.message.includes('WalletSignTransactionError')) {
          throw new Error('Transaction signing was cancelled. Please try again and approve the transaction.')
        }
      }
      
      throw error
    }
  }

  /**
   * Upload image to Supabase Storage
   */
  private async uploadImage(file: File): Promise<string> {
    try {
      // Check authentication status
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('Authentication required for file upload')
      }

      // Check if token-assets bucket exists, create if needed
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === 'token-assets')
      
      if (!bucketExists) {
        // Try to create bucket, ignore errors if it already exists
        await supabase.storage.createBucket('token-assets', {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/json'],
          fileSizeLimit: 50 * 1024 * 1024 // 50MB
        }).catch(() => {
          // Bucket may already exist, continue silently
        })
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `token-images/${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('token-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        console.error('Storage upload error:', error.message)
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
   * Upload metadata JSON to Supabase Storage
   */
  private async uploadMetadata(metadata: TokenMetadata): Promise<string> {
    try {
      // Convert metadata to JSON blob
      const metadataJson = JSON.stringify(metadata, null, 2)
      const metadataBlob = new Blob([metadataJson], { type: 'application/json' })
      
      // Generate unique filename for metadata
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(5)}.json`
      const filePath = `token-metadata/${fileName}`

      // Upload metadata to Supabase Storage
      const { data, error } = await supabase.storage
        .from('token-assets')
        .upload(filePath, metadataBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/json'
        })
      
      if (error) {
        console.error('Metadata upload error:', error)
        throw error
      }

      // Get public URL for metadata
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
        current_price: BondingCurveService.calculatePrice(initialState), // Keep as decimal SOL value
        market_cap: Math.floor(BondingCurveService.calculateMarketCap(initialState) * LAMPORTS_PER_SOL), // Convert to lamports for BIGINT
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