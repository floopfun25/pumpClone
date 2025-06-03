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
              // For mobile browsers, use the browse deeplink to open dApp inside Phantom's browser
              // This is different from connection deeplinks - browse opens the dApp in wallet's webview
              // where window.phantom becomes available
              
              const currentUrl = window.location.href
              const phantomBrowseUrl = `https://phantom.app/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(window.location.origin)}`
              
              console.log(`Opening Phantom browse URL:`, phantomBrowseUrl)
              
              // Open Phantom's in-app browser
              window.location.href = phantomBrowseUrl
              
            } else if (walletName.toLowerCase() === 'solflare') {
              // Similar approach for Solflare
              const currentUrl = window.location.href
              const solflareBrowseUrl = `https://solflare.com/ul/browse/${encodeURIComponent(currentUrl)}?ref=${encodeURIComponent(window.location.origin)}`
              
              console.log(`Opening Solflare browse URL:`, solflareBrowseUrl)
              
              window.location.href = solflareBrowseUrl
              
            } else {
              throw new Error(`Mobile deeplink not supported for ${walletName}`)
            }
            
            // The connection will be completed when the dApp loads in the wallet's browser
            // where window.phantom or window.solflare will be available
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

  // Check for wallet availability in mobile context (when opened in wallet's browser)
  async connectIfInMobileWalletBrowser(): Promise<void> {
    if (!isMobile()) {
      return
    }

    // Check if we're running inside a wallet's in-app browser
    // In this context, wallet objects should be available but we need user interaction to connect
    
    // Check for Phantom in mobile webview
    if ((window as any).phantom?.solana) {
      console.log('Detected Phantom in mobile webview context - wallet available for connection')
      
      // Don't auto-connect - this requires user interaction for approval dialog
      // Set a flag to indicate we're in Phantom's browser and can connect
      sessionStorage.setItem('mobileWalletContext', 'phantom')
      
      // Clean up mobile wallet attempt since we found the wallet
      sessionStorage.removeItem('mobileWalletAttempt')
      
      return
    }
    
    // Check for Solflare in mobile webview
    else if ((window as any).solflare) {
      console.log('Detected Solflare in mobile webview context - wallet available for connection')
      
      // Don't auto-connect - this requires user interaction for approval dialog
      // Set a flag to indicate we're in Solflare's browser and can connect
      sessionStorage.setItem('mobileWalletContext', 'solflare')
      
      sessionStorage.removeItem('mobileWalletAttempt')
      
      return
    }
    
    // If no wallet detected but we have a mobile wallet attempt, we're probably in regular mobile browser
    else {
      const lastAttemptedWallet = sessionStorage.getItem('mobileWalletAttempt')
      if (lastAttemptedWallet) {
        console.log('Mobile wallet attempt detected but no wallet object found - likely in regular browser')
        // Keep the attempt for potential future detection
      }
    }
  }

  // Manual connection method for mobile wallet browser context
  async connectInMobileWalletBrowser(): Promise<void> {
    const walletContext = sessionStorage.getItem('mobileWalletContext')
    
    if (!walletContext) {
      throw new Error('Not in mobile wallet browser context')
    }
    
    try {
      if (walletContext === 'phantom' && (window as any).phantom?.solana) {
        console.log('Connecting to Phantom in mobile webview context')
        
        const phantom = (window as any).phantom.solana
        
        // Request connection - this will show approval dialog
        const response = await phantom.connect()
        
        // Set up the connection state
        this.currentWallet.value = {
          name: 'Phantom',
          connected: true,
          publicKey: response.publicKey,
          signTransaction: phantom.signTransaction?.bind(phantom),
          signAllTransactions: phantom.signAllTransactions?.bind(phantom),
          signMessage: phantom.signMessage?.bind(phantom),
          sendTransaction: phantom.signAndSendTransaction?.bind(phantom)
        } as any
        
        this._publicKey.value = response.publicKey
        await this.updateBalance()
        
        // Clean up session storage
        sessionStorage.removeItem('mobileWalletContext')
        
        console.log('Mobile Phantom connection successful')
        
      } else if (walletContext === 'solflare' && (window as any).solflare) {
        console.log('Connecting to Solflare in mobile webview context')
        
        const solflare = (window as any).solflare
        
        const response = await solflare.connect()
        
        this.currentWallet.value = {
          name: 'Solflare',
          connected: true,
          publicKey: response.publicKey,
          signTransaction: solflare.signTransaction?.bind(solflare),
          signAllTransactions: solflare.signAllTransactions?.bind(solflare),
          signMessage: solflare.signMessage?.bind(solflare),
          sendTransaction: solflare.signAndSendTransaction?.bind(solflare)
        } as any
        
        this._publicKey.value = response.publicKey
        await this.updateBalance()
        
        sessionStorage.removeItem('mobileWalletContext')
        
        console.log('Mobile Solflare connection successful')
        
      } else {
        throw new Error(`Wallet context ${walletContext} not available`)
      }
    } catch (error) {
      console.error('Failed to connect in mobile wallet browser:', error)
      throw error
    }
  }

  // Check if we're in mobile wallet browser context
  isInMobileWalletBrowser(): boolean {
    return !!sessionStorage.getItem('mobileWalletContext')
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