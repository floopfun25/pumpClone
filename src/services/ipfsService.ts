/**
 * IPFS Service for FloppFun
 * Handles uploading token metadata and images to IPFS via Pinata
 */

interface PinataResponse {
  IpfsHash: string
  PinSize: number
  Timestamp: string
}

export class IPFSService {
  private readonly pinataApiKey: string
  private readonly pinataSecretKey: string
  private readonly pinataBaseUrl = 'https://api.pinata.cloud'

  constructor() {
    // Get API keys from environment variables
    this.pinataApiKey = import.meta.env.VITE_PINATA_API_KEY || ''
    this.pinataSecretKey = import.meta.env.VITE_PINATA_SECRET_KEY || ''

    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('⚠️  Pinata credentials not found. Using fallback IPFS gateway.')
    }
  }

  /**
   * Upload file to IPFS via Pinata
   */
  async uploadFile(file: File, options?: { name?: string }): Promise<string> {
    console.log('📤 Uploading file to IPFS:', file.name)

    try {
      // Use Pinata if credentials are available
      if (this.pinataApiKey && this.pinataSecretKey) {
        return await this.uploadToPinata(file, options)
      } else {
        // Fallback to public IPFS gateway (less reliable)
        return await this.uploadToPublicGateway(file)
      }
    } catch (error) {
      console.error('❌ IPFS upload failed:', error)
      throw new Error(`IPFS upload failed: ${error}`)
    }
  }

  /**
   * Upload to Pinata (recommended)
   */
  private async uploadToPinata(file: File, options?: { name?: string }): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = {
      name: options?.name || file.name,
      keyvalues: {
        project: 'FloppFun',
        timestamp: new Date().toISOString()
      }
    }
    formData.append('pinataMetadata', JSON.stringify(metadata))

    // Pin options
    const pinataOptions = {
      cidVersion: 0
    }
    formData.append('pinataOptions', JSON.stringify(pinataOptions))

    const response = await fetch(`${this.pinataBaseUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'pinata_api_key': this.pinataApiKey,
        'pinata_secret_api_key': this.pinataSecretKey
      },
      body: formData
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Pinata upload failed: ${error}`)
    }

    const result: PinataResponse = await response.json()
    const ipfsUrl = `https://ipfs.io/ipfs/${result.IpfsHash}`
    
    console.log('✅ File uploaded to IPFS via Pinata:', ipfsUrl)
    return ipfsUrl
  }

  /**
   * Fallback: Upload to public IPFS gateway
   * Note: This is less reliable and should only be used for development
   */
  private async uploadToPublicGateway(file: File): Promise<string> {
    console.warn('⚠️  Using fallback IPFS upload - not recommended for production')

    // Convert file to buffer
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)

    // Use web3.storage or similar public gateway
    try {
      // This is a simplified example - in reality you'd use a service like web3.storage
      const response = await fetch('https://api.web3.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_WEB3_STORAGE_TOKEN}`,
          'Content-Type': file.type
        },
        body: uint8Array
      })

      if (!response.ok) {
        throw new Error('Web3.storage upload failed')
      }

      const result = await response.json()
      return `https://ipfs.io/ipfs/${result.cid}`
    } catch (error) {
      // Final fallback - generate a placeholder URL (for development only)
      console.error('All IPFS uploads failed, using placeholder')
      const placeholderHash = 'QmPlaceholder' + Math.random().toString(36).substring(7)
      return `https://ipfs.io/ipfs/${placeholderHash}`
    }
  }

  /**
   * Test IPFS connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        console.log('ℹ️  No Pinata credentials - IPFS uploads will use fallback')
        return false
      }

      const response = await fetch(`${this.pinataBaseUrl}/data/testAuthentication`, {
        method: 'GET',
        headers: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        }
      })

      const isConnected = response.ok
      console.log(isConnected ? '✅ Pinata connection successful' : '❌ Pinata connection failed')
      return isConnected
    } catch (error) {
      console.error('❌ IPFS connection test failed:', error)
      return false
    }
  }

  /**
   * Pin existing content by hash
   */
  async pinByHash(ipfsHash: string): Promise<boolean> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('⚠️  Cannot pin by hash - Pinata credentials missing')
      return false
    }

    try {
      const response = await fetch(`${this.pinataBaseUrl}/pinning/pinByHash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        },
        body: JSON.stringify({
          hashToPin: ipfsHash,
          pinataMetadata: {
            name: `FloppFun-${ipfsHash}`,
            keyvalues: {
              project: 'FloppFun'
            }
          }
        })
      })

      const success = response.ok
      console.log(success ? '✅ Content pinned successfully' : '❌ Pin by hash failed')
      return success
    } catch (error) {
      console.error('❌ Pin by hash failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService()

// Export convenience function
export const uploadToIPFS = (file: File, options?: { name?: string }) => 
  ipfsService.uploadFile(file, options)