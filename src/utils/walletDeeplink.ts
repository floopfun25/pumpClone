import { isMobile, isIOS, isAndroid, getPhantomDownloadUrl } from './mobile'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Buffer } from 'buffer'

// Ensure Buffer is available globally for crypto operations
if (typeof window !== 'undefined' && !window.Buffer) {
  (window as any).Buffer = Buffer
}

// Robust debug function that works in all contexts
const debugLog = (message: string, forceAlert = false) => {
  // Always log to console for development
  console.log(message)
  
  // Try to use global debug function if available (set by main app)
  if (typeof window !== 'undefined' && (window as any).globalShowDebug) {
    try {
      (window as any).globalShowDebug(message)
      return
    } catch (error) {
      console.warn('Global debug function failed:', error)
    }
  }
  
  // Fallback to alert
  alert(message)
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
      // Use location.href to maintain tab context
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
  // Ensure we have the proper protocol for deep linking
  const baseUrl = isAndroid() 
    ? 'https://phantom.app/ul/v1/connect'  // Universal link for Android
    : 'phantom://connect'                   // Custom scheme for iOS
    
  // Add return parameter to redirect URL
  const returnUrl = new URL(redirectUrl)
  returnUrl.searchParams.set('phantom_return', 'true')
  
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
    cluster,
    app_url: window.location.origin,
    redirect_link: returnUrl.toString(),
  })

  return `${baseUrl}?${params.toString()}`
}

