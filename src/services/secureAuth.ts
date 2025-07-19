import { 
  generateAuthChallenge, 
  verifyAuthChallenge, 
  isValidSolanaAddress,
  generateSessionToken 
} from '@/utils/crypto'
import { SupabaseService } from './supabase'
import { supabase } from './supabase'

// Authentication challenge interface
export interface AuthChallenge {
  challenge: string
  timestamp: number
  walletAddress: string
  expiresAt: number
}

// Authentication result interface
export interface AuthResult {
  success: boolean
  user?: any
  session?: any
  error?: string
}

// In-memory challenge storage (in production, use Redis or database)
const pendingChallenges = new Map<string, AuthChallenge>()

/**
 * Secure Authentication Service
 * Implements challenge-response authentication with cryptographic verification
 */
export class SecureAuthService {
  
  /**
   * Generate authentication challenge for wallet
   */
  static generateChallenge(walletAddress: string): AuthChallenge {
    if (!isValidSolanaAddress(walletAddress)) {
      throw new Error('Invalid wallet address format')
    }

    const challenge = generateAuthChallenge()
    const timestamp = Date.now()
    const expiresAt = timestamp + 300000 // 5 minutes

    const authChallenge: AuthChallenge = {
      challenge,
      timestamp,
      walletAddress,
      expiresAt
    }

    // Store challenge for verification
    pendingChallenges.set(walletAddress, authChallenge)
    
    // Clean up expired challenges
    this.cleanupExpiredChallenges()

    console.log(`🔐 Generated auth challenge for ${walletAddress.slice(0, 8)}...`)
    
    return authChallenge
  }

  /**
   * Verify signed challenge and authenticate user
   */
  static async verifyAndAuthenticate(
    walletAddress: string,
    signature: string | Uint8Array,
    challenge: string,
    timestamp: number
  ): Promise<AuthResult> {
    try {
      // Validate inputs
      if (!isValidSolanaAddress(walletAddress)) {
        return { success: false, error: 'Invalid wallet address format' }
      }

      // Check if challenge exists and is valid
      const pendingChallenge = pendingChallenges.get(walletAddress)
      if (!pendingChallenge) {
        return { success: false, error: 'No pending challenge found' }
      }

      if (pendingChallenge.challenge !== challenge) {
        return { success: false, error: 'Invalid challenge' }
      }

      if (pendingChallenge.timestamp !== timestamp) {
        return { success: false, error: 'Timestamp mismatch' }
      }

      // Verify the cryptographic signature
      const verificationResult = verifyAuthChallenge(walletAddress, signature, challenge, timestamp)
      
      if (!verificationResult.valid) {
        console.error(`❌ Signature verification failed: ${verificationResult.reason}`)
        return { success: false, error: verificationResult.reason || 'Signature verification failed' }
      }

      // Remove the used challenge to prevent replay attacks
      pendingChallenges.delete(walletAddress)

      console.log(`✅ Signature verified for ${walletAddress.slice(0, 8)}...`)

      // Create or get user profile
      const authResult = await this.createSecureSession(walletAddress)
      
      return authResult

    } catch (error) {
      console.error('Authentication error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Authentication failed' 
      }
    }
  }

  /**
   * Create secure authenticated session
   */
  private static async createSecureSession(walletAddress: string): Promise<AuthResult> {
    try {
      // Check if user exists in our database
      const existingUser = await SupabaseService.getUserByWallet(walletAddress)
      
      if (existingUser) {
        // Existing user - create session with their ID
        console.log(`🔄 Creating session for existing user: ${existingUser.id}`)
        
        const { data, error } = await supabase.auth.signUp({
          email: `${walletAddress}@verified.wallet`,
          password: generateSessionToken(),
          options: {
            data: {
              wallet_address: walletAddress,
              username: existingUser.username,
              verified: true // Mark as cryptographically verified
            }
          }
        })

        if (error) {
          console.error('Failed to create secure session:', error)
          return { success: false, error: 'Failed to create session' }
        }

        // Update the user record to match the new auth user ID if needed
        if (data.user && data.user.id !== existingUser.id) {
          console.log(`🔗 Linking auth user ${data.user.id} to existing profile ${existingUser.id}`)
          
          // Use our migration function to transfer data to the new auth user
          const { error: migrateError } = await supabase.rpc('migrate_single_user', {
            old_user_id_param: existingUser.id,
            new_user_id_param: data.user.id
          })

          if (migrateError) {
            console.error('Migration failed:', migrateError)
            // Sign out the created user to prevent inconsistent state
            await supabase.auth.signOut()
            return { success: false, error: 'Failed to link user accounts' }
          }
        }

        const finalUser = data.user ? {
          ...data.user,
          ...existingUser,
          id: data.user.id
        } : existingUser

        return {
          success: true,
          user: finalUser,
          session: data.session
        }

      } else {
        // New user - create profile
        console.log(`🆕 Creating new user profile for ${walletAddress.slice(0, 8)}...`)
        
        const { data, error } = await supabase.auth.signUp({
          email: `${walletAddress}@verified.wallet`,
          password: generateSessionToken(),
          options: {
            data: {
              wallet_address: walletAddress,
              username: `user_${walletAddress.slice(0, 6)}`,
              verified: true // Mark as cryptographically verified
            }
          }
        })

        if (error || !data.user) {
          console.error('Failed to create new user:', error)
          return { success: false, error: 'Failed to create user account' }
        }

        // Create user profile in our database
        const newUserProfile = await SupabaseService.upsertUser({
          id: data.user.id,
          wallet_address: walletAddress,
          username: `user_${walletAddress.slice(0, 6)}`,
          is_verified: true, // Mark as verified since they passed crypto verification
          total_volume_traded: 0,
          tokens_created: 0,
          reputation_score: 0
        })

        const finalUser = {
          ...data.user,
          ...newUserProfile
        }

        return {
          success: true,
          user: finalUser,
          session: data.session
        }
      }

    } catch (error) {
      console.error('Error creating secure session:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Session creation failed' 
      }
    }
  }

  /**
   * Clean up expired challenges
   */
  private static cleanupExpiredChallenges(): void {
    const now = Date.now()
    for (const [walletAddress, challenge] of pendingChallenges.entries()) {
      if (challenge.expiresAt < now) {
        pendingChallenges.delete(walletAddress)
      }
    }
  }

  /**
   * Get pending challenge for wallet (for debugging)
   */
  static getPendingChallenge(walletAddress: string): AuthChallenge | undefined {
    return pendingChallenges.get(walletAddress)
  }

  /**
   * Clear all pending challenges (for testing)
   */
  static clearAllChallenges(): void {
    pendingChallenges.clear()
  }
} 