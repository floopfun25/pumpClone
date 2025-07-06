import { ref, computed } from 'vue'
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import type { Commitment, SendOptions, TransactionSignature } from '@solana/web3.js'
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
import { 
  connectMobileWallet, 
  getMobileConnectionInstructions,
  generateDappKeyPair,
  buildConnectUrl,
  parseConnectResponse,
  createRedirectUrl,
  isPhantomResponse,
  buildDisconnectUrl
} from '../utils/walletDeeplink'
import type { WalletConnectionData } from '../utils/walletDeeplink'
import * as bs58 from 'bs58'
import * as nacl from 'tweetnacl'
import { showDebug } from '@/services/debugService'
import { useUIStore } from '@/stores/ui'

// Extend Window interface to include solana property
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      publicKey?: PublicKey | null
      isConnected?: boolean
      connect?: () => Promise<{ publicKey: PublicKey }>
      disconnect?: () => Promise<void>
      signTransaction?: (transaction: Transaction) => Promise<Transaction>
      signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>
      signMessage?: (message: Uint8Array) => Promise<Uint8Array>
      prepareTransaction?: (transaction: Transaction) => Promise<Transaction>
    }
  }
}

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

interface MobileWalletState {
  isConnecting: boolean
  connectionData: WalletConnectionData | null
  lastConnectionAttempt: number
}

const mobileWalletState: MobileWalletState = {
  isConnecting: false,
  connectionData: null,
  lastConnectionAttempt: 0
}

// Store connection data in localStorage for persistence
const STORAGE_KEY = 'phantom_connection_data'

const saveConnectionData = (data: WalletConnectionData) => {
  try {
    // We need to save the keypair for decrypting Phantom responses
    // Store it as base58 encoded strings for JSON serialization
    const safeData = {
      session: data.session,
      phantomEncryptionPublicKey: data.phantomEncryptionPublicKey,
      dappKeyPair: data.dappKeyPair ? {
        publicKey: bs58.encode(data.dappKeyPair.publicKey),
        secretKey: bs58.encode(data.dappKeyPair.secretKey)
      } : null
    }
    
    // Use localStorage instead of sessionStorage for better mobile persistence
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData))
    console.log('💾 Saved connection data to localStorage')
  } catch (error) {
    console.warn('Failed to save connection data:', error)
  }
}

const loadConnectionData = (): Partial<WalletConnectionData> | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const data = JSON.parse(stored)
    
    // Reconstruct the keypair from stored base58 strings
    if (data.dappKeyPair) {
      data.dappKeyPair = {
        publicKey: bs58.decode(data.dappKeyPair.publicKey),
        secretKey: bs58.decode(data.dappKeyPair.secretKey)
      }
    }
    
    console.log('📂 Loaded connection data from localStorage:', {
      hasSession: !!data.session,
      hasKeyPair: !!data.dappKeyPair
    })
    
    return data
  } catch (error) {
    console.warn('Failed to load connection data:', error)
    return null
  }
}

const clearConnectionData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    console.log('🗑️ Connection data cleared')
  } catch (error) {
    console.warn('Failed to clear connection data:', error)
  }
}

// Initialize mobile wallet connection data
const initializeConnectionData = (): WalletConnectionData => {
  const stored = loadConnectionData()
  
  // Reuse stored keypair if it exists, otherwise generate a new one
  const dappKeyPair = stored?.dappKeyPair || generateDappKeyPair()
  
  return {
    dappKeyPair,
    session: stored?.session || null,
    sharedSecret: null, // Will be regenerated from keys
    phantomEncryptionPublicKey: stored?.phantomEncryptionPublicKey || null
  }
}

// Check for phantom response on page load
const checkForPhantomResponse = () => {
  // Check both hash and query parameters
  let phantomAction = null
  
  // Check hash for phantom_action
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    phantomAction = hashParams.get('phantom_action')
  }
  
  // Fallback to query parameters
  if (!phantomAction) {
    const urlParams = new URLSearchParams(window.location.search)
    phantomAction = urlParams.get('phantom_action')
  }
  
  if (phantomAction === 'connect') {
    handlePhantomConnectResponse()
  }
}

