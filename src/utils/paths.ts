/**
 * Path utilities for handling asset paths in different environments
 */

/**
 * Get the correct base path for the application
 * This handles the difference between development and production environments
 */
export function getBasePath(): string {
  console.log('🔍 Environment check:', {
    DEV: import.meta.env.DEV,
    BASE_URL: import.meta.env.BASE_URL,
    VITE_BASE_URL: import.meta.env.VITE_BASE_URL,
    MODE: import.meta.env.MODE
  })
  
  // Check if VITE_BASE_URL is set from environment
  if (import.meta.env.VITE_BASE_URL) {
    console.log('✅ Using VITE_BASE_URL:', import.meta.env.VITE_BASE_URL)
    return import.meta.env.VITE_BASE_URL
  }
  
  // Check if Vite's BASE_URL is available
  if (import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/') {
    console.log('✅ Using BASE_URL:', import.meta.env.BASE_URL)
    return import.meta.env.BASE_URL
  }
  
  // In development, use root path
  if (import.meta.env.DEV) {
    console.log('✅ Using DEV path: /')
    return '/'
  }
  
  // Fallback for production (GitHub Pages)
  // This should match the base path in vite.config.ts
  console.log('✅ Using fallback path: /pumpClone/')
  return '/pumpClone/'
}

/**
 * Get the correct path for an asset
 * @param assetPath - The relative path to the asset (e.g., 'images/token-fallback.svg')
 * @returns The full path to the asset
 */
export function getAssetPath(assetPath: string): string {
  const basePath = getBasePath()
  // Remove leading slash from assetPath if present to avoid double slashes
  const cleanAssetPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
  const fullPath = `${basePath}${cleanAssetPath}`
  console.log('📁 Asset path generated:', {
    input: assetPath,
    basePath,
    cleanAssetPath,
    fullPath
  })
  return fullPath
}

/**
 * Get the fallback image path for tokens
 */
export function getTokenFallbackImage(): string {
  const path = getAssetPath('images/token-fallback.svg')
  console.log('🔍 Token fallback image path:', path, 'DEV mode:', import.meta.env.DEV)
  return path
}

/**
 * Get the fallback image path for wallets
 */
export function getWalletFallbackImage(): string {
  return getAssetPath('images/wallet-fallback.svg')
}

/**
 * Get the path for a token image
 * @param imageName - The image file name
 */
export function getTokenImagePath(imageName: string): string {
  return getAssetPath(`images/tokens/${imageName}`)
} 