import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useWalletStore } from './wallet'
import { SupabaseService, SupabaseAuth } from '@/services/supabase'

// User interface for type safety
export interface User {
  id: string
  wallet_address: string
  username?: string
  avatar_url?: string
  bio?: string
  created_at: string
  total_volume_traded: number
  tokens_created: number
  reputation_score: number
}

// Auth store for managing user authentication with Supabase integration
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const supabaseUser = ref<any>(null)
  const supabaseSession = ref<any>(null)
  let isInitializing = false // Add a flag to prevent race conditions

  // Initialize wallet store reference
  const walletStore = useWalletStore()

  // Watch for wallet connection changes
  watch(
    () => ({ 
      connected: walletStore.isConnected, 
      address: walletStore.walletAddress 
    }),
    async (newWallet, oldWallet) => {
      // If wallet disconnected, clear auth
      if (!newWallet.connected) {
        await signOut()
        return
      }

      // If wallet connected or address changed, try to initialize user
      if (newWallet.connected && 
          (!oldWallet?.connected || newWallet.address !== oldWallet?.address)) {
        try {
          await initializeUser()
        } catch (error) {
          console.error('Failed to initialize user after wallet change:', error)
        }
      }
    },
    { immediate: false }
  )

  /**
   * Initialize user session
   * Called on app startup to restore user session
   */
  const initializeUser = async () => {
    try {
      isLoading.value = true
      
      // If wallet is not connected, clear auth state and return
      if (!walletStore.isConnected || !walletStore.walletAddress) {
        user.value = null
        isAuthenticated.value = false
        return
      }

      // If already authenticated with the same wallet, no need to reinitialize
      if (isAuthenticated.value && user.value?.wallet_address === walletStore.walletAddress) {
        return
      }

      // Prevent re-entrant calls to avoid race conditions
      if (isInitializing) {
        console.log('Auth: Initialization already in progress, skipping.');
        return;
      }

      console.log('Auth: Starting user initialization...')
      isInitializing = true

      // Check for existing Supabase session
      const session = await SupabaseAuth.getSession()
      if (session?.user) {
        // Restore user from existing session
        const sessionWalletAddress = SupabaseAuth.getWalletAddressFromUser(session.user)
        if (sessionWalletAddress === walletStore.walletAddress) {
          const existingUser = await SupabaseService.getUserByWallet(sessionWalletAddress)
          if (existingUser) {
            user.value = existingUser
            isAuthenticated.value = true
            supabaseUser.value = session.user
            supabaseSession.value = session
            console.log('Auth: User restored from session')
            return
          }
        }
      }

      // If no valid session, try to get user by wallet address
      const existingUser = await SupabaseService.getUserByWallet(walletStore.walletAddress)
      if (existingUser) {
        // Sign in with wallet to create session
        await signInWithWallet(walletStore.walletAddress)
        console.log('Auth: User signed in during initialization')
      }
    } catch (error) {
      console.error('Failed to initialize user:', error)
      // Don't throw error, just clear auth state
      user.value = null
      isAuthenticated.value = false
    } finally {
      isLoading.value = false
      isInitializing = false
      console.log('Auth: User initialization finished.');
    }
  }

  /**
   * Sign in with wallet using secure challenge-response authentication
   * Creates cryptographically verified Supabase auth session and user profile
   */
  const signInWithWallet = async (walletAddress: string) => {
    const walletStore = useWalletStore()
    
    try {
      console.log('🔐 Starting secure wallet authentication...')
      
      // Step 1: Generate authentication challenge
      const { SecureAuthService } = await import('@/services/secureAuth')
      const challenge = SecureAuthService.generateChallenge(walletAddress)
      
      console.log('📝 Please sign the authentication message in your wallet...')
      
      // Step 2: Request user to sign the challenge
      const signature = await walletStore.signAuthChallenge(
        walletAddress, 
        challenge.challenge, 
        challenge.timestamp
      )
      
      console.log('✍️ Signature received, verifying...')
      
      // Step 3: Verify signature and authenticate
      const authResult = await SecureAuthService.verifyAndAuthenticate(
        walletAddress,
        signature,
        challenge.challenge,
        challenge.timestamp
      )
      
      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed')
      }
      
      if (authResult.user) {
        user.value = authResult.user
        isAuthenticated.value = true
        supabaseUser.value = authResult.user
        supabaseSession.value = authResult.session
        
        console.log('✅ Secure authentication completed!')
        return authResult.user
      }
      
      throw new Error('Authentication completed but no user data returned')
      
    } catch (error) {
      console.error('❌ Secure wallet authentication failed:', error)
      
      // Clear any partial auth state
      user.value = null
      isAuthenticated.value = false
      supabaseUser.value = null
      supabaseSession.value = null
      
      throw error
    }
  }

  /**
   * Sign out user
   * Clears user session and Supabase authentication
   */
  async function signOut() {
    try {
      // Sign out from Supabase auth
      await SupabaseAuth.signOut()
      
      // Clear local state
      user.value = null
      isAuthenticated.value = false
      supabaseUser.value = null
      supabaseSession.value = null
      
      console.log('Auth: User signed out')
    } catch (error) {
      console.error('Failed to sign out:', error)
      // Clear local state even if Supabase sign out fails
      user.value = null
      isAuthenticated.value = false
      supabaseUser.value = null
      supabaseSession.value = null
    }
  }

  /**
   * Update user profile
   * Updates user information in database
   */
  async function updateProfile(updates: Partial<User>) {
    try {
      if (!user.value) throw new Error('No user logged in')
      
      isLoading.value = true
      
      // Update user profile in Supabase
      const updatedUser = await SupabaseService.upsertUser({
        ...user.value,
        ...updates
      })
      
      if (updatedUser) {
        // Update local user state
        user.value = updatedUser
        console.log('Auth: User profile updated:', updates)
      }
      
    } catch (error) {
      console.error('Failed to update profile:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Setup auth state listener
   * Listens to Supabase auth state changes
   */
  function setupAuthListener() {
    return SupabaseAuth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        supabaseSession.value = session
        supabaseUser.value = session.user
        
        // Load user profile if wallet address is available
        const walletAddress = session.user.user_metadata?.wallet_address
        if (walletAddress && !user.value) {
          const existingUser = await SupabaseService.getUserByWallet(walletAddress)
          if (existingUser) {
            user.value = existingUser
            isAuthenticated.value = true
          }
        }
      } else if (event === 'SIGNED_OUT') {
        supabaseSession.value = null
        supabaseUser.value = null
        user.value = null
        isAuthenticated.value = false
      }
    })
  }

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    supabaseUser,
    supabaseSession,
    
    // Actions
    initializeUser,
    signInWithWallet,
    signOut,
    updateProfile,
    setupAuthListener
  }
}) 