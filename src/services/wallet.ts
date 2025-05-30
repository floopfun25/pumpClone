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

// Wallet types
export interface WalletAdapter {
  name: string
  icon: string
  url: string
  adapter: BaseMessageSignerWalletAdapter
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
    adapter: new PhantomWalletAdapter()
  },
  {
    name: 'Solflare',
    icon: 'https://solflare.com/assets/logo.svg',
    url: 'https://solflare.com/',
    adapter: new SolflareWalletAdapter()
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

  // Computed properties
  get wallet() {
    return this.currentWallet.value
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

  get balance() {
    return this._balance.value
  }

  get walletAddress() {
    return this._publicKey.value?.toBase58() || null
  }

  // Get available wallets
  getAvailableWallets(): WalletAdapter[] {
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
        // Connect to specific wallet
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

      // Set up event listeners
      this.setupWalletListeners(walletAdapter)

      // Attempt connection
      await walletAdapter.connect()

      this.currentWallet.value = walletAdapter
      this._publicKey.value = walletAdapter.publicKey

      // Update balance
      await this.updateBalance()

      console.log('Wallet connected:', walletAdapter.name)
      
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
        this.removeWalletListeners(this.currentWallet.value as any)
        await this.currentWallet.value.disconnect()
      }

      this.cleanup()
      console.log('Wallet disconnected')

    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
      throw new WalletDisconnectedError((error as Error)?.message || 'Failed to disconnect wallet')
    } finally {
      this._disconnecting.value = false
    }
  }

  // Sign transaction
  async signTransaction(transaction: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    if (!this.currentWallet.value || !this.connected) {
      throw new WalletNotConnectedError()
    }

    try {
      return await this.currentWallet.value.signTransaction(transaction)
    } catch (error) {
      console.error('Failed to sign transaction:', error)
      throw error
    }
  }

  // Sign all transactions
  async signAllTransactions(transactions: (Transaction | VersionedTransaction)[]): Promise<(Transaction | VersionedTransaction)[]> {
    if (!this.currentWallet.value || !this.connected) {
      throw new WalletNotConnectedError()
    }

    try {
      return await this.currentWallet.value.signAllTransactions(transactions)
    } catch (error) {
      console.error('Failed to sign transactions:', error)
      throw error
    }
  }

  // Sign message
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.currentWallet.value || !this.connected) {
      throw new WalletNotConnectedError()
    }

    try {
      return await this.currentWallet.value.signMessage(message)
    } catch (error) {
      console.error('Failed to sign message:', error)
      throw error
    }
  }

  // Send transaction
  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    options?: SendOptions
  ): Promise<string> {
    if (!this.currentWallet.value || !this.connected) {
      throw new WalletNotConnectedError()
    }

    try {
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash()
      
      if (transaction instanceof Transaction) {
        transaction.recentBlockhash = blockhash
        transaction.feePayer = this._publicKey.value!
      }

      // Sign transaction
      const signedTransaction = await this.signTransaction(transaction)

      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        signedTransaction.serialize(),
        options
      )

      // Confirm transaction
      await this.connection.confirmTransaction(signature)

      console.log('Transaction sent:', signature)
      
      // Update balance after transaction
      await this.updateBalance()
      
      return signature

    } catch (error) {
      console.error('Failed to send transaction:', error)
      throw error
    }
  }

  // Update wallet balance
  async updateBalance(): Promise<void> {
    if (!this._publicKey.value) return

    try {
      const balance = await this.connection.getBalance(this._publicKey.value)
      this._balance.value = balance / LAMPORTS_PER_SOL
    } catch (error) {
      console.error('Failed to update balance:', error)
    }
  }

  // Auto-reconnect on page load
  async autoConnect(): Promise<void> {
    const lastWalletName = localStorage.getItem('walletName')
    if (!lastWalletName) return

    try {
      await this.connect(lastWalletName)
    } catch (error) {
      console.log('Auto-connect failed:', error)
      localStorage.removeItem('walletName')
    }
  }

  // Setup wallet event listeners
  private setupWalletListeners(wallet: BaseMessageSignerWalletAdapter): void {
    wallet.on('connect', this.handleConnect.bind(this))
    wallet.on('disconnect', this.handleDisconnect.bind(this))
    wallet.on('error', this.handleError.bind(this))
  }

  // Remove wallet event listeners
  private removeWalletListeners(wallet: BaseMessageSignerWalletAdapter): void {
    wallet.off('connect', this.handleConnect.bind(this))
    wallet.off('disconnect', this.handleDisconnect.bind(this))
    wallet.off('error', this.handleError.bind(this))
  }

  // Handle wallet connect event
  private handleConnect(): void {
    if (this.currentWallet.value) {
      this._publicKey.value = this.currentWallet.value.publicKey
      localStorage.setItem('walletName', this.currentWallet.value.name)
      this.updateBalance()
    }
  }

  // Handle wallet disconnect event
  private handleDisconnect(): void {
    this.cleanup()
    localStorage.removeItem('walletName')
  }

  // Handle wallet error event
  private handleError(error: Error): void {
    console.error('Wallet error:', error)
  }

  // Cleanup wallet state
  private cleanup(): void {
    this.currentWallet.value = null
    this._publicKey.value = null
    this._balance.value = 0
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

// Create singleton instance
export const walletService = new WalletService()

// Helper function to format wallet address
export function formatWalletAddress(address: string | null, length = 4): string {
  if (!address) return ''
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

// Helper function to format SOL amount
export function formatSOL(amount: number, decimals = 4): string {
  return `${amount.toFixed(decimals)} SOL`
} 