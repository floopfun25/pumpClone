import { defineStore } from 'pinia'
import { ref } from 'vue'
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

  /**
   * Initialize user session
   * Called on app startup to restore user session
   */
  async function initializeUser() {
    try {
      isLoading.value = true
      
      console.log('Auth: Initializing user session...')
      
      // First, check if there's an existing Supabase auth session
      const session = await SupabaseAuth.getSession()
      if (session) {
        console.log('Auth: Found existing Supabase session')
        supabaseSession.value = session
        supabaseUser.value = session.user
        
        // Extract wallet address from session user metadata
        const walletAddress = session.user.user_metadata?.wallet_address
        if (walletAddress) {
          // Load user profile from database
          const existingUser = await SupabaseService.getUserByWallet(walletAddress)
          if (existingUser) {
            user.value = existingUser
            isAuthenticated.value = true
            console.log('Auth: User session restored from Supabase:', existingUser.username || walletAddress)
            return
          }
        }
      }
      
      // Fallback: Check wallet store for connection
      const walletStore = useWalletStore()
      if (walletStore.isConnected && walletStore.walletAddress) {
        console.log('Auth: Wallet connected but no Supabase session, will authenticate on next sign in')
      }
      
    } catch (error) {
      console.error('Failed to initialize user:', error)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign in with wallet
   * Creates Supabase auth session and user profile
   */
  async function signInWithWallet() {
    try {
      isLoading.value = true
      
      // Get wallet address from wallet store
      const walletStore = useWalletStore()
      
      if (!walletStore.isConnected || !walletStore.walletAddress) {
        throw new Error('Wallet not connected')
      }

      const walletAddress = walletStore.walletAddress
      console.log('Auth: Signing in with wallet:', walletAddress)
      
      // Create Supabase auth session
      const { user: authUser, session } = await SupabaseAuth.signInWithWallet(walletAddress)
      
      // Store Supabase auth data
      supabaseUser.value = authUser
      supabaseSession.value = session
      
      // Check if user profile exists in database
      let existingUser = await SupabaseService.getUserByWallet(walletAddress)
      
      if (existingUser) {
        // User exists, just sign them in
        user.value = existingUser
        isAuthenticated.value = true
        console.log('Auth: User signed in:', existingUser.username || walletAddress)
      } else {
        // Create new user profile in database
        const newUser = await SupabaseService.upsertUser({
          wallet_address: walletAddress,
          username: `user_${walletAddress.slice(0, 8)}`,
          total_volume_traded: 0,
          tokens_created: 0,
          reputation_score: 0
        })
        
        if (newUser) {
          user.value = newUser
          isAuthenticated.value = true
          console.log('Auth: New user created and signed in:', newUser.username)
        } else {
          throw new Error('Failed to create user profile')
        }
      }
      
    } catch (error) {
      console.error('Failed to sign in with wallet:', error)
      throw error
    } finally {
      isLoading.value = false
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
      console.log('Auth: Supabase auth state changed:', event)
      
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