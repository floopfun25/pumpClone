import {
  generateAuthChallenge,
  verifyAuthChallenge,
  isValidSolanaAddress,
} from "@/utils/crypto";
import { SupabaseService } from "./supabase";
import { supabase } from "./supabase";

// Authentication challenge interface
export interface AuthChallenge {
  challenge: string;
  timestamp: number;
  walletAddress: string;
  expiresAt: number;
}

// Authentication result interface
export interface AuthResult {
  success: boolean;
  user?: any;
  session?: any;
  error?: string;
}

// In-memory challenge storage (in production, use Redis or database)
const pendingChallenges = new Map<string, AuthChallenge>();

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
      throw new Error("Invalid wallet address format");
    }

    const challenge = generateAuthChallenge();
    const timestamp = Date.now();
    const expiresAt = timestamp + 300000; // 5 minutes

    const authChallenge: AuthChallenge = {
      challenge,
      timestamp,
      walletAddress,
      expiresAt,
    };

    // Store challenge for verification
    pendingChallenges.set(walletAddress, authChallenge);

    // Clean up expired challenges
    this.cleanupExpiredChallenges();

    // ...existing code...

    return authChallenge;
  }

  /**
   * Verify signed challenge and authenticate user
   */
  static async verifyAndAuthenticate(
    walletAddress: string,
    signature: string | Uint8Array,
    challenge: string,
    timestamp: number,
  ): Promise<AuthResult> {
    try {
      // Validate inputs
      if (!isValidSolanaAddress(walletAddress)) {
        return { success: false, error: "Invalid wallet address format" };
      }

      // Check if challenge exists and is valid
      const pendingChallenge = pendingChallenges.get(walletAddress);
      if (!pendingChallenge) {
        return { success: false, error: "No pending challenge found" };
      }

      if (pendingChallenge.challenge !== challenge) {
        return { success: false, error: "Invalid challenge" };
      }

      if (pendingChallenge.timestamp !== timestamp) {
        return { success: false, error: "Timestamp mismatch" };
      }

      // Verify the cryptographic signature
      const verificationResult = verifyAuthChallenge(
        walletAddress,
        signature,
        challenge,
        timestamp,
      );

      if (!verificationResult.valid) {
        // ...existing code...
        return {
          success: false,
          error: verificationResult.reason || "Signature verification failed",
        };
      }

      // Remove the used challenge to prevent replay attacks
      pendingChallenges.delete(walletAddress);

      // ...existing code...

      // Create or get user profile
      const authResult = await this.createSecureSession(walletAddress);

      return authResult;
    } catch (error) {
      // ...existing code...
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Create secure authenticated session using anonymous auth
   */
  private static async createSecureSession(
    walletAddress: string,
  ): Promise<AuthResult> {
    try {
      // Check if user exists in our database
      const existingUser = await SupabaseService.getUserByWallet(walletAddress);

      // Check current session
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        // ...existing code...
      }

      if (existingUser) {
        // Existing user - check if current session matches
        // ...existing code...

        // If current session belongs to this user, we're done
        if (currentSession && currentSession.user?.id === existingUser.id) {
          // ...existing code...
          return {
            success: true,
            user: { ...currentSession.user, ...existingUser },
            session: currentSession,
          };
        }

        // Clear any mismatched session
        if (currentSession) {
          // ...existing code...
          await supabase.auth.signOut();
        }

        // Create new anonymous session
        // ...existing code...
        const { data: anonData, error: anonError } =
          await supabase.auth.signInAnonymously({
            options: {
              data: {
                wallet_address: walletAddress,
                verified: true, // Mark as cryptographically verified
              },
            },
          });

        if (anonError || !anonData.user) {
          // ...existing code...
          return {
            success: false,
            error: "Failed to create anonymous session",
          };
        }

        // Migrate existing profile to new auth user
        console.log(
          `🔗 Migrating existing profile ${existingUser.id} to new auth user ${anonData.user.id}`,
        );
        const { error: migrateError } = await supabase.rpc(
          "migrate_single_user",
          {
            old_user_id_param: existingUser.id,
            new_user_id_param: anonData.user.id,
          },
        );

        if (migrateError) {
          console.error("Migration failed:", migrateError);
          await supabase.auth.signOut();
          return { success: false, error: "Failed to link user accounts" };
        }

        // Get final session after migration
        const {
          data: { session: finalSession },
        } = await supabase.auth.getSession();
        if (!finalSession) {
          return {
            success: false,
            error: "Failed to get session after migration",
          };
        }

        const finalUser = {
          ...finalSession.user,
          ...existingUser,
          id: finalSession.user.id,
          verified: true,
        };

        console.log(
          `✅ Successfully migrated profile for ${walletAddress.slice(0, 8)}...`,
        );
        return {
          success: true,
          user: finalUser,
          session: finalSession,
        };
      } else {
        // New user - create profile
        console.log(
          `🆕 Creating new user profile for ${walletAddress.slice(0, 8)}...`,
        );

        // Clear any existing session
        if (currentSession) {
          console.log(
            "🚪 Clearing pre-existing session before new user login.",
          );
          await supabase.auth.signOut();
        }

        // Create anonymous auth session
        const { data: anonData, error: anonError } =
          await supabase.auth.signInAnonymously({
            options: {
              data: {
                wallet_address: walletAddress,
                verified: true, // Mark as cryptographically verified
              },
            },
          });

        if (anonError || !anonData.user) {
          console.error("Failed to create anonymous session:", anonError);
          return {
            success: false,
            error: "Failed to create anonymous session",
          };
        }

        // Create user profile in our database
        console.log(
          `✅ Anonymous auth successful. Creating profile for new user: ${anonData.user.id}`,
        );
        const newUserProfile = await SupabaseService.upsertUser({
          id: anonData.user.id,
          wallet_address: walletAddress,
          username: `user_${walletAddress.slice(0, 6)}`,
          is_verified: true, // Mark as verified since they passed crypto verification
          total_volume_traded: 0,
          tokens_created: 0,
          reputation_score: 0,
        });

        const finalUser = {
          ...anonData.user,
          ...newUserProfile,
        };

        return {
          success: true,
          user: finalUser,
          session: anonData.session,
        };
      }
    } catch (error) {
      console.error("Error creating secure session:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Session creation failed",
      };
    }
  }

  /**
   * Clean up expired challenges
   */
  private static cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [walletAddress, challenge] of pendingChallenges.entries()) {
      if (challenge.expiresAt < now) {
        pendingChallenges.delete(walletAddress);
      }
    }
  }

  /**
   * Get pending challenge for wallet (for debugging)
   */
  static getPendingChallenge(walletAddress: string): AuthChallenge | undefined {
    return pendingChallenges.get(walletAddress);
  }

  /**
   * Clear all pending challenges (for testing)
   */
  static clearAllChallenges(): void {
    pendingChallenges.clear();
  }
}