// Handle Phantom connect response
export const handlePhantomConnectResponse = () => {
  const uiStore = useUIStore()
  try {
    // Check if this is actually a Phantom response
    // First check hash-based parameters (new approach)
    let phantomAction = null
    
    // Check hash for phantom_action
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      phantomAction = hashParams.get('phantom_action')
    }
    
    // Fallback to query parameters (old approach)
    if (!phantomAction) {
      const urlParams = new URLSearchParams(window.location.search)
      phantomAction = urlParams.get('phantom_action')
    }
    
    if (phantomAction !== 'connect') {
      return
    }

    uiStore.showToast({
      type: 'info',
      title: 'Processing Connection',
      message: 'Completing wallet connection...',
      duration: 3000
    })
    
    // Check for various possible parameter names that Phantom might use
    // Check both hash and query parameters
    const possibleKeys = [
      'phantom_encryption_public_key',
      'phantomEncryptionPublicKey', 
      'phantom_public_key',
      'publicKey',
      'public_key'
    ]
    
    let phantomPublicKey = null
    let actualKeyName = null
    let nonce = null
    let data = null
    let errorCode = null
    let errorMessage = null
    
    // First check hash parameters
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      
      for (const key of possibleKeys) {
        const value = hashParams.get(key)
        if (value) {
          phantomPublicKey = value
          actualKeyName = key
          break
        }
      }
      
      nonce = hashParams.get('nonce')
      data = hashParams.get('data')
      errorCode = hashParams.get('errorCode')
      errorMessage = hashParams.get('errorMessage')
    }
    
    // If not found in hash, check query parameters
    if (!phantomPublicKey) {
      const urlParams = new URLSearchParams(window.location.search)
      
      for (const key of possibleKeys) {
        const value = urlParams.get(key)
        if (value) {
          phantomPublicKey = value
          actualKeyName = key
          break
        }
      }
      
      if (!nonce) nonce = urlParams.get('nonce')
      if (!data) data = urlParams.get('data')
      if (!errorCode) errorCode = urlParams.get('errorCode')
      if (!errorMessage) errorMessage = urlParams.get('errorMessage')
    }
    
    // Check for errors first
    if (errorCode) {
      uiStore.showToast({
        type: 'error',
        title: 'Phantom Error',
        message: errorMessage || `Error code: ${errorCode}`,
        duration: 5000
      })
      throw new Error(`Phantom error: ${errorCode} - ${errorMessage}`)
    }

    if (!phantomPublicKey || !nonce || !data) {
      uiStore.showToast({
        type: 'error',
        title: 'Invalid Response',
        message: 'Missing required connection parameters',
        duration: 5000
      })
      throw new Error('Missing required parameters from Phantom response')
    }

    // Try to get connection data from memory or storage
    let connectionData = mobileWalletState.connectionData
    
    if (!connectionData) {
      const savedData = loadConnectionData()
      
      if (savedData?.dappKeyPair) {
        connectionData = {
          dappKeyPair: savedData.dappKeyPair,
          session: savedData.session || null,
          sharedSecret: savedData.sharedSecret || null,
          phantomEncryptionPublicKey: savedData.phantomEncryptionPublicKey || null
        }
        mobileWalletState.connectionData = connectionData
      } else {
        uiStore.showToast({
          type: 'error',
          title: 'Connection Failed',
          message: 'No connection data found. Please try connecting again.',
          duration: 5000
        })
        throw new Error('No connection data available')
      }
    }
    
    if (!connectionData?.dappKeyPair) {
      uiStore.showToast({
        type: 'error',
        title: 'Connection Failed',
        message: 'Missing encryption keys. Please try connecting again.',
        duration: 5000
      })
      throw new Error('No dapp keypair available - cannot decrypt response')
    }

    // Manual decryption process
    try {
      const decodedPhantomKey = bs58.decode(phantomPublicKey)
      const sharedSecret = nacl.box.before(
        decodedPhantomKey,
        connectionData.dappKeyPair.secretKey
      )
      
      const decodedData = bs58.decode(data)
      const decodedNonce = bs58.decode(nonce)
      
      const decryptedData = nacl.box.open.after(
        decodedData,
        decodedNonce,
        sharedSecret
      )
      
      if (!decryptedData) {
        uiStore.showToast({
          type: 'error',
          title: 'Decryption Failed',
          message: 'Could not decrypt connection data',
          duration: 5000
        })
        throw new Error('Unable to decrypt data')
      }
      
      const connectData = JSON.parse(Buffer.from(decryptedData).toString('utf8'))
      
      // Create PublicKey object from the public key string
      const publicKey = new PublicKey(connectData.public_key)
      
      // Set window.solana for compatibility
      window.solana = {
        isPhantom: true,
        publicKey,
        isConnected: true,
        connect: () => Promise.resolve({ publicKey }),
        disconnect: () => Promise.resolve(),
        signTransaction: () => Promise.reject(new Error('Use mobile signing')),
        signAllTransactions: () => Promise.reject(new Error('Use mobile signing')),
        signMessage: () => Promise.reject(new Error('Use mobile signing')),
        prepareTransaction: () => Promise.reject(new Error('Use mobile signing')),
      }

      // Update wallet service state
      try {
        const phantomAdapter = walletAdapters.find(w => w.name === 'Phantom')?.adapter
        if (phantomAdapter && walletService) {
          const adapter = phantomAdapter as any;
          adapter._publicKey = publicKey;
          adapter._connected = true;
          adapter._readyState = WalletReadyState.Installed;
          
          // Update wallet service state
          walletService.handleMobileWalletReturn()
            .then(() => {
              uiStore.showToast({
                type: 'success',
                title: 'Connected!',
                message: `Wallet connected: ${formatWalletAddress(connectData.public_key)}`,
                duration: 5000
              })
            })
            .catch((error) => {
              uiStore.showToast({
                type: 'error',
                title: 'State Update Failed',
                message: 'Connected but failed to update state',
                duration: 5000
              })
            })
        }
      } catch (serviceError) {
        uiStore.showToast({
          type: 'error',
          title: 'Service Error',
          message: 'Failed to update wallet service',
          duration: 5000
        })
      }

      // Update connection data
      mobileWalletState.connectionData = {
        ...connectionData,
        session: connectData.session,
        sharedSecret
      }

      // Save updated connection data
      saveConnectionData(mobileWalletState.connectionData)

      // Dispatch connection event
      window.dispatchEvent(new CustomEvent('phantom-wallet-connected', {
        detail: { publicKey: connectData.public_key }
      }))
      
      // Clean up the URL and stay on same page
      // Remove both hash and query parameters
      const cleanUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, document.title, cleanUrl)
      
    } catch (decryptError) {
      uiStore.showToast({
        type: 'error',
        title: 'Decryption Error',
        message: 'Failed to process connection data',
        duration: 5000
      })
      throw decryptError
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    mobileWalletState.isConnecting = false
    clearConnectionData()
    mobileWalletState.connectionData = null
    
    uiStore.showToast({
      type: 'error',
      title: 'Connection Failed',
      message: errorMessage,
      duration: 8000
    })
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  // Check if this is a Phantom response first
  // Check both hash and query parameters
  let phantomAction = null
  
  // Check hash for phantom_action
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    phantomAction = hashParams.get('phantom_action')
  }
  
  // Fallback to query parameters
  if (!phantomAction) {
    const urlParams = new URLSearchParams(window.location.search)
    phantomAction = urlParams.get('phantom_action')
  }
  
  if (phantomAction === 'connect') {
    // If this is a Phantom response, don't initialize new connection data
    // Let the response handler load the stored data instead
    checkForPhantomResponse()
  } else {
    // Only initialize connection data if we're not processing a response
    mobileWalletState.connectionData = initializeConnectionData()
  }
}

