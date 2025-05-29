import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useWalletStore } from './wallet'
import { SupabaseService } from '@/services/supabase'

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

// Auth store for managing user authentication
export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)

  /**
   * Initialize user session
   * Called on app startup to restore user session
   */
  async function initializeUser() {
    try {
      isLoading.value = true
      
      // Get wallet store to check connection
      const walletStore = useWalletStore()
      
      if (walletStore.isConnected && walletStore.walletAddress) {
        // Check if user exists in database
        const existingUser = await SupabaseService.getUserByWallet(walletStore.walletAddress)
        
        if (existingUser) {
          user.value = existingUser
          isAuthenticated.value = true
          console.log('User session restored:', existingUser.username || existingUser.wallet_address)
        }
      }
      
    } catch (error) {
      console.error('Failed to initialize user:', error)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign in with wallet
   * Creates or updates user profile based on wallet address
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
      
      // Check if user already exists
      let existingUser = await SupabaseService.getUserByWallet(walletAddress)
      
      if (existingUser) {
        // User exists, just sign them in
        user.value = existingUser
        isAuthenticated.value = true
        console.log('User signed in:', existingUser.username || walletAddress)
      } else {
        // Create new user profile
        const newUser = await SupabaseService.upsertUser({
          wallet_address: walletAddress,
          username: `user_${walletAddress.slice(0, 8)}`,
          total_volume_traded: 0,
          tokens_created: 0,
          reputation_score: 0
        })
        
        user.value = newUser
        isAuthenticated.value = true
        console.log('New user created:', newUser.username)
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
   * Clears user session and authentication state
   */
  function signOut() {
    user.value = null
    isAuthenticated.value = false
    
    console.log('User signed out')
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
      
      // Update local user state
      user.value = updatedUser
      
      console.log('User profile updated:', updates)
      
    } catch (error) {
      console.error('Failed to update profile:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    
    // Actions
    initializeUser,
    signInWithWallet,
    signOut,
    updateProfile
  }
}) 