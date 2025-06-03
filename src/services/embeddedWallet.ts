import { Magic } from 'magic-sdk'
import { SolanaExtension } from '@magic-ext/solana'
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  VersionedTransaction
} from '@solana/web3.js'
import type { SendOptions, TransactionVersion, Commitment } from '@solana/web3.js'
import { 
  BaseWalletAdapter,
  WalletReadyState,
  WalletNotConnectedError,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletSignTransactionError
} from '@solana/wallet-adapter-base'
import type { WalletName } from '@solana/wallet-adapter-base'
import { solanaConfig } from '@/config'

export interface EmbeddedWalletUser {
  email?: string
  phoneNumber?: string
  publicKey: string
  didToken?: string
}

export class MagicWalletAdapter extends BaseWalletAdapter {
  name = 'Magic' as WalletName<'Magic'>
  url = 'https://magic.link'
  icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2ODUyRkYiLz4KPHBhdGggZD0iTTEwLjUgMTFWMjFIMTMuNVYxNEgxOC41VjIxSDIxLjVWMTFIMTAuNVoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo='
  supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set(['legacy', 0])
  
  private _magic: any = null // Using any to avoid complex Magic typing issues
  private _connecting = false
  private _connected = false
  private _publicKey: PublicKey | null = null
  private _user: EmbeddedWalletUser | null = null

  constructor() {
    super()
  }

  get publicKey(): PublicKey | null {
    return this._publicKey
  }

  get readyState(): WalletReadyState {
    return WalletReadyState.Installed
  }

  get connecting(): boolean {
    return this._connecting
  }

  get connected(): boolean {
    return this._connected
  }

  get user(): EmbeddedWalletUser | null {
    return this._user
  }

  private _initializeMagic(): void {
    if (this._magic) return

    // Use your Magic publishable key - you'll need to get this from magic.link dashboard
    const magicApiKey = process.env.VITE_MAGIC_PUBLISHABLE_KEY || 'pk_live_F7B6F1F0A5B5E1C8' // Replace with your key
    
    this._magic = new Magic(magicApiKey, {
      extensions: {
        solana: new SolanaExtension({
          rpcUrl: solanaConfig.rpcUrl,
        }),
      },
    })
  }

  async connect(): Promise<void> {
    try {
      this._connecting = true
      this._initializeMagic()

      if (!this._magic?.solana) {
        throw new WalletConnectionError('Magic not initialized')
      }

      // Check if user is already logged in
      const isLoggedIn = await this._magic.user.isLoggedIn()
      
      let accounts: string[]
      
      if (isLoggedIn) {
        // Get existing account
        accounts = await this._magic.solana.getAccount()
      } else {
        // Show login modal (email/SMS)
        accounts = await this._magic.solana.requestAccount()
      }

      if (!accounts || accounts.length === 0) {
        throw new WalletConnectionError('No account found')
      }

      // Get user metadata
      const userMetadata = await this._magic.user.getInfo()
      
      this._publicKey = new PublicKey(accounts[0])
      this._user = {
        email: userMetadata.email || undefined,
        phoneNumber: userMetadata.phoneNumber || undefined,
        publicKey: accounts[0],
        didToken: await this._magic.user.getIdToken(),
      }
      
      this._connected = true
      this.emit('connect', this._publicKey)
      
    } catch (error: any) {
      this.emit('error', error)
      throw new WalletConnectionError(error?.message || 'Failed to connect')
    } finally {
      this._connecting = false
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this._magic) {
        await this._magic.user.logout()
      }
    } catch (error: any) {
      this.emit('error', error)
      throw new WalletDisconnectionError(error?.message || 'Failed to disconnect')
    } finally {
      this._publicKey = null
      this._user = null
      this._connected = false
      this.emit('disconnect')
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    try {
      if (!this._connected || !this._magic?.solana) {
        throw new WalletNotConnectedError()
      }

      const signedTransaction = await this._magic.solana.signTransaction(transaction)
      return signedTransaction as T
      
    } catch (error: any) {
      this.emit('error', error)
      throw new WalletSignTransactionError(error?.message || 'Failed to sign transaction')
    }
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    if (!this._connected || !this._magic?.solana) {
      throw new WalletNotConnectedError()
    }

    try {
      const signedTransactions = await Promise.all(
        transactions.map(transaction => this.signTransaction(transaction))
      )
      return signedTransactions
    } catch (error: any) {
      this.emit('error', error)
      throw new WalletSignTransactionError(error?.message || 'Failed to sign transactions')
    }
  }

  async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ): Promise<string> {
    try {
      if (!this._connected || !this._magic?.solana) {
        throw new WalletNotConnectedError()
      }

      const signedTransaction = await this.signTransaction(transaction)
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), options)
      return signature
      
    } catch (error: any) {
      this.emit('error', error)
      throw new WalletSignTransactionError(error?.message || 'Failed to send transaction')
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      if (!this._connected || !this._magic?.solana) {
        throw new WalletNotConnectedError()
      }

      const signature = await this._magic.solana.signMessage(message)
      return new Uint8Array(signature.signature)
      
    } catch (error: any) {
      this.emit('error', error)
      throw new WalletSignTransactionError(error?.message || 'Failed to sign message')
    }
  }

  // Helper method to check if user can sign transactions (useful for UI)
  get canSign(): boolean {
    return this._connected && !!this._magic?.solana
  }

  // Helper method to get user's email for display
  get userEmail(): string | null {
    return this._user?.email || null
  }

  // Helper method to get user's phone for display  
  get userPhone(): string | null {
    return this._user?.phoneNumber || null
  }
} 