export const connectPhantomMobile = async (): Promise<{ publicKey: PublicKey }> => {
  if (mobileWalletState.isConnecting) {
    throw new Error('Connection already in progress')
  }

  try {
    mobileWalletState.isConnecting = true
    mobileWalletState.lastConnectionAttempt = Date.now()

    // Show connecting status to user
    const uiStore = useUIStore()
    uiStore.showToast({
      type: 'info',
      title: 'Connecting...',
      message: 'Opening Phantom app...',
      duration: 3000
    })

    // For mobile, let's try using the Mobile Wallet Adapter approach
    // This is specifically designed for mobile connections and should handle tab issues better
    
    // Check if we're on Chrome Android (MWA only works on Chrome Android)
    const isChrome = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)
    
    if (isChrome) {
      // Use Mobile Wallet Adapter for Chrome Android
      console.log('Using Mobile Wallet Adapter for Chrome Android')
      
      // Dynamically import the Mobile Wallet Adapter
      const { 
        SolanaMobileWalletAdapter,
        createDefaultAddressSelector,
        createDefaultAuthorizationResultCache,
        createDefaultWalletNotFoundHandler 
      } = await import('@solana-mobile/wallet-adapter-mobile')
      
      const mobileWalletAdapter = new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'Pump Clone',
          uri: window.location.origin,
          icon: `${window.location.origin}/favicon.ico`,
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: 'devnet',
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      })

      // Set up event listeners
      mobileWalletAdapter.on('connect', () => {
        console.log('Mobile wallet connected via MWA')
      })

      mobileWalletAdapter.on('disconnect', () => {
        console.log('Mobile wallet disconnected via MWA')
      })

      // Attempt connection via MWA
      await mobileWalletAdapter.connect()

      // Get the public key
      const publicKey = mobileWalletAdapter.publicKey
      if (!publicKey) {
        throw new Error('No public key received from mobile wallet')
      }

      // Update wallet service state
      const phantomAdapter = walletAdapters.find(w => w.name === 'Phantom')?.adapter
      if (phantomAdapter && walletService) {
        const adapter = phantomAdapter as any;
        adapter._publicKey = publicKey;
        adapter._connected = true;
        adapter._readyState = WalletReadyState.Installed;
        
        // Update wallet service state
        walletService.handleMobileWalletReturn()
          .then(() => {
            uiStore.showToast({
              type: 'success',
              title: 'Connected!',
              message: `Wallet connected: ${formatWalletAddress(publicKey.toBase58())}`,
              duration: 5000
            })
          })
          .catch((error) => {
            uiStore.showToast({
              type: 'error',
              title: 'State Update Failed',
              message: 'Connected but failed to update state',
              duration: 5000
            })
          })
      }

      return { publicKey }
      
    } else {
      // For non-Chrome Android, use the simplified deeplink approach
      console.log('Using simplified deeplink approach for non-Chrome Android')
      
      // Use a simple deeplink that opens Phantom without expecting a redirect back
      const phantomDeeplink = `https://phantom.app/ul/v1/browse/${encodeURIComponent(window.location.origin)}?ref=${encodeURIComponent(window.location.href)}&cluster=devnet`

      // Show debug info to user
      uiStore.showToast({
        type: 'info',
        title: 'Debug Info',
        message: 'Opening Phantom... Please approve the connection and return to this tab.',
        duration: 5000
      })

      // Use a simple approach that should work better on mobile
      // This opens Phantom in the same context without expecting a redirect
      window.location.href = phantomDeeplink

      // Return a promise that resolves when connection is complete
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          mobileWalletState.isConnecting = false
          uiStore.showToast({
            type: 'error',
            title: 'Connection Failed',
            message: 'Connection timed out. Please try again.',
            duration: 5000
          })
          reject(new Error('Connection timeout'))
        }, 60000)

        const handleConnection = (event: CustomEvent) => {
          clearTimeout(timeout)
          mobileWalletState.isConnecting = false
          window.removeEventListener('phantom-wallet-connected', handleConnection as EventListener)
          resolve({ publicKey: new PublicKey(event.detail.publicKey) })
        }

        window.addEventListener('phantom-wallet-connected', handleConnection as EventListener)
      })
    }

  } catch (error) {
    mobileWalletState.isConnecting = false
    const uiStore = useUIStore()
    uiStore.showToast({
      type: 'error',
      title: 'Connection Failed',
      message: error instanceof Error ? error.message : 'Failed to connect to Phantom',
      duration: 5000
    })
    throw error
  }
}

