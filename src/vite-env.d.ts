/// <reference types="vite/client" />

// Global type declarations for Node.js polyfills
declare global {
  interface Window {
    global: typeof window
    Buffer: typeof import('buffer').Buffer
    process: {
      env: Record<string, string | undefined>
    }
  }
  
  const global: typeof window
  const Buffer: typeof import('buffer').Buffer
  
  namespace NodeJS {
    interface Process {
      env: Record<string, string | undefined>
    }
  }
}

export {} 