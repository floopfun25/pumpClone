import { supabase } from './supabase'
import { tokenService } from './tokenService'

export interface TokenMetadata {
  mint: string
  name: string
  symbol: string
  description: string
  image: string | null
  website?: string
  twitter?: string
  telegram?: string
  discord?: string
  verified: boolean
  source: 'database' | 'jupiter' | 'birdeye' | 'fallback'
}

class TokenMetadataService {
  private metadataCache = new Map<string, TokenMetadata>()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get token metadata from multiple sources with fallbacks
   */
  async getTokenMetadata(mintAddress: string): Promise<TokenMetadata> {
    // Check cache first
    const cacheKey = `metadata_${mintAddress}`
    const cached = this.metadataCache.get(cacheKey)
    
    if (cached) {
      return cached
    }

    try {
      // 1. Try to get from database first (our platform tokens)
      const dbMetadata = await this.getMetadataFromDatabase(mintAddress)
      if (dbMetadata) {
        this.metadataCache.set(cacheKey, dbMetadata)
        return dbMetadata
      }

      // 2. Try Jupiter Token Registry
      const jupiterMetadata = await this.getMetadataFromJupiter(mintAddress)
      if (jupiterMetadata) {
        this.metadataCache.set(cacheKey, jupiterMetadata)
        return jupiterMetadata
      }

      // 3. Try to get from on-chain metadata URI
      const onChainMetadata = await this.getMetadataFromOnChain(mintAddress)
      if (onChainMetadata) {
        this.metadataCache.set(cacheKey, onChainMetadata)
        return onChainMetadata
      }

      // 4. Fallback to basic info
      const fallbackMetadata = this.createFallbackMetadata(mintAddress)
      this.metadataCache.set(cacheKey, fallbackMetadata)
      return fallbackMetadata

    } catch (error) {
      console.warn('Error fetching token metadata:', error)
      const fallbackMetadata = this.createFallbackMetadata(mintAddress)
      this.metadataCache.set(cacheKey, fallbackMetadata)
      return fallbackMetadata
    }
  }

  /**
   * Get metadata from our database (for platform-created tokens)
   */
  private async getMetadataFromDatabase(mintAddress: string): Promise<TokenMetadata | null> {
    try {
      const { data: token, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .single()

      if (error) {
        console.log(`Database query error for ${mintAddress}:`, error)
        return null
      }

      if (!token) {
        console.log(`No token found in database for ${mintAddress}`)
        return null
      }

      console.log(`Found token in database for ${mintAddress}:`, {
        name: token.name,
        symbol: token.symbol,
        image_url: token.image_url,
        metadata_uri: token.metadata_uri
      })

      return {
        mint: mintAddress,
        name: token.name || 'Unknown Token',
        symbol: token.symbol || 'UNKNOWN',
        description: token.description || '',
        image: token.image_url || null,
        website: token.website || undefined,
        twitter: token.twitter || undefined,
        telegram: token.telegram || undefined,
        discord: token.discord || undefined,
        verified: true, // Platform tokens are verified
        source: 'database'
      }
    } catch (error) {
      console.warn('Failed to get metadata from database:', error)
      return null
    }
  }

  /**
   * Get metadata from Jupiter Token Registry
   */
  private async getMetadataFromJupiter(mintAddress: string): Promise<TokenMetadata | null> {
    try {
      const response = await fetch(`https://tokens.jup.ag/token/${mintAddress}`)
      
      if (!response.ok) {
        return null
      }

      const data = await response.json()

      return {
        mint: mintAddress,
        name: data.name || 'Unknown Token',
        symbol: data.symbol || 'UNKNOWN',
        description: data.description || '',
        image: data.logoURI || null,
        website: data.website || undefined,
        twitter: data.twitter || undefined,
        verified: data.verified || false,
        source: 'jupiter'
      }
    } catch (error) {
      console.warn('Failed to get metadata from Jupiter:', error)
      return null
    }
  }

  /**
   * Get metadata from on-chain URI (for tokens with metadata programs)
   */
  private async getMetadataFromOnChain(mintAddress: string): Promise<TokenMetadata | null> {
    try {
      // This would typically involve calling the token metadata program
      // For now, we'll check if we have a metadata URI stored anywhere
      const { data: token } = await supabase
        .from('tokens')
        .select('metadata_uri')
        .eq('mint_address', mintAddress)
        .single()

      if (token?.metadata_uri) {
        const metadata = await tokenService.getTokenMetadata(token.metadata_uri)
        
        return {
          mint: mintAddress,
          name: metadata.name || 'Unknown Token',
          symbol: metadata.symbol || 'UNKNOWN',
          description: metadata.description || '',
          image: metadata.image || null,
          website: metadata.external_url || undefined,
          verified: false,
          source: 'database'
        }
      }

      return null
    } catch (error) {
      console.warn('Failed to get on-chain metadata:', error)
      return null
    }
  }

  /**
   * Create fallback metadata for unknown tokens
   */
  private createFallbackMetadata(mintAddress: string): TokenMetadata {
    return {
      mint: mintAddress,
      name: 'Unknown Token',
      symbol: 'UNKNOWN',
      description: 'Token information not available',
      image: null,
      verified: false,
      source: 'fallback'
    }
  }

  /**
   * Batch get metadata for multiple tokens
   */
  async getBatchTokenMetadata(mintAddresses: string[]): Promise<TokenMetadata[]> {
    const results = await Promise.allSettled(
      mintAddresses.map(mint => this.getTokenMetadata(mint))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return this.createFallbackMetadata(mintAddresses[index])
      }
    })
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear()
  }

  /**
   * Get cached metadata if available
   */
  getCachedMetadata(mintAddress: string): TokenMetadata | null {
    return this.metadataCache.get(`metadata_${mintAddress}`) || null
  }
}

export const tokenMetadataService = new TokenMetadataService()
export default tokenMetadataService 