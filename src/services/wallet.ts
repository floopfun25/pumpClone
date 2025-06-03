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
      // On mobile with MWA support, show all wallets that support MWA
      // The actual availability check happens when MWA tries to connect
      console.log('Mobile detected: showing MWA-compatible wallets')
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

        // Handle mobile connection - use deeplinks to wallet apps  
        if (isMobile() && wallet.supportsDeeplink) {
          try {
            console.log(`Connecting to ${walletName} on mobile via deeplink...`)
            
            // Store the wallet attempt in session storage
            sessionStorage.setItem('mobileWalletAttempt', walletName)
            sessionStorage.setItem('mobileConnectionTime', Date.now().toString())
            
            if (walletName.toLowerCase() === 'phantom') {
              // Create a connection request URL for Phantom
              const dappUrl = window.location.origin
              const phantomUrl = `https://phantom.app/ul/v1/connect?app_url=${encodeURIComponent(dappUrl)}&dapp_encryption_public_key=&nonce=&redirect_link=${encodeURIComponent(dappUrl + '?connected=true')}`
              
              console.log('Opening Phantom with connect URL:', phantomUrl)
              
              // Open Phantom app
              window.location.href = phantomUrl
              
            } else if (walletName.toLowerCase() === 'solflare') {
              // Create a connection request URL for Solflare  
              const dappUrl = window.location.origin
              const solflareUrl = `https://solflare.com/ul/v1/connect?app_url=${encodeURIComponent(dappUrl)}&redirect_link=${encodeURIComponent(dappUrl + '?connected=true')}`
              
              console.log('Opening Solflare with connect URL:', solflareUrl)
              
              // Open Solflare app
              window.location.href = solflareUrl
              
            } else {
              throw new Error(`Mobile connection not supported for ${walletName}`)
            }
            
            // The connection will complete when user returns from wallet app
            // We'll handle the return in the app initialization
            return
            
          } catch (error) {
            console.error(`Mobile connection failed:`, error)
            sessionStorage.removeItem('mobileWalletAttempt')
            sessionStorage.removeItem('mobileConnectionTime')
            
            throw new WalletConnectionError(
              `Failed to open ${walletName} app. Please make sure ${walletName} is installed on your device.`
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
    // First check for mobile wallet returns
    await this.handleMobileWalletReturn()
    
    if (isMobile()) {
      // Skip desktop auto-connect on mobile - mobile connections are handled above
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

  // Remove mobile wallet browser detection since we're using standard MWA in Chrome
  // The @solana/wallet-adapter automatically handles MWA integration in mobile Chrome
  async connectIfInMobileWalletBrowser(): Promise<void> {
    // No longer needed - MWA works directly in mobile Chrome browser
    console.log('MWA integration is automatic in mobile Chrome - no special handling needed')
    return
  }

  // Remove manual mobile wallet browser connection
  async connectInMobileWalletBrowser(): Promise<void> {
    throw new Error('Manual mobile wallet browser connection no longer needed - use standard connect() method')
  }

  // Check if we're in mobile wallet browser context
  isInMobileWalletBrowser(): boolean {
    // Always false since we're using direct MWA integration in Chrome
    return false
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
    sessionStorage.removeItem('mobileConnectionTime')
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

  // Check for mobile wallet return and handle connection
  async handleMobileWalletReturn(): Promise<void> {
    if (!isMobile()) {
      return
    }

    // Check if we have a mobile wallet attempt in progress
    const walletAttempt = sessionStorage.getItem('mobileWalletAttempt')
    const connectionTime = sessionStorage.getItem('mobileConnectionTime')
    
    if (!walletAttempt || !connectionTime) {
      return
    }

    // Check if this is a recent connection attempt (within 5 minutes)
    const timeDiff = Date.now() - parseInt(connectionTime)
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      sessionStorage.removeItem('mobileWalletAttempt')
      sessionStorage.removeItem('mobileConnectionTime')
      return
    }

    console.log('Checking for mobile wallet return...')

    // Check URL parameters for connection data
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get('connected')
    const publicKey = urlParams.get('public_key')
    
    if (connected === 'true' || publicKey) {
      console.log('Mobile wallet connection detected!')
      
      try {
        // Clean up URL parameters
        const cleanUrl = window.location.href.split('?')[0]
        window.history.replaceState({}, '', cleanUrl)
        
        // For now, try to connect using the desktop adapter as fallback
        // In a real implementation, you'd use the returned connection data
        const wallet = walletAdapters.find(w => w.name.toLowerCase() === walletAttempt.toLowerCase())
        
        if (wallet && wallet.adapter.readyState === WalletReadyState.Installed) {
          await wallet.adapter.connect()
          this.currentWallet.value = wallet.adapter
          this._publicKey.value = wallet.adapter.publicKey
          await this.updateBalance()
        }
        
        // Clean up session storage
        sessionStorage.removeItem('mobileWalletAttempt')
        sessionStorage.removeItem('mobileConnectionTime')
        
        console.log('Mobile wallet connection successful!')
        
      } catch (error) {
        console.error('Failed to complete mobile wallet connection:', error)
        sessionStorage.removeItem('mobileWalletAttempt')
        sessionStorage.removeItem('mobileConnectionTime')
      }
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