import { defineStore } from "pinia";
import { ref, computed, watchEffect } from "vue";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  getWalletService,
  formatWalletAddress,
  formatSOL,
} from "@/services/wallet";
import type { WalletAdapter } from "@/services/wallet";
import { tokenBalanceCache } from "@/services/tokenBalanceCache";

// Enhanced wallet store using real wallet service
export const useWalletStore = defineStore("wallet", () => {
  // Get the singleton instance of the wallet service
  const walletService = getWalletService();

  // Reactive state from wallet service
  const walletState = ref(walletService.getState());

  // Update state when wallet service changes
  const updateState = () => {
    walletState.value = walletService.getState();
  };

  // Set up a listener for state changes
  walletService.on("stateChanged", updateState);

  // Computed properties for easy access
  const isConnected = computed(() => walletState.value.connected);
  const isConnecting = computed(() => walletState.value.connecting);
  const isDisconnecting = computed(() => walletState.value.disconnecting);
  const publicKey = computed(() => walletState.value.publicKey);
  const wallet = computed(() => walletState.value.wallet);
  const balance = computed(() => walletState.value.balance);

  // Formatted computed properties
  const walletAddress = computed(() =>
    publicKey.value ? publicKey.value.toBase58() : null,
  );

  const walletAddressFormatted = computed(() =>
    publicKey.value ? formatWalletAddress(publicKey.value.toBase58()) : null,
  );

  const formattedBalance = computed(() => formatSOL(balance.value));

  /**
   * Initialize wallet on app startup
   * Attempts to auto-reconnect to previously connected wallet
   */
  const initializeWallet = async () => {
    try {
      // Try to auto-connect to previously connected wallet
      await walletService.autoConnect();
    } catch (error) {
      console.error("Failed to initialize wallet:", error);
    }
  };

  /**
   * Connect to wallet
   * @param walletName - Optional specific wallet name to connect to
   */
  async function connectWallet(walletName?: string) {
    try {
      await walletService.connect(walletName);
      // State will be updated automatically via watchEffect
      
      // Load cached token balances after wallet connection
      if (walletState.value.connected && walletState.value.publicKey) {
        try {
          const walletAddress = walletState.value.publicKey.toBase58();
          await tokenBalanceCache.loadUserBalances(walletAddress);
          console.log("✅ [WALLET STORE] Loaded cached token balances after connection");
        } catch (balanceError) {
          console.error("❌ [WALLET STORE] Failed to load cached balances:", balanceError);
        }
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }

  /**
   * Disconnect wallet
   * Clears wallet connection state
   */
  async function disconnectWallet() {
    try {
      // Clear token balance cache before disconnecting
      if (walletState.value.publicKey) {
        const walletAddress = walletState.value.publicKey.toBase58();
        tokenBalanceCache.clearWalletCache(walletAddress);
        console.log("🗑️ [WALLET STORE] Cleared token balance cache for wallet");
      }
      
      await walletService.disconnect();
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      throw error;
    }
  }

  /**
   * Get available wallets
   * Returns wallets that are installed and ready
   */
  function getAvailableWallets(): WalletAdapter[] {
    return walletService.getAvailableWallets();
  }

  /**
   * Get all wallets
   * Returns all supported wallets (including not installed)
   */
  function getAllWallets(): WalletAdapter[] {
    return walletService.getAllWallets();
  }

  /**
   * Update wallet balance
   * Refreshes the current wallet balance
   */
  async function updateBalance() {
    try {
      await walletService.updateBalance();
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error("Failed to update balance:", error);
    }
  }

  /**
   * Sign message with wallet
   * @param message - Message to sign as Uint8Array
   */
  async function signMessage(message: Uint8Array): Promise<Uint8Array> {
    return await walletService.signMessage(message);
  }

  /**
   * Sign text message with wallet
   * @param message - Text message to sign
   */
  async function signTextMessage(message: string): Promise<Uint8Array> {
    return await walletService.signTextMessage(message);
  }

  /**
   * Sign authentication challenge
   * @param walletAddress - Wallet address for authentication
   * @param challenge - Challenge nonce
   * @param timestamp - Authentication timestamp
   */
  async function signAuthChallenge(
    walletAddress: string,
    challenge: string,
    timestamp: number,
  ): Promise<Uint8Array> {
    return await walletService.signAuthChallenge(
      walletAddress,
      challenge,
      timestamp,
    );
  }

  /**
   * Sign transaction with wallet
   * @param transaction - Transaction to sign
   */
  async function signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> {
    return await walletService.signTransaction(transaction);
  }

  /**
   * Send transaction
   * @param transaction - Transaction to send
   * @param options - Optional send options
   */
  async function sendTransaction(
    transaction: any,
    options?: any,
  ): Promise<string> {
    const signature = await walletService.sendTransaction(transaction, options);
    // State will be updated automatically via watchEffect
    return signature;
  }

  /**
   * Handle mobile wallet return from app
   * Checks for connection parameters and completes connection
   */
  async function handleMobileWalletReturn() {
    try {
      await walletService.handleMobileWalletReturn();
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error("Failed to handle mobile wallet return:", error);
    }
  }

  /**
   * Handle successful mobile connection from broadcast channel
   * @param data - The connection data from the broadcast message
   */
  const handleMobileConnect = (data: any) => {
    walletService.handleBroadcastConnect(data);
    updateState();
  };

  /**
   * Handle mobile disconnect from broadcast channel
   */
  const handleMobileDisconnect = () => {
    walletService.handleBroadcastDisconnect();
    updateState();
  };

  const decreaseBalance = (amount: number) => {
    walletService.decreaseBalance(amount);
  };

  // Return store interface
  return {
    // State
    walletState,
    isConnected,
    isConnecting,
    isDisconnecting,
    publicKey,
    wallet,
    balance,
    walletAddress,
    walletAddressFormatted,
    formattedBalance,

    // Actions
    initializeWallet,
    connectWallet,
    disconnectWallet,
    getAvailableWallets,
    getAllWallets,
    updateBalance,
    signMessage,
    signTextMessage,
    signAuthChallenge,
    signTransaction,
    sendTransaction,
    handleMobileWalletReturn,
    updateState,
    handleMobileConnect,
    handleMobileDisconnect,
    decreaseBalance,
  };
});
