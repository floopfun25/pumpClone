/**
 * IPFS Service for FloppFun
 * Handles uploading token metadata and images to IPFS via Pinata
 */

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export class IPFSService {
  private readonly pinataApiKey: string;
  private readonly pinataSecretKey: string;
  private readonly pinataBaseUrl = "https://api.pinata.cloud";

  constructor() {
    // Get API keys from environment variables
    this.pinataApiKey = import.meta.env.VITE_PINATA_API_KEY || "";
    this.pinataSecretKey = import.meta.env.VITE_PINATA_SECRET_KEY || "";

    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn(
        "⚠️  Pinata credentials not found. Using fallback IPFS gateway.",
      );
    }
  }

  /**
   * Upload file to IPFS via Pinata
   *
   * NOTE: Currently using MOCK MODE for testing without real Pinata credentials.
   * To enable real IPFS uploads, add valid Pinata API keys to .env file.
   */
  async uploadFile(file: File, options?: { name?: string }): Promise<string> {
    console.log("📤 Uploading file to IPFS:", file.name);

    try {
      // Check if we have valid Pinata credentials
      if (this.pinataApiKey && this.pinataSecretKey && !this.pinataApiKey.includes('your_') && !this.pinataApiKey.includes('test')) {
        console.log("Using real Pinata upload");
        return await this.uploadToPinata(file, options);
      } else {
        // MOCK MODE: Generate fake IPFS hash for testing
        console.warn("⚠️  MOCK MODE: Using fake IPFS hash - no real upload happening. Add real Pinata API keys to enable actual IPFS uploads.");
        const mockHash = "Qm" + this.generateMockHash();
        const ipfsUrl = `https://ipfs.io/ipfs/${mockHash}`;
        console.log("Mock IPFS URL generated:", ipfsUrl);
        return ipfsUrl;
      }
    } catch (error) {
      console.error("❌ IPFS upload failed:", error);
      throw new Error(`IPFS upload failed: ${error}`);
    }
  }

  /**
   * Generate a mock IPFS hash for testing
   */
  private generateMockHash(): string {
    return Date.now().toString(16) + Math.random().toString(16).substring(2, 10);
  }

  /**
   * Upload to Pinata (recommended)
   */
  private async uploadToPinata(
    file: File,
    options?: { name?: string },
  ): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    // Add metadata
    const metadata = {
      name: options?.name || file.name,
      keyvalues: {
        project: "FloppFun",
        timestamp: new Date().toISOString(),
      },
    };
    formData.append("pinataMetadata", JSON.stringify(metadata));

    // Pin options
    const pinataOptions = {
      cidVersion: 0,
    };
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await fetch(
      `${this.pinataBaseUrl}/pinning/pinFileToIPFS`,
      {
        method: "POST",
        headers: {
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataSecretKey,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${error}`);
    }

    const result: PinataResponse = await response.json();
    // Use Pinata's dedicated gateway for better reliability
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;

    console.log("✅ File uploaded to IPFS via Pinata:", ipfsUrl);
    return ipfsUrl;
  }

  /**
   * Fallback: Upload to public IPFS gateway
   * Note: This is less reliable and should only be used for development
   */
  private async uploadToPublicGateway(file: File): Promise<string> {
    console.warn(
      "⚠️  Using fallback IPFS upload - not recommended for production",
    );

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    // Use web3.storage or similar public gateway
    try {
      // This is a simplified example - in reality you'd use a service like web3.storage
      const response = await fetch("https://api.web3.storage/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_WEB3_STORAGE_TOKEN}`,
          "Content-Type": file.type,
        },
        body: uint8Array,
      });

      if (!response.ok) {
        throw new Error("Web3.storage upload failed");
      }

      const result = await response.json();
      return `https://ipfs.io/ipfs/${result.cid}`;
    } catch (error) {
      // PRODUCTION: All IPFS uploads failed - this is critical for production
      console.error("❌ CRITICAL: All IPFS uploads failed - cannot create token without metadata");
      throw new Error(
        "IPFS upload failed: Unable to store token metadata. Please configure IPFS credentials or try again later."
      );
    }
  }

  /**
   * Test IPFS connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pinataApiKey || !this.pinataSecretKey) {
        console.log(
          "ℹ️  No Pinata credentials - IPFS uploads will use fallback",
        );
        return false;
      }

      const response = await fetch(
        `${this.pinataBaseUrl}/data/testAuthentication`,
        {
          method: "GET",
          headers: {
            pinata_api_key: this.pinataApiKey,
            pinata_secret_api_key: this.pinataSecretKey,
          },
        },
      );

      const isConnected = response.ok;
      console.log(
        isConnected
          ? "✅ Pinata connection successful"
          : "❌ Pinata connection failed",
      );
      return isConnected;
    } catch (error) {
      console.error("❌ IPFS connection test failed:", error);
      return false;
    }
  }

  /**
   * Pin existing content by hash
   */
  async pinByHash(ipfsHash: string): Promise<boolean> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn("⚠️  Cannot pin by hash - Pinata credentials missing");
      return false;
    }

    try {
      const response = await fetch(`${this.pinataBaseUrl}/pinning/pinByHash`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataSecretKey,
        },
        body: JSON.stringify({
          hashToPin: ipfsHash,
          pinataMetadata: {
            name: `FloppFun-${ipfsHash}`,
            keyvalues: {
              project: "FloppFun",
            },
          },
        }),
      });

      const success = response.ok;
      console.log(
        success ? "✅ Content pinned successfully" : "❌ Pin by hash failed",
      );
      return success;
    } catch (error) {
      console.error("❌ Pin by hash failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();

// Export convenience function
export const uploadToIPFS = (file: File, options?: { name?: string }) =>
  ipfsService.uploadFile(file, options);
