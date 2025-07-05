import { isMobile, isIOS, isAndroid, getPhantomDownloadUrl } from './mobile'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Buffer } from 'buffer'

// Ensure Buffer is available globally for crypto operations
if (typeof window !== 'undefined' && !window.Buffer) {
  (window as any).Buffer = Buffer
}

/**
 * Wallet deeplink utilities for mobile connections
 */

export interface DeeplinkOptions {
  dappUrl?: string
  redirectUrl?: string
  cluster?: 'mainnet-beta' | 'devnet' | 'testnet'
}

export interface WalletConnectionData {
  dappKeyPair: nacl.BoxKeyPair
  session: string | null
  sharedSecret: Uint8Array | null
  phantomEncryptionPublicKey: string | null
}

export interface ConnectResponse {
  public_key: string
  session: string
}

/**
 * Create Phantom deeplink for mobile connection
 */
export const createPhantomDeeplink = (options: DeeplinkOptions = {}) => {
  const {
    dappUrl = window.location.origin,
    redirectUrl = window.location.href,
    cluster = 'mainnet-beta'
  } = options

  // Encode URLs for safety
  const encodedDappUrl = encodeURIComponent(dappUrl)
  const encodedRedirectUrl = encodeURIComponent(redirectUrl)
  
  // Use Phantom's universal link format for better compatibility
  return `https://phantom.app/ul/v1/browse/${encodedDappUrl}?ref=${encodedRedirectUrl}&cluster=${cluster}`
}

/**
 * Open wallet app via deeplink with fallback to app store
 */
export const openWalletApp = async (walletName: string, options: DeeplinkOptions = {}): Promise<void> => {
  if (!isMobile()) {
    throw new Error('Deeplinks are only supported on mobile devices')
  }

  return new Promise((resolve, reject) => {
    let deeplink: string
    let appStoreUrl: string

    switch (walletName.toLowerCase()) {
      case 'phantom':
        deeplink = createPhantomDeeplink(options)
        appStoreUrl = getPhantomDownloadUrl()
        break
      
      case 'solflare':
        // Solflare deeplink format (if available)
        deeplink = `https://solflare.com/ul/v1/browse/${encodeURIComponent(options.dappUrl || window.location.origin)}`
        appStoreUrl = isIOS() 
          ? 'https://apps.apple.com/app/solflare/id1580902717'
          : 'https://play.google.com/store/apps/details?id=com.solflare'
        break
      
      default:
        reject(new Error(`Unsupported wallet: ${walletName}`))
        return
    }

    console.log(`Attempting to open ${walletName} via deeplink:`, deeplink)

    // Set up a timeout to detect if the app didn't open
    const timeoutId = setTimeout(() => {
      console.log(`${walletName} app not detected, redirecting to app store`)
      
      // Show user a choice or redirect to app store
      const userWantsToInstall = confirm(
        `${walletName} app not found. Would you like to install it?`
      )
      
      if (userWantsToInstall) {
        window.location.href = appStoreUrl
      }
      
      reject(new Error(`${walletName} app not installed`))
    }, 3000)

    // Try to detect if the app opened successfully
    const startTime = Date.now()
    
    // Use page visibility API to detect when user returns from app
    const handleVisibilityChange = () => {
      const endTime = Date.now()
      const timeElapsed = endTime - startTime
      
      // If user was away for more than 2 seconds, assume app opened
      if (document.hidden === false && timeElapsed > 2000) {
        clearTimeout(timeoutId)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        console.log(`${walletName} app appeared to open successfully`)
        resolve()
      }
    }

    // Listen for page becoming visible again (user returns from app)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also try the blur/focus approach as fallback
    const handleBlur = () => {
      setTimeout(() => {
        clearTimeout(timeoutId)
        window.removeEventListener('blur', handleBlur)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        resolve()
      }, 100)
    }
    
    window.addEventListener('blur', handleBlur, { once: true })

    // Attempt to open the deeplink
    try {
      window.location.href = deeplink
    } catch (error) {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      reject(error)
    }
  })
}

/**
 * Check if a wallet app is likely installed (heuristic approach)
 */
export const isWalletAppInstalled = async (walletName: string): Promise<boolean> => {
  if (!isMobile()) {
    return false
  }

  // This is a heuristic approach - we can't definitively know if an app is installed
  // without trying to open it, but we can make educated guesses

  return new Promise((resolve) => {
    let deeplink: string

    switch (walletName.toLowerCase()) {
      case 'phantom':
        deeplink = 'phantom://browse'
        break
      case 'solflare':
        deeplink = 'solflare://browse'
        break
      default:
        resolve(false)
        return
    }

    // Create an invisible iframe to test if the protocol is supported
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    document.body.appendChild(iframe)

    const timeout = setTimeout(() => {
      document.body.removeChild(iframe)
      resolve(false)
    }, 1000)

    try {
      iframe.src = deeplink
      setTimeout(() => {
        clearTimeout(timeout)
        document.body.removeChild(iframe)
        resolve(true)
      }, 500)
    } catch (error) {
      clearTimeout(timeout)
      document.body.removeChild(iframe)
      resolve(false)
    }
  })
}

