/**
 * Token Metadata Service
 * Fetches and caches token metadata
 */

import { getTokenByMintAddress } from './backendApi';

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  image?: string;
  description?: string;
  creator?: string;
  verified?: boolean;
  source?: string;
}

class TokenMetadataService {
  private cache: Map<string, TokenMetadata> = new Map();

  /**
   * Get token metadata from backend database
   */
  async getTokenMetadata(mint: string): Promise<TokenMetadata | null> {
    try {
      // Check cache first
      if (this.cache.has(mint)) {
        return this.cache.get(mint)!;
      }

      console.log(`🔍 [METADATA] Fetching metadata for mint: ${mint}`);

      // Fetch from backend database
      const tokenData = await getTokenByMintAddress(mint);

      if (!tokenData) {
        console.log(`⚠️ [METADATA] Token not found in database: ${mint}`);
        return null;
      }

      // Convert backend DTO to TokenMetadata
      const metadata: TokenMetadata = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        decimals: 6, // Your tokens use 6 decimals
        image: tokenData.image_url,
        description: tokenData.description,
        creator: tokenData.creator?.wallet_address,
        verified: false,
        source: 'database',
      };

      // Cache it
      this.cache.set(mint, metadata);

      console.log(`✅ [METADATA] Loaded metadata for ${metadata.name} (${metadata.symbol})`);

      return metadata;
    } catch (error) {
      console.error('❌ [METADATA] Error fetching token metadata:', error);
      return null;
    }
  }

  /**
   * Cache token metadata
   */
  cacheMetadata(mint: string, metadata: TokenMetadata): void {
    this.cache.set(mint, metadata);
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const tokenMetadataService = new TokenMetadataService();
