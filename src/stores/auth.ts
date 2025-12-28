import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { useWalletStore } from "./wallet";
import { authAPI, userAPI, type User as APIUser } from "@/services/api";
import bs58 from "bs58";

// User interface for type safety
export interface User {
  id: number;
  wallet_address: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
  twitter_handle?: string;
  telegram_handle?: string;
  created_at: string;
}

// Auth store for managing user authentication with Spring Boot backend
export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref<User | null>(null);
  const isAuthenticated = ref(false);
  const isLoading = ref(false);
  const jwtToken = ref<string | null>(null);
  let isInitializing = false;

  // Initialize wallet store reference
  const walletStore = useWalletStore();

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      // Clear backend session
      authAPI.logout();

      // Clear state
      user.value = null;
      isAuthenticated.value = false;
      jwtToken.value = null;

      // Remove JWT token from localStorage
      localStorage.removeItem('jwtToken');
    } catch (error) {
      console.error("Auth: ❌ Sign out failed:", error);
    }
  };

  /**
   * Initialize user session
   * Called on app startup to restore user session
   */
  const initializeUser = async () => {
    try {
      isLoading.value = true;

      // If wallet is not connected, clear auth state and return
      if (!walletStore.isConnected || !walletStore.walletAddress) {
        user.value = null;
        isAuthenticated.value = false;
        return;
      }

      // If already authenticated with the same wallet, no need to reinitialize
      if (
        isAuthenticated.value &&
        user.value?.wallet_address === walletStore.walletAddress
      ) {
        return;
      }

      // Prevent re-entrant calls
      if (isInitializing) {
        return;
      }

      isInitializing = true;

      // Check if we have a stored JWT token
      const storedToken = localStorage.getItem('jwtToken');
      if (storedToken) {
        // Try to get user info to verify token is still valid
        try {
          const apiUser = await userAPI.getUserByWallet(walletStore.walletAddress!);
          // If we successfully got user info, the token is valid
          user.value = convertAPIUser(apiUser);
          isAuthenticated.value = true;
          jwtToken.value = storedToken;
          return;
        } catch (error) {
          localStorage.removeItem('jwtToken');
          jwtToken.value = null;
          isAuthenticated.value = false;
        }
      }

      // If we get here, no valid token - fetch user info but don't authenticate
      try {
        const apiUser = await userAPI.getUserByWallet(walletStore.walletAddress!);
        user.value = convertAPIUser(apiUser);
      } catch (error) {
        // No existing user found
      }
    } catch (error) {
      console.error("Auth: ❌ Error during user initialization:", error);
    } finally {
      isLoading.value = false;
      isInitializing = false;
    }
  };

  /**
   * Sign in with wallet signature
   */
  const signInWithWallet = async () => {
    if (!walletStore.walletAddress || !walletStore.wallet) {
      throw new Error("Wallet not connected");
    }

    try {
      isLoading.value = true;

      // Create a message to sign
      const message = `Sign in to FloppFun\n\nWallet: ${walletStore.walletAddress}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);

      // Request signature from wallet
      const signature = await walletStore.wallet.signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      // Login with backend
      const response = await authAPI.login(
        walletStore.walletAddress,
        message,
        signatureBase58
      );

      // Store user and token
      user.value = convertAPIUser(response.user);
      jwtToken.value = response.token;
      isAuthenticated.value = true;

      // Save JWT token to localStorage for API requests
      localStorage.setItem('jwtToken', response.token);
      return user.value;
    } catch (error) {
      console.error("Auth: ❌ Sign in failed:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (updates: {
    username?: string;
    bio?: string;
    avatar_url?: string;
    twitter_handle?: string;
    telegram_handle?: string;
  }) => {
    if (!isAuthenticated.value) {
      throw new Error("Not authenticated");
    }

    try {
      isLoading.value = true;

      const apiUser = await userAPI.updateProfile({
        username: updates.username,
        bio: updates.bio,
        avatarUrl: updates.avatar_url,
        twitterHandle: updates.twitter_handle,
        telegramHandle: updates.telegram_handle,
      });

      user.value = convertAPIUser(apiUser);
      return user.value;
    } catch (error) {
      console.error("Auth: ❌ Profile update failed:", error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Convert API user format to store format
   */
  function convertAPIUser(apiUser: APIUser): User {
    return {
      id: apiUser.id,
      wallet_address: apiUser.walletAddress,
      username: apiUser.username,
      avatar_url: apiUser.avatarUrl,
      bio: apiUser.bio,
      twitter_handle: apiUser.twitterHandle,
      telegram_handle: apiUser.telegramHandle,
      created_at: apiUser.createdAt,
    };
  }

  /**
   * Setup auth listener (for backward compatibility with App.vue)
   */
  const setupAuthListener = () => {
    // The watch is already set up above, so this is just for compatibility
  };

  // Watch for wallet connection changes
  watch(
    () => ({
      connected: walletStore.isConnected,
      address: walletStore.walletAddress,
    }),
    async (newWallet, oldWallet) => {
      // If wallet disconnected (but only if it was previously connected), clear auth
      if (!newWallet.connected && oldWallet?.connected) {
        await signOut();
        return;
      }

      // If wallet connected or address changed, try to initialize user
      if (
        newWallet.connected &&
        (!oldWallet?.connected || newWallet.address !== oldWallet?.address)
      ) {
        try {
          await initializeUser();
        } catch (error) {
          console.error(
            "Failed to initialize user after wallet change:",
            error,
          );
        }
      }
    },
    { immediate: true },
  );

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    jwtToken,

    // Actions
    initializeUser,
    signInWithWallet,
    signOut,
    updateProfile,
    setupAuthListener,  // Add for backward compatibility
  };
});
