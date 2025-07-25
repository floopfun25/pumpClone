import { PublicKey } from '@solana/web3.js'
import * as bs58 from 'bs58'
import * as nacl from 'tweetnacl'

/**
 * Generate a secure random nonce for challenge-response authentication
 */
export function generateAuthChallenge(): string {
  const nonce = new Uint8Array(32)
  crypto.getRandomValues(nonce)
  return bs58.encode(nonce)
}

/**
 * Create authentication message for signing
 */
export function createAuthMessage(walletAddress: string, challenge: string, timestamp: number): string {
  return `FloppFun Authentication\n\nWallet: ${walletAddress}\nChallenge: ${challenge}\nTimestamp: ${timestamp}\n\nSign this message to prove ownership of your wallet.`
}

/**
 * Verify a signed message from a Solana wallet
 */
export function verifyWalletSignature(
  walletAddress: string,
  signature: string | Uint8Array,
  message: string
): boolean {
  try {
    // Convert wallet address to PublicKey
    const publicKey = new PublicKey(walletAddress)
    
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message)
    
    // Convert signature to bytes if it's a string
    const signatureBytes = typeof signature === 'string' 
      ? bs58.decode(signature)
      : signature
    
    // Verify the signature
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    )
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

/**
 * Verify authentication challenge
 */
export function verifyAuthChallenge(
  walletAddress: string,
  signature: string | Uint8Array,
  challenge: string,
  timestamp: number,
  maxAge: number = 300000 // 5 minutes default
): { valid: boolean; reason?: string } {
  // Check timestamp validity (prevent replay attacks)
  const now = Date.now()
  if (now - timestamp > maxAge) {
    return { valid: false, reason: 'Challenge expired' }
  }
  
  if (timestamp > now + 60000) { // Allow 1 minute clock skew
    return { valid: false, reason: 'Invalid timestamp' }
  }
  
  // Create the authentication message
  const message = createAuthMessage(walletAddress, challenge, timestamp)
  
  // Verify the signature
  const signatureValid = verifyWalletSignature(walletAddress, signature, message)
  
  if (!signatureValid) {
    return { valid: false, reason: 'Invalid signature' }
  }
  
  return { valid: true }
}

/**
 * Generate a session token from verified authentication
 * @deprecated This is not a secure JWT and should be replaced with a proper implementation.
 * It does not contain user information and is just a random string.
 * A real implementation should use a library like 'jsonwebtoken' and sign it with a secret.
 * Example:
 * import jwt from 'jsonwebtoken';
 * const payload = { sub: userId, aud: 'authenticated', ...otherClaims };
 * const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET);
 */
export function generateSessionToken(): string {
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  return bs58.encode(tokenBytes)
}

/**
 * Validate wallet address format
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
} 