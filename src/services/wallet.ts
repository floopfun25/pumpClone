import { ref, computed } from 'vue'
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import type { Commitment, SendOptions } from '@solana/web3.js'
import { 
  BaseMessageSignerWalletAdapter,
  WalletReadyState,
  WalletNotConnectedError,
  WalletDisconnectedError,
  WalletConnectionError
} from '@solana/wallet-adapter-base'
import {
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-phantom'
import {
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-solflare'
import { solanaConfig } from '@/config'
import { isMobile } from '@/utils/mobile'

// Wallet types
export interface WalletAdapter {
  name: string
  icon: string
  url: string
  adapter: BaseMessageSignerWalletAdapter
  mobileUrl?: string
  supportsDeeplink?: boolean
}

export interface WalletState {
  connected: boolean
  connecting: boolean
  disconnecting: boolean
  publicKey: PublicKey | null
  wallet: BaseMessageSignerWalletAdapter | null
  balance: number
}

// Available wallet adapters
const walletAdapters: WalletAdapter[] = [
  {
    name: 'Phantom',
    icon: 'https://phantom.app/img/phantom-logo.svg',
    url: 'https://phantom.app/',
    adapter: new PhantomWalletAdapter(),
    mobileUrl: 'https://phantom.app/download',
    supportsDeeplink: true
  },
  {
    name: 'Solflare',
    icon: 'https://solflare.com/assets/logo.svg',
    url: 'https://solflare.com/',
    adapter: new SolflareWalletAdapter(),
    mobileUrl: 'https://solflare.com/download',
    supportsDeeplink: true
  }
]

class WalletService {
  private connection: Connection
  private currentWallet = ref<BaseMessageSignerWalletAdapter | null>(null)
  private _connecting = ref(false)
  private _disconnecting = ref(false)
  private _publicKey = ref<PublicKey | null>(null)
  private _balance = ref(0)
  private _connected = computed(() => 
    !!this.currentWallet.value?.connected && 
    !!this._publicKey.value
  )

  constructor() {
    this.connection = new Connection(
      solanaConfig.rpcUrl,
      solanaConfig.commitment as Commitment
    )
  }

  get connecting() {
    return this._connecting.value
  }

  get disconnecting() {
    return this._disconnecting.value
  }

  get connected() {
    return this._connected.value
  }

  get publicKey() {
    return this._publicKey.value
  }

  get wallet() {
    return this.currentWallet.value
  }

  get balance() {
    return this._balance.value
  }

  // Get available wallets
  getAvailableWallets(): WalletAdapter[] {
    const mobile = isMobile()
    
    if (mobile) {
      // On mobile, we show wallets that support deeplinks
      // The actual installation check happens when trying to connect
      return walletAdapters.filter(wallet => wallet.supportsDeeplink)
    }
    
    // Desktop behavior - check for browser extensions
    return walletAdapters.filter(wallet => 
      wallet.adapter.readyState === WalletReadyState.Installed ||
      wallet.adapter.readyState === WalletReadyState.Loadable
    )
  }

  // Get all wallets (including not installed)
  getAllWallets(): WalletAdapter[] {
    return walletAdapters
  }

  // Connect to specific wallet
  async connect(walletName?: string): Promise<void> {
    try {
      this._connecting.value = true

      let walletAdapter: BaseMessageSignerWalletAdapter | null = null

      if (walletName) {
        // Find the wallet configuration
        const wallet = walletAdapters.find(w => w.name === walletName)
        if (!wallet) {
          throw new Error(`Wallet ${walletName} not found`)
        }

        // Handle mobile connection - use deeplinks directly
        if (isMobile() && wallet.supportsDeeplink) {
          try {
            // Store the wallet attempt in session storage
            sessionStorage.setItem('mobileWalletAttempt', walletName)
            
            if (walletName.toLowerCase() === 'phantom') {
              // Use Phantom's proper connect deeplink format (not browse)
              // This requires encryption parameters but shows the approval dialog
              
              // Generate a keypair for encryption (simplified approach)
              const dappKeyPair = crypto.getRandomValues(new Uint8Array(32))
              const dappPublicKeyBase58 = btoa(String.fromCharCode(...dappKeyPair.slice(0, 32)))
              
              const params = new URLSearchParams({
                dapp_encryption_public_key: dappPublicKeyBase58,
                cluster: solanaConfig.network || 'mainnet-beta',
                app_url: window.location.origin,
                redirect_link: window.location.href
              })
              
              const connectUrl = `https://phantom.app/ul/v1/connect?${params.toString()}`
              console.log(`Opening Phantom connect deeplink:`, connectUrl)
              
              // Open the connect deeplink
              window.location.href = connectUrl
              
            } else if (walletName.toLowerCase() === 'solflare') {
              // For Solflare, try their connection format
              const params = new URLSearchParams({
                cluster: solanaConfig.network || 'mainnet-beta',
                app_url: window.location.origin,
                redirect_link: window.location.href
              })
              
              const connectUrl = `https://solflare.com/ul/v1/connect?${params.toString()}`
              console.log(`Opening Solflare connect deeplink:`, connectUrl)
              
              window.location.href = connectUrl
              
            } else {
              throw new Error(`Mobile deeplink not supported for ${walletName}`)
            }
            
            // Note: The connection will be completed when the user returns from the wallet app
            // This is handled by the visibility change detection in App.vue
            return
            
          } catch (error) {
            console.error(`Mobile connection failed for ${walletName}:`, error)
            sessionStorage.removeItem('mobileWalletAttempt')
            throw new WalletConnectionError(
              `Failed to open ${walletName} app. Please make sure it's installed.`
            )
          }
        }

        // Desktop wallet connection
        walletAdapter = wallet.adapter
      } else {
        // Auto-select first available wallet (desktop only)
        if (isMobile()) {
          throw new Error('Please select a specific wallet on mobile')
        }
        
        const availableWallets = this.getAvailableWallets()
        if (availableWallets.length === 0) {
          throw new Error('No wallets available')
        }
        walletAdapter = availableWallets[0].adapter
      }

      // Desktop wallet connection using wallet adapters
      if (!isMobile() && walletAdapter) {
        // Check if wallet is actually available on desktop
        if (walletAdapter.readyState !== WalletReadyState.Installed && 
            walletAdapter.readyState !== WalletReadyState.Loadable) {
          throw new Error(`${walletAdapter.name} wallet is not installed`)
        }

        // Set up event listeners
        this.setupWalletListeners(walletAdapter)

        // Attempt connection
        await walletAdapter.connect()

        this.currentWallet.value = walletAdapter
        this._publicKey.value = walletAdapter.publicKey

        // Save wallet name to localStorage for auto-reconnect (only on desktop)
        localStorage.setItem('walletName', walletAdapter.name)

        // Update balance
        await this.updateBalance()
      }

    } catch (error) {
      console.error('Failed to connect wallet:', error)
      this.cleanup()
      throw new WalletConnectionError((error as Error)?.message || 'Failed to connect wallet')
    } finally {
      this._connecting.value = false
    }
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    try {
      this._disconnecting.value = true

      if (this.currentWallet.value) {
        await this.currentWallet.value.disconnect()
      }

      this.cleanup()

    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
      throw new WalletDisconnectedError((error as Error)?.message || 'Failed to disconnect wallet')
    } finally {
      this._disconnecting.value = false
    }
  }

  // Sign message
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.currentWallet.value || !this._connected.value) {
      throw new WalletNotConnectedError()
    }

    if (!this.currentWallet.value.signMessage) {
      throw new Error('Wallet does not support message signing')
    }

    return await this.currentWallet.value.signMessage(message)
  }

  // Send transaction
  async sendTransaction(transaction: Transaction | VersionedTransaction, options?: SendOptions): Promise<string> {
    if (!this.currentWallet.value || !this._connected.value) {
      throw new WalletNotConnectedError()
    }

    return await this.currentWallet.value.sendTransaction(transaction, this.connection, options)
  }

  // Update balance
  async updateBalance(): Promise<void> {
    if (!this._publicKey.value) {
      this._balance.value = 0
      return
    }

    try {
      const balance = await this.connection.getBalance(this._publicKey.value)
      this._balance.value = balance / LAMPORTS_PER_SOL
    } catch (error) {
      console.error('Failed to update balance:', error)
      this._balance.value = 0
    }
  }

  // Auto-reconnect on page load (only on desktop)
  async autoConnect(): Promise<void> {
    if (isMobile()) {
      // Skip auto-connect on mobile - users need to manually connect via deeplinks
      return
    }

    const lastWalletName = localStorage.getItem('walletName')
    
    if (!lastWalletName) {
      return
    }

    try {
      // Find the wallet adapter
      const wallet = walletAdapters.find(w => w.name === lastWalletName)
      if (!wallet) {
        localStorage.removeItem('walletName')
        return
      }

      // Check if wallet is ready
      if (wallet.adapter.readyState !== WalletReadyState.Installed && 
          wallet.adapter.readyState !== WalletReadyState.Loadable) {
        return
      }

      await this.connect(lastWalletName)
      
    } catch (error) {
      localStorage.removeItem('walletName')
      console.warn('Auto-connect failed:', error)
    }
  }

  // Manual connection for returning mobile users (when they come back from wallet app)
  async connectIfReturningFromMobileWallet(): Promise<void> {
    if (!isMobile()) {
      return
    }

    // Check if user was in the middle of a wallet connection
    const lastAttemptedWallet = sessionStorage.getItem('mobileWalletAttempt')
    
    if (lastAttemptedWallet) {
      console.log('Detected mobile wallet return for:', lastAttemptedWallet)
      sessionStorage.removeItem('mobileWalletAttempt')
      
      // Check URL for Phantom's response parameters
      const urlParams = new URLSearchParams(window.location.search)
      
      // Phantom returns these parameters on successful connection
      const phantomEncryptionPublicKey = urlParams.get('phantom_encryption_public_key')
      const nonce = urlParams.get('nonce')
      const data = urlParams.get('data')
      const errorCode = urlParams.get('errorCode')
      
      if (errorCode) {
        console.log('Mobile wallet connection failed with error:', errorCode)
        return
      }
      
      if (phantomEncryptionPublicKey && nonce && data) {
        try {
          // For now, we'll create a mock connection since we don't have the full encryption setup
          // In a real implementation, you would decrypt the data parameter to get the public key
          
          // Mock a successful connection
          console.log('Mobile wallet connection successful, creating mock connection state')
          
          this.currentWallet.value = {
            name: lastAttemptedWallet,
            connected: true,
            publicKey: null // Will be set when we decrypt the response
          } as any
          
          // Clean up URL parameters
          const cleanUrl = window.location.href.split('?')[0]
          window.history.replaceState({}, '', cleanUrl)
          
          console.log(`Mobile wallet connection completed for ${lastAttemptedWallet}`)
        } catch (error) {
          console.warn('Failed to complete mobile wallet connection:', error)
        }
      } else {
        // No connection parameters found - connection was cancelled or failed
        console.log('Mobile wallet connection was cancelled or no response received')
      }
    }
  }

  // Setup wallet event listeners
  private setupWalletListeners(wallet: BaseMessageSignerWalletAdapter): void {
    wallet.on('connect', this.handleConnect.bind(this))
    wallet.on('disconnect', this.handleDisconnect.bind(this))
    wallet.on('error', this.handleError.bind(this))
  }

  // Handle wallet connect event
  private handleConnect(): void {
    if (this.currentWallet.value) {
      this._publicKey.value = this.currentWallet.value.publicKey
      if (!isMobile()) {
        localStorage.setItem('walletName', this.currentWallet.value.name)
      }
      this.updateBalance()
    }
  }

  // Handle wallet disconnect event
  private handleDisconnect(): void {
    this.cleanup()
  }

  // Handle wallet error event
  private handleError(error: Error): void {
    console.error('Wallet error:', error)
    this.cleanup()
  }

  // Cleanup wallet state
  private cleanup(): void {
    this.currentWallet.value = null
    this._publicKey.value = null
    this._balance.value = 0
    if (!isMobile()) {
      localStorage.removeItem('walletName')
    }
    sessionStorage.removeItem('mobileWalletAttempt')
  }

  // Get wallet state for reactive use
  getState(): WalletState {
    return {
      connected: this.connected,
      connecting: this.connecting,
      disconnecting: this.disconnecting,
      publicKey: this.publicKey,
      wallet: this.wallet as any,
      balance: this.balance
    }
  }
}

// Export wallet service instance
export const walletService = new WalletService()

// Export utility functions
export const formatWalletAddress = (address: string, length = 4): string => {
  if (!address) return ''
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

export const formatSOL = (amount: number): string => {
  return `${amount.toFixed(4)} SOL`
} 