// Decrypt payload from Phantom
export const decryptPayload = (
  data: string,
  nonce: string,
  sharedSecret: Uint8Array
): any => {
  let debugInfo = '[DEBUG] DECRYPT PAYLOAD DEBUG:\n'
  debugInfo += `  data: ${data}\n`
  debugInfo += `  nonce: ${nonce}\n`
  debugInfo += `  sharedSecret length: ${sharedSecret.length}\n\n`
  
  try {
    const decodedData = bs58.decode(data)
    const decodedNonce = bs58.decode(nonce)
    
    debugInfo += `  decoded data length: ${decodedData.length}\n`
    debugInfo += `  decoded nonce length: ${decodedNonce.length}\n\n`
    
    const decryptedData = nacl.box.open.after(
      decodedData,
      decodedNonce,
      sharedSecret
    )
    
    if (!decryptedData) {
      debugInfo += '[ERROR] DECRYPTION FAILED in decryptPayload:\n'
      debugInfo += `  nacl.box.open.after returned: ${decryptedData}\n`
      debugInfo += '\n[DIAGNOSTIC] DIAGNOSTIC INFO:\n'
      debugInfo += `  Shared secret (first 8 bytes): ${Array.from(sharedSecret.slice(0, 8)).join(',')}\n`
      debugInfo += `  Nonce (first 8 bytes): ${Array.from(decodedNonce.slice(0, 8)).join(',')}\n`
      debugInfo += `  Data (first 8 bytes): ${Array.from(decodedData.slice(0, 8)).join(',')}\n`
      
      debugLog(debugInfo, true)
      throw new Error('Unable to decrypt data')
    }
    
    debugInfo += '[SUCCESS] DECRYPTION SUCCESSFUL in decryptPayload:\n'
    debugInfo += `  decrypted data length: ${decryptedData.length}\n`
    
    const result = JSON.parse(Buffer.from(decryptedData).toString('utf8'))
    debugInfo += `  parsed JSON: ${JSON.stringify(result, null, 2)}\n`
    
    debugLog(debugInfo, true)
    return result
    
  } catch (error) {
    debugInfo += `\n[ERROR] ERROR in decryptPayload:\n`
    debugInfo += `  Error: ${error instanceof Error ? error.message : String(error)}\n`
    debugLog(debugInfo, true)
    throw error
  }
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
  let debugInfo = '[DEBUG] PARSE CONNECT RESPONSE DEBUG:\n'
  debugInfo += `URL: ${url}\n\n`
  
  const urlObj = new URL(url)
  const params = urlObj.searchParams

  debugInfo += '[DEBUG] ALL URL SEARCH PARAMS:\n'
  for (const [key, value] of params.entries()) {
    debugInfo += `  ${key}: ${value}\n`
  }
  debugInfo += '\n'

  if (params.get('errorCode')) {
    debugInfo += `[ERROR] ERROR FROM PHANTOM:\n`
    debugInfo += `  errorCode: ${params.get('errorCode')}\n`
    debugInfo += `  errorMessage: ${params.get('errorMessage')}\n`
    debugLog(debugInfo, true)
    throw new Error(params.get('errorMessage') || 'Connection failed')
  }

  const phantomEncryptionPublicKey = params.get('phantom_encryption_public_key')
  const data = params.get('data')
  const nonce = params.get('nonce')

  debugInfo += '[INFO] EXTRACTED PARAMETERS:\n'
  debugInfo += `  phantomEncryptionPublicKey: ${phantomEncryptionPublicKey}\n`
  debugInfo += `  data: ${data}\n`
  debugInfo += `  nonce: ${nonce}\n\n`

  if (!phantomEncryptionPublicKey || !data || !nonce) {
    debugInfo += '[ERROR] MISSING REQUIRED PARAMETERS:\n'
    debugInfo += `  phantomEncryptionPublicKey exists: ${!!phantomEncryptionPublicKey}\n`
    debugInfo += `  data exists: ${!!data}\n`
    debugInfo += `  nonce exists: ${!!nonce}\n`
    debugLog(debugInfo, true)
    throw new Error('Invalid response from Phantom')
  }

  try {
    // Generate shared secret using Diffie-Hellman
    debugInfo += '[INFO] GENERATING SHARED SECRET:\n'
    debugInfo += `  dappKeyPair.secretKey length: ${dappKeyPair.secretKey.length}\n`
    
    const decodedPhantomKey = bs58.decode(phantomEncryptionPublicKey)
    debugInfo += `  decoded phantom key length: ${decodedPhantomKey.length}\n`
    
    const sharedSecret = nacl.box.before(
      decodedPhantomKey,
      dappKeyPair.secretKey
    )
    debugInfo += `  shared secret length: ${sharedSecret.length}\n\n`

    // Decrypt the response data
    debugInfo += '[INFO] ATTEMPTING DECRYPTION:\n'
    debugInfo += `  data to decode: ${data}\n`
    debugInfo += `  nonce to decode: ${nonce}\n`
    
    const decodedData = bs58.decode(data)
    const decodedNonce = bs58.decode(nonce)
    
    debugInfo += `  decoded data length: ${decodedData.length}\n`
    debugInfo += `  decoded nonce length: ${decodedNonce.length}\n\n`
    
    const decryptedData = nacl.box.open.after(
      decodedData,
      decodedNonce,
      sharedSecret
    )
    
    if (!decryptedData) {
      debugInfo += '[ERROR] DECRYPTION FAILED:\n'
      debugInfo += `  nacl.box.open.after returned: ${decryptedData}\n`
      debugInfo += `  This means the shared secret, nonce, or data is incorrect\n`
      
      // Try to provide more diagnostic info
      debugInfo += '\n[DIAGNOSTIC] DIAGNOSTIC INFO:\n'
      debugInfo += `  Shared secret (first 8 bytes): ${Array.from(sharedSecret.slice(0, 8)).join(',')}\n`
      debugInfo += `  Nonce (first 8 bytes): ${Array.from(decodedNonce.slice(0, 8)).join(',')}\n`
      debugInfo += `  Data (first 8 bytes): ${Array.from(decodedData.slice(0, 8)).join(',')}\n`
      
      debugLog(debugInfo, true)
      throw new Error('Unable to decrypt data')
    }
    
    debugInfo += '[SUCCESS] DECRYPTION SUCCESSFUL:\n'
    debugInfo += `  decrypted data length: ${decryptedData.length}\n`
    
    const connectData = JSON.parse(Buffer.from(decryptedData).toString('utf8'))
    debugInfo += `  parsed JSON: ${JSON.stringify(connectData, null, 2)}\n`
    
    debugLog(debugInfo, true)
    return { connectData, sharedSecret }
    
  } catch (error) {
    debugInfo += `\n[ERROR] ERROR DURING PARSING:\n`
    debugInfo += `  Error: ${error instanceof Error ? error.message : String(error)}\n`
    debugLog(debugInfo, true)
    throw error
  }
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
  // CRITICAL: Return the exact current URL without any modifications
  // This ensures Phantom returns to the same tab instead of opening a new one
  const currentUrl = window.location.href
  
  return currentUrl
}