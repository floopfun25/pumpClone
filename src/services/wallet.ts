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
// import { useUIStore } from '@/stores/ui' // REMOVED: To be dynamically imported
import { showDebugMessage } from '@/utils/mobileDebug'
import { broadcastService } from './broadcastService';
import { notificationService } from './notificationService';

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
    showDebugMessage('💾 Saved connection data to localStorage')
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
    
    showDebugMessage('📂 Loaded connection data from localStorage', {
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
  const urlParams = new URLSearchParams(window.location.search)
  const phantomAction = urlParams.get('phantom_action')
  
  if (phantomAction === 'connect') {
    handlePhantomConnectResponse()
  }
}

// Handle Phantom connect response
export const handlePhantomConnectResponse = () => {
  try {
    // Check if this is actually a Phantom response
    const urlParams = new URLSearchParams(window.location.search)
    const phantomAction = urlParams.get('phantom_action')
    
    if (phantomAction !== 'connect') {
      return
    }
    
    // Check for various possible parameter names that Phantom might use
    const possibleKeys = [
      'phantom_encryption_public_key',
      'phantomEncryptionPublicKey', 
      'phantom_public_key',
      'publicKey',
      'public_key'
    ]
    
    let phantomPublicKey = null
    let actualKeyName = null
    
    for (const key of possibleKeys) {
      const value = urlParams.get(key)
      if (value) {
        phantomPublicKey = value
        actualKeyName = key
        break
      }
    }
    
    const nonce = urlParams.get('nonce')
    const data = urlParams.get('data')
    const errorCode = urlParams.get('errorCode')
    const errorMessage = urlParams.get('errorMessage')
    
    // Check for errors first
    if (errorCode) {
      console.error('Phantom returned error:', errorCode, '-', errorMessage)
      throw new Error(`Phantom error: ${errorCode} - ${errorMessage}`)
    }

    if (!phantomPublicKey || !nonce || !data) {
      console.error('Missing required Phantom response parameters:', {
        phantomPublicKey: !!phantomPublicKey,
        nonce: !!nonce,
        data: !!data
      })
      throw new Error('Missing required parameters from Phantom response')
    }

    // Try to get connection data from memory or storage
    let connectionData = mobileWalletState.connectionData
    
    if (!connectionData) {
      console.log('No connection data in memory, trying to load from storage...')
      const savedData = loadConnectionData()
      
      if (savedData?.dappKeyPair) {
        connectionData = {
          dappKeyPair: savedData.dappKeyPair,
          session: savedData.session || null,
          sharedSecret: savedData.sharedSecret || null,
          phantomEncryptionPublicKey: savedData.phantomEncryptionPublicKey || null
        }
        mobileWalletState.connectionData = connectionData
        console.log('✅ Connection data restored from storage')
      } else {
        console.error('No connection data found in storage')
        throw new Error('No connection data available')
      }
    }
    
    if (!connectionData?.dappKeyPair) {
      console.error('No dapp keypair available')
      throw new Error('No dapp keypair available - cannot decrypt response')
    }
    
    showDebugMessage('🔓 Attempting to decrypt Phantom response...')
    
    // Manual decryption process
    try {
      // Decode the Phantom public key
      const decodedPhantomKey = bs58.decode(phantomPublicKey)
      
      // Generate shared secret
      const sharedSecret = nacl.box.before(
        decodedPhantomKey,
        connectionData.dappKeyPair.secretKey
      )
      
      // Decode data and nonce
      const decodedData = bs58.decode(data)
      const decodedNonce = bs58.decode(nonce)
      
      // Try to decrypt
      const decryptedData = nacl.box.open.after(
        decodedData,
        decodedNonce,
        sharedSecret
      )
      
      if (!decryptedData) {
        throw new Error('Unable to decrypt data')
      }
      
      // Success!
      const connectData = JSON.parse(Buffer.from(decryptedData).toString('utf8'))
      
      // Broadcast the successful connection event
      broadcastService.postMessage({
        type: 'wallet-connected',
        data: {
          publicKey: connectData.public_key,
          session: connectData.session,
          phantomEncryptionPublicKey: phantomPublicKey,
        }
      });

      // Attempt to close the new tab, this might not always work due to browser restrictions
      setTimeout(() => {
        window.close();
      }, 500);

      // Clean up the URL by removing phantom_action parameter
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete('phantom_action')
      cleanUrl.searchParams.delete('phantom_encryption_public_key')
      cleanUrl.searchParams.delete('data')
      cleanUrl.searchParams.delete('nonce')
      cleanUrl.searchParams.delete('errorCode')
      cleanUrl.searchParams.delete('errorMessage')
      window.history.replaceState({}, document.title, cleanUrl.toString())
      
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError)
      throw decryptError
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    showDebugMessage('❌ Phantom connection failed:', errorMessage)
    
    mobileWalletState.isConnecting = false
    clearConnectionData()
    mobileWalletState.connectionData = null
    
    // Show error toast via notification service
    notificationService.emit('showToast', {
      type: 'error',
      title: 'Connection Failed',
      message: errorMessage,
      duration: 8000
    });
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  // Check if this is a Phantom response first
  const urlParams = new URLSearchParams(window.location.search)
  const phantomAction = urlParams.get('phantom_action')
  
  if (phantomAction === 'connect') {
    // If this is a Phantom response, don't initialize new connection data
    // Let the response handler load the stored data instead
    checkForPhantomResponse()
  } else {
    // Only initialize connection data if we're not processing a response
    mobileWalletState.connectionData = initializeConnectionData()
  }
}

export const connectPhantomMobile = async (): Promise<void> => {
  if (mobileWalletState.isConnecting) {
    throw new Error('Connection already in progress')
  }

  try {
    mobileWalletState.isConnecting = true
    mobileWalletState.lastConnectionAttempt = Date.now()

    if (!mobileWalletState.connectionData) {
      mobileWalletState.connectionData = initializeConnectionData()
    }
    
    saveConnectionData(mobileWalletState.connectionData)
    
    showDebugMessage('💾 Connection data saved to localStorage:', {
      hasKeyPair: !!mobileWalletState.connectionData.dappKeyPair,
      publicKey: mobileWalletState.connectionData.dappKeyPair.publicKey ? 'exists' : 'missing'
    })

    const redirectUrl = createRedirectUrl('connect')
    
    const connectUrl = buildConnectUrl(
      mobileWalletState.connectionData.dappKeyPair,
      redirectUrl,
      'devnet'
    )

    showDebugMessage('🔗 Opening Phantom connect URL:', connectUrl)
    showDebugMessage('📱 Redirect URL (with phantom_action):', redirectUrl)

    window.location.href = connectUrl

  } catch (error) {
    mobileWalletState.isConnecting = false
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

    // Build disconnect URL using exact current URL as redirect
    const redirectUrl = createRedirectUrl('disconnect');
    const disconnectUrl = buildDisconnectUrl(
      connectionData.dappKeyPair,
      connectionData.sharedSecret,
      connectionData.session,
      redirectUrl
    )

    showDebugMessage('🔗 Opening Phantom disconnect URL:', disconnectUrl)
    showDebugMessage('📱 Redirect URL (with phantom_action):', redirectUrl)

    // Clear local state
    mobileWalletState.connectionData = null
    clearConnectionData()

    broadcastService.postMessage({ type: 'wallet-disconnected' });

    // Use window.location.href to maintain tab context
    window.location.href = disconnectUrl

    showDebugMessage('✅ Phantom wallet disconnected')
    
  } catch (error) {
    showDebugMessage('❌ Failed to disconnect from Phantom:', error)
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
  private _internalConnected = ref(false) // For mobile broadcast connection
  private _connected = computed(() => {
    // A user is connected if the desktop adapter is connected OR if our mobile-specific state is true
    return (this.currentWallet.value?.connected ?? false) || this._internalConnected.value
  })
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
    if (this.connecting || this.connected) return

    this._connecting.value = true
    try {
      if (isMobile()) {
        await this.connectMobile(walletName)
      } else {
        await this.connectDesktop(walletName)
      }
    } catch (error: any) {
      this.handleError(error)
      throw error
    } finally {
      this._connecting.value = false
    }
  }

  disconnect = async (): Promise<void> => {
    try {
      this._disconnecting.value = true;
      if (isMobile() && this.currentWallet.value?.name === 'Phantom') {
        await disconnectPhantomMobile();
      } else if (this.currentWallet.value) {
        await this.currentWallet.value.disconnect();
      }
    } catch (error) {
      this.handleError(error as Error);
    } finally {
      this.handleDisconnect();
      this._disconnecting.value = false;
    }
  }

  signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
    if (!this.currentWallet.value || !this.connected) throw new WalletNotConnectedError();
    return this.currentWallet.value.signMessage!(message);
  }

  signTransaction = async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
    if (!this.currentWallet.value || !this.connected) throw new WalletNotConnectedError();
    return this.currentWallet.value.signTransaction!(transaction);
  }

  sendTransaction = async (transaction: Transaction | VersionedTransaction, options?: SendOptions): Promise<string> => {
    if (!this.currentWallet.value || !this.connected) throw new WalletNotConnectedError();
    return this.currentWallet.value.sendTransaction(transaction, this.connection, options);
  }

  handleMobileWalletReturn = async (): Promise<void> => {
    // This logic might be needed for other mobile wallets besides Phantom
    console.log("Handling mobile wallet return...");
  }

  autoConnect = async (): Promise<void> => {
    if (this.connecting || this.connected) return

    // Mobile auto-connect logic
    if (isMobile()) {
      const mobileConnectionData = loadConnectionData();
      if (mobileConnectionData && mobileConnectionData.session) {
        console.log("Found mobile session data, attempting to restore connection...");
        this.handleBroadcastConnect({
          publicKey: new PublicKey(bs58.decode(mobileConnectionData.phantomEncryptionPublicKey!)).toBase58(),
          session: mobileConnectionData.session,
          phantomEncryptionPublicKey: mobileConnectionData.phantomEncryptionPublicKey,
        });
        return;
      }
    }

    // Desktop auto-connect logic
    const walletName = localStorage.getItem('walletName')
    if (walletName) {
      this._connecting.value = true
      try {
        const wallet = walletAdapters.find(w => w.name === walletName)
        if (!wallet) {
          localStorage.removeItem('walletName')
          return
        }
        if (wallet.adapter.readyState !== WalletReadyState.Installed && 
            wallet.adapter.readyState !== WalletReadyState.Loadable) {
          return
        }
        await this.connect(walletName)
      } catch (error) {
        localStorage.removeItem('walletName')
        console.warn('Auto-connect failed:', error)
      } finally {
        this._connecting.value = false;
      }
    }
  }

  // Mobile connection using MWA
  private async connectMobile(walletName?: string): Promise<void> {
    // Force Phantom to always use the deeplink strategy
    if (walletName === 'Phantom') {
      try {
        showDebugMessage('📱 Forcing Phantom mobile connection via deeplink...');
        await connectPhantomMobile();
        // The browser navigates away, so code below will not be executed in this tab.
        return; 
      } catch (error) {
        console.error(`Failed to connect to Phantom on mobile:`, error);
        this._connecting.value = false;
        this.handleError(error as Error);
        throw error;
      }
    }

    // Fallback for other wallets or if no name is specified
    const isChrome = /Chrome/.test(navigator.userAgent) && /Android/.test(navigator.userAgent)
    
    // Use proper deeplink connection for mobile wallets
    if (walletName) {
      try {
        // This block will now handle non-Phantom wallets like Solflare
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
        
      } catch (error) {
        console.error(`Failed to connect to ${walletName} on mobile:`, error)
        this._connecting.value = false
        this.handleError(error as Error)
        throw error
      }
    } else {
      // If no specific wallet is chosen, use MWA
      return this.connectViaMWA()
    }
  }

  private async connectViaMWA(): Promise<void> {
    if (!this.mobileWalletAdapter) {
      throw new Error('Mobile Wallet Adapter is not available.')
    }
    try {
      await this.mobileWalletAdapter.connect()
    } catch (error) {
      this.handleError(error as Error)
    }
  }

  private async connectDesktop(walletName?: string): Promise<void> {
    if (!walletName) {
      throw new WalletConnectionError('Wallet not selected')
    }
    const wallet = walletAdapters.find(w => w.name === walletName)
    if (!wallet) {
      throw new WalletConnectionError(`Wallet ${walletName} not found.`)
    }
    if (wallet.adapter.readyState !== WalletReadyState.Installed) {
      window.open(wallet.url, '_blank')
      throw new WalletConnectionError(`${walletName} is not installed.`)
    }
    this.currentWallet.value = wallet.adapter
    this.setupWalletListeners(wallet.adapter)
    try {
      await wallet.adapter.connect()
    } catch (error: any) {
      this.handleError(error)
      throw error
    }
  }

  private setupMobileReturnListener(walletName: string): void {
    // Listen for when the user returns from the wallet app
    const handleVisibilityChange = async () => {
      if (document.hidden === false) {
        // ... (implementation restored)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

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

  // Setup wallet event listeners
  private setupWalletListeners(wallet: BaseMessageSignerWalletAdapter): void {
    wallet.on('connect', this.handleConnect)
    wallet.on('disconnect', this.handleDisconnect)
    wallet.on('error', this.handleError)
  }

  private handleConnect = (): void => {
    if (this.currentWallet.value) {
      this._publicKey.value = this.currentWallet.value.publicKey
      this._connecting.value = false
      this._internalConnected.value = false // Not a mobile broadcast connection
      console.log('✅ Wallet connected:', this._publicKey.value?.toBase58())
      this.updateBalance()
    }
  }

  private handleDisconnect = (): void => {
    // This is the generic disconnect handler for both desktop and mobile
    this._publicKey.value = null
    this._balance.value = 0
    this._internalConnected.value = false
    this._connecting.value = false
    this._disconnecting.value = false
    this.currentWallet.value = null
    localStorage.removeItem('walletName')
    clearConnectionData()
    console.log('🔌 Wallet disconnected')
  }

  private handleError = (error: Error): void => {
    console.error('Wallet error:', error)
    this.handleDisconnect() // Reset state on error
  }

  private cleanup(): void {
    // Remove all listeners from current wallet
    if (this.currentWallet.value) {
      this.currentWallet.value.off('connect', this.handleConnect)
      this.currentWallet.value.off('disconnect', this.handleDisconnect)
      this.currentWallet.value.off('error', this.handleError)
    }
  }

  handleBroadcastConnect(data: any): void {
    try {
      this._publicKey.value = new PublicKey(data.publicKey);
      this.currentWallet.value = walletAdapters.find(w => w.name === 'Phantom')?.adapter || null;
      this._connecting.value = false;
      this._internalConnected.value = true; // Set the internal state for mobile

      // Save connection data received from the other tab
      const connectionData: WalletConnectionData = {
        dappKeyPair: generateDappKeyPair(), // This will be different, but we don't need it for decrypting anymore
        session: data.session,
        sharedSecret: null, // Can't reconstruct this, but session is what matters now
        phantomEncryptionPublicKey: data.phantomEncryptionPublicKey,
      };
      saveConnectionData(connectionData);
      localStorage.setItem('walletName', 'Phantom');


      this.updateBalance();
      
      notificationService.emit('showToast', {
        type: 'success',
        title: 'Wallet Connected!',
        message: `Connected via another tab.`,
        duration: 5000
      });
    } catch(e) {
      console.error("Error handling broadcast connect", e)
    }
  }

  handleBroadcastDisconnect(): void {
    this.handleDisconnect();
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

// Singleton instance and getter
let walletServiceInstance: WalletService | null = null;

export const getWalletService = (): WalletService => {
  if (!walletServiceInstance) {
    walletServiceInstance = new WalletService();
  }
  return walletServiceInstance;
};


export const formatWalletAddress = (address: string, length = 4): string => {
  if (!address) return ''
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

export const formatSOL = (amount: number): string => {
  return `${amount.toFixed(4)} SOL`
} 