/**
 * Get mobile-specific connection instructions
 */
export const getMobileConnectionInstructions = (walletName: string): string => {
  switch (walletName.toLowerCase()) {
    case 'phantom':
      return 'Make sure you have the Phantom app installed. We\'ll open it for you to approve the connection.'
    case 'solflare':
      return 'Make sure you have the Solflare app installed. We\'ll open it for you to approve the connection.'
    default:
      return `Make sure you have the ${walletName} app installed. We'll open it for you to approve the connection.`
  }
}

/**
 * Handle mobile wallet connection with better UX
 */
export const connectMobileWallet = async (
  walletName: string, 
  options: DeeplinkOptions = {}
): Promise<void> => {
  console.log(`Initiating mobile connection for ${walletName}`)

  try {
    // Clear any existing wallet connection state to prevent issues
    localStorage.removeItem('walletName')
    
    // Open the wallet app
    await openWalletApp(walletName, options)
    
    console.log(`Successfully opened ${walletName} app`)
    
  } catch (error) {
    console.error(`Failed to connect to ${walletName} on mobile:`, error)
    throw error
  }
}

// Generate a new dapp keypair for encryption
export const generateDappKeyPair = (): nacl.BoxKeyPair => {
  return nacl.box.keyPair()
}

// Build the connect deeplink URL
export const buildConnectUrl = (
  dappKeyPair: nacl.BoxKeyPair,
  redirectUrl: string,
  cluster: string = 'devnet'
): string => {
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
    cluster,
    app_url: window.location.origin,
    redirect_link: redirectUrl,
  })

  return `https://phantom.app/ul/v1/connect?${params.toString()}`
}

// Decrypt payload from Phantom
export const decryptPayload = (
  data: string,
  nonce: string,
  sharedSecret: Uint8Array
): any => {
  const decryptedData = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  )
  
  if (!decryptedData) {
    throw new Error('Unable to decrypt data')
  }
  
  return JSON.parse(Buffer.from(decryptedData).toString('utf8'))
}

// Encrypt payload to send to Phantom
export const encryptPayload = (
  payload: any,
  sharedSecret: Uint8Array
): [Uint8Array, Uint8Array] => {
  const nonce = nacl.randomBytes(24)
  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret
  )
  return [nonce, encryptedPayload]
}

// Build disconnect URL
export const buildDisconnectUrl = (
  dappKeyPair: nacl.BoxKeyPair,
  sharedSecret: Uint8Array,
  session: string,
  redirectUrl: string
): string => {
  const payload = { session }
  const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret)
  
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
    nonce: bs58.encode(nonce),
    redirect_link: redirectUrl,
    payload: bs58.encode(encryptedPayload),
  })

  return `https://phantom.app/ul/v1/disconnect?${params.toString()}`
}

// Parse connection response from Phantom
export const parseConnectResponse = (
  url: string,
  dappKeyPair: nacl.BoxKeyPair
): { connectData: ConnectResponse; sharedSecret: Uint8Array } => {
  const urlObj = new URL(url)
  const params = urlObj.searchParams

  if (params.get('errorCode')) {
    throw new Error(params.get('errorMessage') || 'Connection failed')
  }

  const phantomEncryptionPublicKey = params.get('phantom_encryption_public_key')
  const data = params.get('data')
  const nonce = params.get('nonce')

  if (!phantomEncryptionPublicKey || !data || !nonce) {
    throw new Error('Invalid response from Phantom')
  }

  // Generate shared secret using Diffie-Hellman
  const sharedSecret = nacl.box.before(
    bs58.decode(phantomEncryptionPublicKey),
    dappKeyPair.secretKey
  )

  // Decrypt the response data
  const connectData = decryptPayload(data, nonce, sharedSecret)

  return { connectData, sharedSecret }
}

// Check if URL is a Phantom response
export const isPhantomResponse = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.includes('phantom')
  } catch {
    return false
  }
}

// Create redirect URL for the current page
export const createRedirectUrl = (action: string): string => {
  const baseUrl = window.location.origin + window.location.pathname
  return `${baseUrl}?phantom_action=${action}`
} 