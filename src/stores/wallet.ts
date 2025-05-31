import { defineStore } from 'pinia'
import { ref, computed, watchEffect } from 'vue'
import { walletService, formatWalletAddress, formatSOL } from '@/services/wallet'
import type { WalletAdapter } from '@/services/wallet'

// Enhanced wallet store using real wallet service
export const useWalletStore = defineStore('wallet', () => {
  // Reactive state from wallet service
  const walletState = ref(walletService.getState())

  // Auto-update state when wallet service changes
  watchEffect(() => {
    walletState.value = walletService.getState()
  })

  // Update state when wallet service changes
  const updateState = () => {
    walletState.value = walletService.getState()
  }

  // Computed properties for easy access
  const isConnected = computed(() => walletState.value.connected)
  const isConnecting = computed(() => walletState.value.connecting)
  const isDisconnecting = computed(() => walletState.value.disconnecting)
  const publicKey = computed(() => walletState.value.publicKey)
  const wallet = computed(() => walletState.value.wallet)
  const balance = computed(() => walletState.value.balance)
  
  // Formatted computed properties
  const walletAddress = computed(() => 
    publicKey.value ? formatWalletAddress(publicKey.value.toBase58()) : null
  )
  
  const formattedBalance = computed(() => 
    formatSOL(balance.value)
  )

  /**
   * Initialize wallet on app startup
   * Attempts to auto-reconnect to previously connected wallet
   */
  async function initializeWallet() {
    try {
      console.log('Wallet Store: Initializing wallet...')
      
      // Small delay to ensure wallet adapters are ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      await walletService.autoConnect()
      
      console.log('Wallet Store: Initialization complete. Connected:', isConnected.value)
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error('Failed to initialize wallet:', error)
    }
  }

  /**
   * Connect to wallet
   * @param walletName - Optional specific wallet name to connect to
   */
  async function connectWallet(walletName?: string) {
    try {
      await walletService.connect(walletName)
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error('Failed to connect wallet:', error)
      throw error
    }
  }

  /**
   * Disconnect wallet
   * Clears wallet connection state
   */
  async function disconnectWallet() {
    try {
      await walletService.disconnect()
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
      throw error
    }
  }

  /**
   * Get available wallets
   * Returns wallets that are installed and ready
   */
  function getAvailableWallets(): WalletAdapter[] {
    return walletService.getAvailableWallets()
  }

  /**
   * Get all wallets
   * Returns all supported wallets (including not installed)
   */
  function getAllWallets(): WalletAdapter[] {
    return walletService.getAllWallets()
  }

  /**
   * Update wallet balance
   * Refreshes the current wallet balance
   */
  async function updateBalance() {
    try {
      await walletService.updateBalance()
      // State will be updated automatically via watchEffect
    } catch (error) {
      console.error('Failed to update balance:', error)
    }
  }

  /**
   * Sign message with wallet
   * @param message - Message to sign as Uint8Array
   */
  async function signMessage(message: Uint8Array): Promise<Uint8Array> {
    return await walletService.signMessage(message)
  }

  /**
   * Send transaction
   * @param transaction - Transaction to send
   * @param options - Optional send options
   */
  async function sendTransaction(transaction: any, options?: any): Promise<string> {
    const signature = await walletService.sendTransaction(transaction, options)
    // State will be updated automatically via watchEffect
    return signature
  }

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
    formattedBalance,

    // Actions
    initializeWallet,
    connectWallet,
    disconnectWallet,
    getAvailableWallets,
    getAllWallets,
    updateBalance,
    signMessage,
    sendTransaction,
    updateState
  }
}) 