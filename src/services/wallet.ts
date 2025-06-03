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

// Dynamic import for Mobile Wallet Adapter to avoid SSR issues
let SolanaMobileWalletAdapter: any = null
try {
  if (typeof window !== 'undefined' && isMobile()) {
    import('@solana-mobile/wallet-adapter-mobile').then(module => {
      SolanaMobileWalletAdapter = module.SolanaMobileWalletAdapter
    }).catch(console.warn)
  }
} catch (e) {
  console.warn('Mobile Wallet Adapter not available:', e)
}

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
  private mobileWalletAdapter: any = null

  constructor() {
    this.connection = new Connection(
      solanaConfig.rpcUrl,
      solanaConfig.commitment as Commitment
    )
    
    // Initialize Mobile Wallet Adapter for mobile devices
    this.initializeMobileWalletAdapter()
  }

  private async initializeMobileWalletAdapter() {
    if (!isMobile() || typeof window === 'undefined') {
      return
    }

    try {
      // Only attempt to load MWA on mobile Chrome (Android)
      const isChrome = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)
      if (!isChrome) {
        console.log('Mobile Wallet Adapter only supports Chrome on Android')
        return
      }

      // Dynamically import the Mobile Wallet Adapter
      const { 
        SolanaMobileWalletAdapter,
        createDefaultAddressSelector,
        createDefaultAuthorizationResultCache,
        createDefaultWalletNotFoundHandler 
      } = await import('@solana-mobile/wallet-adapter-mobile')
      
      this.mobileWalletAdapter = new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'Pump Clone',
          uri: window.location.origin,
          icon: `${window.location.origin}/favicon.ico`,
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: solanaConfig.commitment === 'confirmed' ? 'mainnet-beta' : 'devnet',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      })

      console.log('Mobile Wallet Adapter initialized for mobile Chrome')
      
    } catch (error) {
      console.warn('Failed to initialize Mobile Wallet Adapter:', error)
    }
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
      // On mobile Chrome (Android), all wallets are potentially available via MWA
      const isChrome = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)
      if (isChrome) {
        console.log('Mobile Chrome detected: showing all wallets (MWA compatible)')
        return walletAdapters
      } else {
        console.log('Mobile non-Chrome browser: limited wallet support')
        return []
      }
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

      // Handle mobile connection via MWA
      if (isMobile()) {
        return await this.connectMobile(walletName)
      }

      // Handle desktop connection
      return await this.connectDesktop(walletName)

    } catch (error) {
      console.error('Failed to connect wallet:', error)
      this.cleanup()
      throw new WalletConnectionError((error as Error)?.message || 'Failed to connect wallet')
    } finally {
      this._connecting.value = false
    }
  }

  // Mobile connection using MWA
  private async connectMobile(walletName?: string): Promise<void> {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)
    
    if (!isChrome) {
      throw new WalletConnectionError(
        'Mobile wallet connections are only supported in Chrome on Android. Please use Chrome browser or install the wallet app directly.'
      )
    }

    if (!this.mobileWalletAdapter) {
      await this.initializeMobileWalletAdapter()
      
      if (!this.mobileWalletAdapter) {
        throw new WalletConnectionError(
          'Mobile Wallet Adapter failed to initialize. Please try again or use a desktop browser.'
        )
      }
    }

    try {
      console.log(`Connecting via Mobile Wallet Adapter...`)
      
      // Set up event listeners for MWA
      this.setupWalletListeners(this.mobileWalletAdapter)

      // Attempt connection via MWA
      await this.mobileWalletAdapter.connect()

      this.currentWallet.value = this.mobileWalletAdapter
      this._publicKey.value = this.mobileWalletAdapter.publicKey

      console.log('Mobile wallet connected successfully via MWA!')

      // Update balance
      await this.updateBalance()

    } catch (error: any) {
      console.error('Mobile Wallet Adapter connection failed:', error)
      
      // Check if it's a specific error we can handle
      if (error?.message?.includes('no wallet found')) {
        throw new WalletConnectionError(
          'No compatible mobile wallet found. Please install Phantom or Solflare from the app store.'
        )
      }
      
      throw new WalletConnectionError(
        `Mobile wallet connection failed: ${error?.message || 'Unknown error'}`
      )
    }
  }

  // Desktop connection using standard wallet adapters
  private async connectDesktop(walletName?: string): Promise<void> {
    let walletAdapter: BaseMessageSignerWalletAdapter | null = null

    if (walletName) {
      // Find the wallet configuration
      const wallet = walletAdapters.find(w => w.name === walletName)
      if (!wallet) {
        throw new Error(`Wallet ${walletName} not found`)
      }
      walletAdapter = wallet.adapter
    } else {
      // Auto-select first available wallet
      const availableWallets = this.getAvailableWallets()
      if (availableWallets.length === 0) {
        throw new Error('No wallets available')
      }
      walletAdapter = availableWallets[0].adapter
    }

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

  // Auto-reconnect on page load
  async autoConnect(): Promise<void> {
    if (isMobile()) {
      // On mobile, try to initialize MWA but don't auto-connect
      // User must explicitly connect on mobile
      await this.initializeMobileWalletAdapter()
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

  // Check if we're in mobile wallet browser context (legacy method)
  isInMobileWalletBrowser(): boolean {
    // This is no longer needed with proper MWA integration
    return false
  }

  // Legacy mobile wallet return handling (no longer needed)
  async handleMobileWalletReturn(): Promise<void> {
    // This is no longer needed with proper MWA integration
    console.log('Legacy mobile wallet return handling - no longer needed with MWA')
    return
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
        localStorage.setItem('walletName', this.currentWallet.value.name || 'unknown')
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