export const disconnectPhantomMobile = async (): Promise<void> => {
  try {
    const connectionData = mobileWalletState.connectionData
    if (!connectionData?.session || !connectionData?.sharedSecret) {
      // Already disconnected
      return
    }

    // Build disconnect URL
    const redirectUrl = createRedirectUrl('disconnect')
    const disconnectUrl = buildDisconnectUrl(
      connectionData.dappKeyPair,
      connectionData.sharedSecret,
      connectionData.session,
      redirectUrl
    )

    // Clear local state
    mobileWalletState.connectionData = null
    clearConnectionData()

    // Clear window.solana
    if (window.solana) {
      window.solana.isConnected = false
      window.solana.publicKey = null
    }

    // Open disconnect URL - use replace() to avoid opening new tab
    window.location.replace(disconnectUrl)

    console.log('✅ Phantom wallet disconnected')
    
  } catch (error) {
    console.error('❌ Failed to disconnect from Phantom:', error)
    throw error
  }
}

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
      // On mobile, all wallets are potentially available via deep linking
      console.log('Mobile detected: showing all wallets (deep linking compatible)')
      return walletAdapters
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
    
    // Use proper deeplink connection for mobile wallets
    if (walletName) {
      try {
        if (walletName === 'Phantom') {
          console.log('Attempting Phantom mobile connection via proper connect deeplink...')
          
          // Use the new connect method with proper encryption
          const result = await connectPhantomMobile()
          
          // Find the wallet adapter for setup
          const walletAdapter = walletAdapters.find(w => w.name === walletName)?.adapter
          if (walletAdapter) {
            this.currentWallet.value = walletAdapter
            this._publicKey.value = result.publicKey
            this.handleConnect()
            
            // Update balance
            await this.updateBalance()
          }
          
          console.log('✅ Phantom mobile wallet connected successfully!')
          return
          
        } else {
          console.log(`Attempting mobile connection to ${walletName} via deep linking...`)
          
          // Show instructions to user
          const instructions = getMobileConnectionInstructions(walletName)
          console.log(instructions)
          
          // Use deep linking to open the wallet app for other wallets
          await connectMobileWallet(walletName, {
            dappUrl: window.location.origin,
            redirectUrl: window.location.href,
            cluster: 'mainnet-beta'
          })
          
          console.log(`Successfully opened ${walletName} app for connection`)
          
          // The actual connection will happen when the user returns from the app
          this.setupMobileReturnListener(walletName)
          
          return
        }
        
      } catch (error: any) {
        console.error(`Mobile connection failed for ${walletName}:`, error)
        
        // If deep linking fails and we're on Chrome Android, try MWA as fallback
        if (isChrome && this.mobileWalletAdapter) {
          console.log('Falling back to Mobile Wallet Adapter...')
          return this.connectViaMWA()
        }
        
        throw new WalletConnectionError(
          `Unable to connect to ${walletName}. Please make sure the ${walletName} app is installed on your device.`
        )
      }
    }
    
    // Fallback to MWA for Chrome Android if no specific wallet is requested
    if (isChrome) {
      return this.connectViaMWA()
    }
    
    throw new WalletConnectionError(
      'Mobile wallet connections require a compatible wallet app. Please install Phantom or Solflare from your app store.'
    )
  }

  private async connectViaMWA(): Promise<void> {
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

  private setupMobileReturnListener(walletName: string): void {
    // Listen for when the user returns from the wallet app
    const handleVisibilityChange = async () => {
      if (document.hidden === false) {
        console.log(`User returned from ${walletName} app, attempting to complete connection...`)
        
        // Remove the listener
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        
        // Try to connect using the standard adapter now that user has approved in the app
        try {
          // Find the wallet adapter
          const wallet = walletAdapters.find(w => w.name === walletName)
          if (!wallet) {
            throw new Error(`Wallet ${walletName} not found`)
          }
          
          // Set up event listeners
          this.setupWalletListeners(wallet.adapter)
          
          // The wallet should now be ready to connect
          await wallet.adapter.connect()
          
          this.currentWallet.value = wallet.adapter
          this._publicKey.value = wallet.adapter.publicKey
          
          console.log(`Mobile wallet ${walletName} connected successfully!`)
          
          // Update balance
          await this.updateBalance()
          
        } catch (error: any) {
          console.error(`Failed to complete mobile connection for ${walletName}:`, error)
          
          // Show user-friendly error message
          throw new WalletConnectionError(
            `Connection to ${walletName} was not completed. Please try again and make sure to approve the connection in the ${walletName} app.`
          )
        }
      }
    }
    
    // Listen for page becoming visible again
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Also set up a timeout to clean up the listener
    setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, 60000) // Clean up after 1 minute
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

      // Handle mobile Phantom disconnection
      if (isMobile() && this.currentWallet.value?.name === 'Phantom') {
        await disconnectPhantomMobile()
        this.cleanup()
        return
      }

      // Handle regular wallet disconnection
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

  // Sign transaction
  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (!this.currentWallet.value || !this._connected.value) {
      throw new WalletNotConnectedError()
    }

    if (!this.currentWallet.value.signTransaction) {
      throw new Error('Wallet does not support transaction signing')
    }

    return await this.currentWallet.value.signTransaction(transaction)
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

  // Handle mobile wallet return
  async handleMobileWalletReturn(): Promise<void> {
    try {
      console.log('Handling mobile wallet return...')

      // For the simplified approach, we need to detect when user returns from Phantom
      // and then prompt them to connect manually or check if they're already connected
      
      // Wait briefly for any potential state changes
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check if we have a connected wallet adapter
      if (!this.currentWallet.value) {
        const phantomAdapter = walletAdapters.find(w => w.name === 'Phantom')?.adapter
        if (!phantomAdapter) {
          throw new Error('No wallet adapter available')
        }
        
        // Set up the adapter
        this.currentWallet.value = phantomAdapter
        
        // Set up event listeners
        this.setupWalletListeners(phantomAdapter)
      }

      // For the simplified approach, we'll show a message to the user
      // asking them to manually connect or check their connection status
      const uiStore = useUIStore()
      uiStore.showToast({
        type: 'info',
        title: 'Connection Status',
        message: 'Please check if Phantom is connected. If not, try connecting again.',
        duration: 5000
      })

      console.log('Mobile wallet return handled - user should check connection status')
      
    } catch (error) {
      console.error('Failed to handle mobile wallet return:', error)
      this.cleanup()
      throw error
    }
  }

  // Handle wallet connect event
  private handleConnect(): void {
    if (!this.currentWallet.value) {
      console.warn('No wallet adapter available')
      return
    }

    // Update public key
    this._publicKey.value = this.currentWallet.value.publicKey
    
    // Save wallet name for auto-reconnect (only on desktop)
    if (!isMobile()) {
      localStorage.setItem('walletName', this.currentWallet.value.name || 'unknown')
    }
    
    // Update balance
    this.updateBalance()
      .catch(error => {
        console.warn('Failed to update balance:', error)
      })
  }

  // Setup wallet event listeners
  private setupWalletListeners(wallet: BaseMessageSignerWalletAdapter): void {
    wallet.on('connect', this.handleConnect.bind(this))
    wallet.on('disconnect', this.handleDisconnect.bind(this))
    wallet.on('error', this.handleError.bind(this))
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

// Initialize wallet service singleton
export const walletService = new WalletService()

// Export utility functions
export const formatWalletAddress = (address: string, length = 4): string => {
  if (!address) return ''
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

export const formatSOL = (amount: number): string => {
  return `${amount.toFixed(4)} SOL`
} 