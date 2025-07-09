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
import { getWalletService } from './wallet'
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
  // Advanced creation options
  totalSupply?: number
  creatorSharePercentage?: number
  lockPercentage?: number
  lockDurationDays?: number
  prebuyAmount?: number
  unlockSchedule?: 'immediate' | 'linear' | 'cliff' | 'custom'
}

export interface TokenLockSettings {
  lockType: 'creator' | 'team' | 'liquidity' | 'marketing'
  amount: number
  durationDays: number
  unlockSchedule: UnlockScheduleItem[]
}

export interface UnlockScheduleItem {
  date: string
  percentage: number
  amount: number
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

const walletService = getWalletService()

class TokenService {
  private connection: Connection

  constructor() {
    this.connection = new Connection(solanaConfig.rpcUrl, 'confirmed');
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
      
      if (balanceSOL < 0.01) {
        throw new Error(`Insufficient SOL balance. You have ${balanceSOL.toFixed(4)} SOL, but need at least 0.01 SOL for transaction fees.`)
      }

      // Step 1: Upload image to storage if provided
      let imageUrl = ''
      if (tokenData.imageFile) {
        console.log('📸 Uploading image...')
        imageUrl = await this.uploadImage(tokenData.imageFile)
        console.log('✅ Image uploaded with URL:', imageUrl)
      } else {
        console.log('ℹ️ No image file provided for token creation')
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

      console.log('📋 [METADATA] Created metadata object:', {
        name: metadata.name,
        symbol: metadata.symbol,
        image: metadata.image,
        hasFiles: metadata.properties.files.length > 0
      })

      const metadataUri = await this.uploadMetadata(metadata)
      console.log('✅ Metadata uploaded')

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

      console.log('🖊️ Signing transactions...')
      
      try {
        // Sign with wallet (this will work with VersionedTransaction)
        const signedTx = await walletService.signTransaction(transactionV0)
        
        // Add mint keypair signature manually for account creation
        if (signedTx instanceof VersionedTransaction || typeof (signedTx as any).sign === 'function') {
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
          console.log('✅ Mint created')
          
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

          const tokenTxSignature = await walletService.sendTransaction(tokenTx)
          console.log('✅ Token minted')

          // Step 4: Initialize bonding curve state (no transaction needed)
          const bondingCurveState = BondingCurveService.createInitialState(mintAddress, tokenData.totalSupply || tokenDefaults.totalSupply)

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
          console.error('Constructor:', (signedTx as any).constructor?.name || 'Unknown')
          throw new Error(`Unsupported transaction type: ${(signedTx as any).constructor?.name || 'Unknown'}. Missing required signing methods.`)
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
      console.log('🔍 [IMAGE UPLOAD] Starting image upload process:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })

      // Check authentication status
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('🚫 [IMAGE UPLOAD] Authentication failed:', authError)
        throw new Error('Authentication required for file upload')
      }

      console.log('✅ [IMAGE UPLOAD] User authenticated:', user.id)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `token-images/${fileName}`

      console.log('📝 [IMAGE UPLOAD] Generated file path:', filePath)

      // Convert File to ArrayBuffer to prevent Supabase multipart corruption
      const arrayBuffer = await file.arrayBuffer()
      console.log('🔄 [IMAGE UPLOAD] Converted to ArrayBuffer:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        arrayBufferSize: arrayBuffer.byteLength
      })

      // Upload to Supabase Storage using ArrayBuffer (prevents form boundary corruption)
      const { data, error } = await supabase.storage
        .from('token-assets')
        .upload(filePath, arrayBuffer, {
          cacheControl: '3600',
          upsert: false
        })
      
      if (error) {
        console.error('❌ [IMAGE UPLOAD] Storage upload error:', {
          message: error.message,
          details: error,
          fileInfo: {
            name: file.name,
            type: file.type,
            size: file.size,
            path: filePath
          }
        })
        throw new Error(`Storage upload failed: ${error.message || 'Unknown storage error'}`)
      }

      console.log('✅ [IMAGE UPLOAD] File uploaded successfully:', data)

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('token-assets')
        .getPublicUrl(filePath)
      
      console.log('🔗 [IMAGE UPLOAD] Generated public URL:', {
        publicUrl: publicUrl.publicUrl,
        filePath: filePath
      })

      // Test if the URL is accessible using debug utilities
      try {
        const { testImageUrl, analyzeSupabaseUrl } = await import('@/utils/imageDebug')
        analyzeSupabaseUrl(publicUrl.publicUrl)
        await testImageUrl(publicUrl.publicUrl, 'Newly uploaded token image')
        
        // Test image load in Image element
        const imageTest = new Promise<boolean>((resolve) => {
          const img = new Image()
          img.onload = () => {
            console.log('✅ [IMAGE UPLOAD] Image element verification passed')
            resolve(true)
          }
          img.onerror = (e) => {
            console.error('❌ [IMAGE UPLOAD] Image element verification failed:', e)
            resolve(false)
          }
          img.src = publicUrl.publicUrl
          
          setTimeout(() => {
            console.warn('⏰ [IMAGE UPLOAD] Image verification timeout')
            resolve(false)
          }, 2000)
        })
        
        const imageValid = await imageTest
        if (imageValid) {
          console.log('🎉 [IMAGE UPLOAD] All verifications passed!')
        } else {
          console.error('💥 [IMAGE UPLOAD] Image verification failed - check if the file is corrupted')
        }
        
        // Debug: Log the final URL for manual testing
        console.log('🔗 [IMAGE UPLOAD] Manual verification URL:', publicUrl.publicUrl)
        console.log('📋 [IMAGE UPLOAD] To test: Open this URL in a new browser tab to verify the image displays correctly')
        
      } catch (testError) {
        console.error('💥 [IMAGE UPLOAD] Upload verification failed:', testError)
        throw new Error(`Image upload verification failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`)
      }
      
      return publicUrl.publicUrl

    } catch (error) {
      console.error('💥 [IMAGE UPLOAD] Complete failure:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
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

      // Calculate token economics with advanced settings
      const totalSupply = data.tokenData.totalSupply || tokenDefaults.totalSupply
      const creatorSharePercentage = data.tokenData.creatorSharePercentage || 0
      const lockPercentage = data.tokenData.lockPercentage || 0
      const lockDurationDays = data.tokenData.lockDurationDays || 0
      
      const creatorTokensAllocated = Math.floor((totalSupply * creatorSharePercentage) / 100)
      const creatorTokensLocked = Math.floor((creatorTokensAllocated * lockPercentage) / 100)
      const creatorTokensUnlocked = creatorTokensAllocated - creatorTokensLocked
      const bondingCurveTokens = totalSupply - creatorTokensUnlocked // Exclude unlocked creator tokens from bonding curve

      // Create initial bonding curve state
      const initialState = BondingCurveService.createInitialState(new PublicKey(data.mintAddress), totalSupply)
      
      // Calculate prices with debug logging
      const calculatedPrice = BondingCurveService.calculatePrice(initialState)
      const calculatedMarketCap = Math.floor(BondingCurveService.calculateMarketCapSync(initialState, 169))
      
      console.log('💰 [TOKEN CREATION] Price calculations:', {
        tokenName: data.tokenData.name,
        totalSupply: totalSupply,
        initialState: {
          virtualSolReserves: Number(initialState.virtualSolReserves),
          virtualTokenReserves: Number(initialState.virtualTokenReserves),
          tokenTotalSupply: Number(initialState.tokenTotalSupply)
        },
        calculatedPriceSOL: calculatedPrice.toFixed(10),
        calculatedMarketCapUSD: calculatedMarketCap
      })

      // Prepare creation settings
      const creationSettings = {
        totalSupply,
        creatorSharePercentage,
        lockPercentage,
        lockDurationDays,
        prebuyAmount: data.tokenData.prebuyAmount || 0,
        unlockSchedule: data.tokenData.unlockSchedule || 'immediate'
      }

      // Calculate lock dates
      const lockStartDate = lockDurationDays > 0 ? new Date() : null
      const nextUnlockDate = lockStartDate && lockDurationDays > 0 
        ? new Date(lockStartDate.getTime() + lockDurationDays * 24 * 60 * 60 * 1000) 
        : null

      // Prepare token data for database (with advanced fields)
      const tokenInsert: any = {
        mint_address: data.mintAddress,
        name: data.tokenData.name,
        symbol: data.tokenData.symbol,
        description: data.tokenData.description || '',
        image_url: data.imageUrl,
        metadata_uri: data.metadataUri,
        creator_id: userId!,
        total_supply: totalSupply,
        decimals: tokenDefaults.decimals,
        dev_share_percentage: creatorSharePercentage,
        dev_tokens_amount: creatorTokensAllocated,
        lock_duration_days: lockDurationDays > 0 ? lockDurationDays : null,
        locked_tokens_amount: bondingCurveTokens, // Tokens available in bonding curve
        current_price: calculatedPrice, // Store price in SOL (will be converted to USD on retrieval)
        market_cap: calculatedMarketCap, // Store market cap in USD
        volume_24h: 0,
        holders_count: 1,
        status: 'active',
        graduation_threshold: tokenDefaults.graduationThreshold,
        graduated_at: null,
        website: data.tokenData.website || null,
        twitter: data.tokenData.twitter || null,
        telegram: data.tokenData.telegram || null,
        discord: data.tokenData.discord || null,
        last_trade_at: null,
        bonding_curve_progress: 0,
        tags: [],
        is_nsfw: false,
        is_featured: false,
        // New advanced fields
        total_supply_custom: totalSupply,
        creator_share_percentage: creatorSharePercentage,
        creator_tokens_allocated: creatorTokensAllocated,
        creator_tokens_locked: creatorTokensLocked,
        creator_tokens_unlocked: creatorTokensUnlocked,
        lock_percentage: lockPercentage,
        lock_start_date: lockStartDate?.toISOString() || null,
        next_unlock_date: nextUnlockDate?.toISOString() || null,
        prebuy_sol_amount: data.tokenData.prebuyAmount || 0,
        prebuy_tokens_received: 0, // Will be updated after prebuy if applicable
        creation_settings: creationSettings
      }

      console.log('💾 [DATABASE] Preparing to save token with data:', {
        mint_address: tokenInsert.mint_address,
        name: tokenInsert.name,
        symbol: tokenInsert.symbol,
        image_url: tokenInsert.image_url,
        metadata_uri: tokenInsert.metadata_uri,
        creator_id: tokenInsert.creator_id
      })

      // Save token to database
      const { data: savedToken, error } = await supabase
        .from('tokens')
        .insert(tokenInsert)
        .select()
        .single()
      
      if (error) {
        console.error('❌ [DATABASE] Failed to save token to database:', {
          error: error.message,
          details: error
        })
        throw error
      }

      console.log('✅ [DATABASE] Token saved successfully:', {
        id: savedToken.id,
        mint_address: savedToken.mint_address,
        image_url: savedToken.image_url,
        metadata_uri: savedToken.metadata_uri
      })

      // Create token lock records if there are locked tokens
      if (creatorTokensLocked > 0 && lockDurationDays > 0) {
        await this.createTokenLockRecord({
          tokenId: savedToken.id,
          lockedAmount: creatorTokensLocked,
          lockType: 'creator',
          lockDurationDays,
          unlockSchedule: data.tokenData.unlockSchedule || 'immediate'
        })
      }

      // Handle prebuy if requested
      if (data.tokenData.prebuyAmount && data.tokenData.prebuyAmount > 0) {
        await this.handlePrebuy({
          tokenId: savedToken.id,
          mintAddress: data.mintAddress,
          solAmount: data.tokenData.prebuyAmount,
          creatorId: data.creatorId
        })
      }

      console.log('Token saved to database successfully with advanced features')

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
   * Create token lock record for locked tokens
   */
  private async createTokenLockRecord(params: {
    tokenId: string
    lockedAmount: number
    lockType: 'creator' | 'team' | 'liquidity' | 'marketing'
    lockDurationDays: number
    unlockSchedule: string
  }) {
    try {
      const unlockDate = new Date()
      unlockDate.setDate(unlockDate.getDate() + params.lockDurationDays)

      const { error } = await supabase
        .from('token_locks')
        .insert({
          token_id: params.tokenId,
          locked_amount: params.lockedAmount,
          lock_type: params.lockType,
          lock_duration_days: params.lockDurationDays,
          unlock_date: unlockDate.toISOString(),
          status: 'locked'
        })

      if (error) throw error

      // Create unlock schedule entries based on unlock type
      if (params.unlockSchedule === 'linear' && params.lockDurationDays > 30) {
        await this.createLinearUnlockSchedule(params.tokenId, params.lockedAmount, params.lockDurationDays)
      }

      console.log('Token lock record created successfully')
    } catch (error) {
      console.error('Failed to create token lock record:', error)
      // Don't throw as token creation was successful
    }
  }

  /**
   * Create linear unlock schedule for gradual token unlocking
   */
  private async createLinearUnlockSchedule(lockId: string, totalAmount: number, durationDays: number) {
    try {
      const unlockIntervals = Math.min(Math.floor(durationDays / 30), 12) // Monthly unlocks, max 12
      const amountPerUnlock = Math.floor(totalAmount / unlockIntervals)
      
      const unlockSchedule = []
      for (let i = 1; i <= unlockIntervals; i++) {
        const unlockDate = new Date()
        unlockDate.setDate(unlockDate.getDate() + (i * 30)) // Monthly intervals
        
        unlockSchedule.push({
          token_lock_id: lockId,
          unlock_date: unlockDate.toISOString(),
          unlock_percentage: (100 / unlockIntervals),
          unlock_amount: i === unlockIntervals ? totalAmount - (amountPerUnlock * (i - 1)) : amountPerUnlock,
          status: 'pending'
        })
      }

      const { error } = await supabase
        .from('token_unlock_schedule')
        .insert(unlockSchedule)

      if (error) throw error
      console.log('Linear unlock schedule created successfully')
    } catch (error) {
      console.error('Failed to create unlock schedule:', error)
    }
  }

  /**
   * Handle prebuy functionality
   */
  private async handlePrebuy(params: {
    tokenId: string
    mintAddress: string
    solAmount: number
    creatorId: string
  }) {
    try {
      // This would integrate with the trading system to execute the buy
      // For now, just log the intent - actual implementation would require
      // integration with the bonding curve trading logic
      console.log('Prebuy requested:', {
        tokenId: params.tokenId,
        mintAddress: params.mintAddress,
        solAmount: params.solAmount,
        creatorId: params.creatorId
      })

      // Update token record with prebuy info
      const { error } = await supabase
        .from('tokens')
        .update({
          prebuy_tokens_received: Math.floor(params.solAmount * 1000000) // Simplified calculation
        })
        .eq('id', params.tokenId)

      if (error) throw error
      
      console.log('Prebuy setup completed')
    } catch (error) {
      console.error('Failed to handle prebuy:', error)
      // Don't throw as token creation was successful
    }
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