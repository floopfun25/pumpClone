// Browser polyfills for Node.js APIs used by Solana libraries
import { Buffer } from 'buffer'

// Polyfill Buffer globally
if (typeof window !== 'undefined') {
  // Set up global references
  window.global = window.global || window
  window.Buffer = window.Buffer || Buffer
  
  // Also set on globalThis
  if (typeof globalThis !== 'undefined') {
    ;(globalThis as any).Buffer = Buffer
    ;(globalThis as any).global = window
  }
  
  // Set process.env for libraries that expect it
  if (typeof window.process === 'undefined') {
    window.process = { env: {} } as any
  }
} 