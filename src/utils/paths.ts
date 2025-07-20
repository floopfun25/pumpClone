/**
 * Path utilities for handling asset paths in different environments
 */

/**
 * Get the correct base path for the application
 * This handles the difference between development and production environments
 */
export function getBasePath(): string {
  // Check if VITE_BASE_PATH is set from environment
  if (import.meta.env.VITE_BASE_PATH) {
    return import.meta.env.VITE_BASE_PATH
  }
  
  // Check if Vite's BASE_URL is available
  if (import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/') {
    return import.meta.env.BASE_URL
  }
  
  // In development, use root path
  if (import.meta.env.DEV) {
    return '/'
  }
  
  // Fallback for production (GitHub Pages)
  return '/pumpClone/'
}

/**
 * Get the correct path for an asset
 * @param assetPath - The relative path to the asset (e.g., 'images/token-fallback.svg')
 * @returns The full path to the asset
 */
export function getAssetPath(assetPath: string): string {
  const basePath = getBasePath()
  // If assetPath already contains the base path, return it as is
  if (assetPath.startsWith(basePath)) {
    return assetPath
  }
  // Remove leading slash from assetPath if present to avoid double slashes
  const cleanAssetPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
  const fullPath = `${basePath}${cleanAssetPath}`
  return fullPath
}

/**
 * Get the fallback image path for tokens
 */
export function getTokenFallbackImage(): string {
  return getAssetPath('images/token-fallback.svg')
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