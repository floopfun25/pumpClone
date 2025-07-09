// Use CDN Supabase client to bypass bundling issues
const { createClient } = (window as any).__SUPABASE_CDN__ || require('@supabase/supabase-js')
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfig } from '@/config'

// Database type definitions for type safety
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          wallet_address: string
          username: string | null
          avatar_url: string | null
          bio: string | null
          twitter_handle: string | null
          telegram_handle: string | null
          created_at: string
          updated_at: string
          is_verified: boolean
          total_volume_traded: number
          tokens_created: number
          reputation_score: number
        }
        Insert: {
          id?: string
          wallet_address: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          twitter_handle?: string | null
          telegram_handle?: string | null
          created_at?: string
          updated_at?: string
          is_verified?: boolean
          total_volume_traded?: number
          tokens_created?: number
          reputation_score?: number
        }
        Update: {
          id?: string
          wallet_address?: string
          username?: string | null
          avatar_url?: string | null
          bio?: string | null
          twitter_handle?: string | null
          telegram_handle?: string | null
          created_at?: string
          updated_at?: string
          is_verified?: boolean
          total_volume_traded?: number
          tokens_created?: number
          reputation_score?: number
        }
      }
      tokens: {
        Row: {
          id: string
          mint_address: string
          name: string
          symbol: string
          description: string | null
          image_url: string | null
          metadata_uri: string | null
          creator_id: string
          total_supply: number
          decimals: number
          dev_share_percentage: number
          dev_tokens_amount: number
          lock_duration_days: number | null
          locked_tokens_amount: number
          current_price: number
          market_cap: number
          volume_24h: number
          holders_count: number
          status: string
          graduation_threshold: number
          graduated_at: string | null
          created_at: string
          updated_at: string
          website: string | null
          twitter: string | null
          telegram: string | null
          discord: string | null
          last_trade_at: string | null
          bonding_curve_progress: number
          tags: string[]
          is_nsfw: boolean
          is_featured: boolean
        }
        Insert: Omit<Database['public']['Tables']['tokens']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tokens']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          signature: string
          token_id: string
          user_id: string
          transaction_type: string
          sol_amount: number
          token_amount: number
          price_per_token: number | null
          bonding_curve_price: number | null
          slippage_percentage: number | null
          platform_fee: number
          status: string
          block_time: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
    }
  }
}

// Enhanced Supabase client creation with authentication support
function createSupabaseClient(): SupabaseClient<Database> {
  // Environment detection
  const isGitHubPages = window.location.hostname.includes('github.io')
  const isHTTPS = window.location.protocol === 'https:'
  const hasWebCrypto = !!(window.crypto && window.crypto.subtle)
  
  // Validate configuration
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.error('❌ Missing Supabase configuration:', {
      url: !!supabaseConfig.url,
      anonKey: !!supabaseConfig.anonKey
    })
    throw new Error('Missing Supabase configuration - check environment variables')
  }
  
  // Validate URL format
  try {
    new URL(supabaseConfig.url)
  } catch (error) {
    console.error('❌ Invalid Supabase URL format:', supabaseConfig.url)
    throw new Error('Invalid Supabase URL format')
  }
  
  try {
    // Use CDN version if available, otherwise fall back to bundled
    const clientFactory = (window as any).__SUPABASE_CDN__?.createClient || createClient
    
    if (!clientFactory) {
      throw new Error('Supabase createClient not available from CDN or bundle')
    }
    
    // Create the client with minimal configuration to avoid headers issues
    const client = clientFactory(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Disable to avoid URL parsing issues
        flowType: 'implicit' as const,
        debug: false
      },
      // Add proper headers for Supabase to work correctly
      global: {
        headers: {
          'x-client-info': 'floppfun-webapp@1.0.0',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    })
    
    return client
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    
    // Try fallback with even more minimal configuration
    try {
      const fallbackClient = createClient(supabaseConfig.url, supabaseConfig.anonKey)
      return fallbackClient
    } catch (fallbackError) {
      console.error('❌ Fallback client creation also failed:', fallbackError)
      throw new Error(`Failed to initialize Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Create and export the client
export const supabase = createSupabaseClient()

// Wallet-based authentication methods
export class SupabaseAuth {
  /**
   * Sign in with wallet address using Supabase Anonymous Auth
   * Creates an authenticated user session without requiring email validation
   */
  static async signInWithWallet(walletAddress: string): Promise<{ user: any; session: any }> {
    try {
      // Validate wallet address parameter
      if (!walletAddress || typeof walletAddress !== 'string') {
        throw new Error(`Invalid wallet address: ${walletAddress}`)
      }
      
      console.log('🔑 Starting wallet authentication for:', walletAddress.slice(0, 8) + '...')
      
      // First, try to find an existing user profile with this wallet address
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();
        
      if (findError && findError.code !== 'PGRST116') {
        // PGRST116: 'exact-one-row-not-found' which is okay, means no user exists
        console.error('Error finding user:', findError);
        throw findError;
      }
      
      // If a user profile exists, we need to make sure we're signed in as them.
      if (existingUser) {
        const { data: { session } } = await supabase.auth.getSession();
        
        // If we're already signed in as the correct user, we're done.
        if (session && session.user?.id === existingUser.id) {
          console.log('✅ Already signed in as the correct user.');
          return { user: session.user, session };
        }
        
        // If we are signed in as someone else, or not at all, sign out first.
        if (session) {
          await supabase.auth.signOut();
        }

        // Now, sign in anonymously. Supabase will handle linking if the user already exists
        // based on its internal mechanisms, but we've verified they exist in our public table.
        // This flow ensures we have a valid session for an existing user profile.
      }
      
      // Sign out any lingering session before creating a new one
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        console.log('🚪 Signing out existing session before new anonymous login');
        await supabase.auth.signOut();
      }
      
      console.log('🆕 Creating new anonymous session...')
      
      // Create anonymous user with wallet address in metadata
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            wallet_address: walletAddress,
            username: `user_${walletAddress.slice(0, 6)}`,
            created_via: 'wallet_connection'
          }
        }
      })
      
      console.log('Supabase auth response:', { data, error }) // Debug what we get back
      
      if (error) {
        console.error('❌ Supabase auth error:', error)
        throw error
      }
      
      // Check if data exists first
      if (!data) {
        throw new Error('Supabase returned null data - Anonymous auth may not be enabled')
      }
      
      if (!data.user || !data.session) {
        throw new Error('Failed to create anonymous auth session - missing user or session')
      }
      
      console.log('✅ Anonymous auth successful, creating user profile...')
      
      // Now, upsert the user profile in the public.users table
      const userProfile = await SupabaseService.upsertUser({
        id: data.user.id,
        wallet_address: walletAddress,
        username: `user_${walletAddress.slice(0, 6)}`
      })

      return { user: { ...data.user, ...userProfile }, session: data.session }
    } catch (error) {
      console.error('Failed to sign in with wallet:', error)
      throw error
    }
  }
  
  /**
   * Sign out from Supabase auth
   */
  static async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      console.error('❌ Sign out failed:', error)
      throw error
    }
  }
  
  /**
   * Get current auth session
   */
  static async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    } catch (error) {
      console.error('Failed to get auth session:', error)
      return null
    }
  }
  
  /**
   * Get current auth user
   */
  static async getUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    } catch (error) {
      console.error('Failed to get auth user:', error)
      return null
    }
  }
  
  /**
   * Get wallet address from current user metadata
   */
  static getWalletAddressFromUser(user: any): string | null {
    return user?.user_metadata?.wallet_address || null
  }
  
  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session)
    })
  }
}

// Singleton service instance
const SupabaseAuthService = new SupabaseAuth()
export { SupabaseAuthService }

// Utility functions for common database operations
export class SupabaseService {
  /**
   * Get user by wallet address
   * Used for authentication and profile loading
   */
  static async getUserByWallet(walletAddress: string) {
    try {
      // First try exact match
      const { data: exactMatch, error: exactError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()

      if (exactMatch) {
        return exactMatch
      }

      // If no exact match and address seems truncated, try partial matching
      if (walletAddress.includes('...')) {
        console.log('🔍 Trying partial wallet address matching for:', walletAddress)
        
        const parts = walletAddress.split('...')
        if (parts.length === 2) {
          const prefix = parts[0]
          const suffix = parts[1]
          
          const { data: partialMatches, error: partialError } = await supabase
            .from('users')
            .select('*')
            .ilike('wallet_address', `${prefix}%${suffix}`)

          if (partialMatches && partialMatches.length > 0) {
            console.log('✅ Found partial match:', partialMatches[0])
            return partialMatches[0]
          }
        }
      }

      // If still no match, try to find by prefix only (first 4 chars)
      if (walletAddress.length >= 4) {
        const prefix = walletAddress.substring(0, 4)
        const { data: prefixMatches, error: prefixError } = await supabase
          .from('users')
          .select('*')
          .ilike('wallet_address', `${prefix}%`)

        if (prefixMatches && prefixMatches.length === 1) {
          console.log('✅ Found prefix match:', prefixMatches[0])
          return prefixMatches[0]
        } else if (prefixMatches && prefixMatches.length > 1) {
          console.log('⚠️ Multiple users found with same prefix:', prefixMatches)
        }
      }

      if (exactError && exactError.code !== 'PGRST116') {
        throw exactError
      }

      return null
    } catch (error) {
      console.error('Failed to get user by wallet:', error)
      return null
    }
  }
  
  /**
   * Create or update user profile
   * Used during wallet authentication
   */
  static async upsertUser(userData: Database['public']['Tables']['users']['Insert']) {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert(userData, {
          onConflict: 'wallet_address',
          ignoreDuplicates: false
        })
        .select()
        .single()
      
      if (error) {
        // We expect a 409 conflict if the user already exists, which is fine.
        if (error.code === '23505' || error.code === 'PGRST116') { 
          // 23505: unique_violation, PGRST116: 'exact-one-row-not-found'
          // In case of conflict, fetch the existing user.
          console.log('User already exists, fetching profile...');
          return SupabaseService.getUserByWallet(userData.wallet_address);
        }
        console.error('Failed to upsert user:', error)
        throw error
      }
      return data
    } catch (error) {
      console.error('Error in upsertUser:', error)
      throw error
    }
  }
  
  /**
   * Get tokens with pagination and filtering
   * Used for token listing and search
   */
  static async getTokens(options: {
    page?: number
    limit?: number
    sortBy?: 'created_at' | 'market_cap' | 'volume_24h'
    sortOrder?: 'asc' | 'desc'
    status?: string
    search?: string
  } = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc',
        status = 'active',
        search
      } = options
      
      let query = supabase
        .from('tokens')
        .select(`
          *,
          creator:users(id, username, wallet_address)
        `, { count: 'exact' })
        .eq('status', status)
      
      // Add search filter if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,symbol.ilike.%${search}%,description.ilike.%${search}%`)
      }
      
      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      
      // Apply pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)
      
      const { data, error, count } = await query
      
      if (error) throw error
      
      return {
        data: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: (count || 0) > page * limit
      }
    } catch (error) {
      console.error('Failed to get tokens:', error)
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasMore: false
      }
    }
  }
  
  /**
   * Get token by mint address
   * Used for token detail pages
   */
  static async getTokenByMint(mintAddress: string) {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          creator:users(id, username, wallet_address, avatar_url)
        `)
        .eq('mint_address', mintAddress)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to get token by mint:', error)
      return null
    }
  }

  /**
   * Get token by ID
   * Used for token lookups by database ID
   */
  static async getTokenById(tokenId: string) {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          creator:users(id, username, wallet_address, avatar_url)
        `)
        .eq('id', tokenId)
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to get token by ID:', error)
      return null
    }
  }
  
  /**
   * Get user's token holdings
   * Used for portfolio display
   */
  static async getUserHoldings(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_holdings')
        .select(`
          *,
          token:tokens(*)
        `)
        .eq('user_id', userId)
        .gt('amount', 0)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to get user holdings:', error)
      return []
    }
  }
  
  /**
   * Get recent transactions for a token
   * Used for trading activity display
   */
  static async getTokenTransactions(tokenId: string, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          user:users(id, username, wallet_address)
        `)
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Failed to get token transactions:', error)
      return []
    }
  }

  /**
   * Update token data
   * Used for updating price, market cap, and other token metrics
   */
  static async updateToken(tokenId: string, updateData: Partial<Database['public']['Tables']['tokens']['Update']>) {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Failed to update token:', error)
      return null
    }
  }
  
  /**
   * Subscribe to real-time token price updates
   * Used for live price feeds
   */
  static subscribeToTokenUpdates(tokenId: string, callback: (token: any) => void) {
    let isRealtimeActive = false
    let pollingInterval: NodeJS.Timeout | null = null
    let lastUpdate = 0

    const startPolling = () => {
      console.log('📊 Starting database polling for token:', tokenId)
      
      const poll = async () => {
        try {
          const token = await this.getTokenById(tokenId)
          if (token && new Date(token.updated_at).getTime() > lastUpdate) {
            lastUpdate = new Date(token.updated_at).getTime()
            callback(token)
          }
        } catch (error) {
          console.error('Error polling token data:', error)
        }
      }

      // Initial poll
      poll()
      
      // Poll every 3 seconds
      pollingInterval = setInterval(poll, 3000)
    }

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
        console.log('⏹️ Stopped polling for token:', tokenId)
      }
    }

    try {
      console.log('🔔 Attempting realtime subscription for token:', tokenId)
      
      const channel = supabase
        .channel(`token-updates-${tokenId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tokens',
            filter: `id=eq.${tokenId}`
          },
          (payload) => {
            console.log('📊 Received realtime token update:', payload)
            isRealtimeActive = true
            stopPolling() // Stop polling when realtime works
            callback(payload.new || payload)
          }
        )
        .subscribe((status, err) => {
          console.log('📡 Token subscription status:', status)
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime subscription active')
            isRealtimeActive = true
            stopPolling()
          } else if (status === 'CHANNEL_ERROR' || err) {
            console.log('⚠️ Realtime unavailable, falling back to polling')
            isRealtimeActive = false
            startPolling()
          }
        })

      // Start polling as backup (will stop if realtime works)
      setTimeout(() => {
        if (!isRealtimeActive) {
          startPolling()
        }
      }, 2000)

      return {
        unsubscribe: () => {
          channel.unsubscribe()
          stopPolling()
        }
      }
    } catch (error) {
      console.error('❌ Realtime failed, using polling mode:', error)
      startPolling()
      return {
        unsubscribe: () => stopPolling()
      }
    }
  }
  
  /**
   * Subscribe to real-time transaction updates
   * Used for live trading activity
   */
  static subscribeToTransactions(tokenId: string, callback: (transaction: any) => void) {
    let isRealtimeActive = false
    let pollingInterval: NodeJS.Timeout | null = null
    let lastTransactionTime = Date.now()

    const startTransactionPolling = () => {
      console.log('💳 Starting transaction polling for token:', tokenId)
      
      const pollTransactions = async () => {
        try {
          // Get recent transactions
          const transactions = await this.getTokenTransactions(tokenId, 10)
          const newTransactions = transactions.filter(tx => 
            new Date(tx.created_at).getTime() > lastTransactionTime
          )
          
          if (newTransactions.length > 0) {
            // Update last transaction time
            lastTransactionTime = Math.max(...newTransactions.map(tx => 
              new Date(tx.created_at).getTime()
            ))
            
            // Notify about each new transaction
            newTransactions.forEach(tx => callback(tx))
          }
        } catch (error) {
          console.error('Error polling transaction data:', error)
        }
      }

      // Initial poll
      pollTransactions()
      
      // Poll every 2 seconds for transactions
      pollingInterval = setInterval(pollTransactions, 2000)
    }

    const stopTransactionPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
        console.log('⏹️ Stopped transaction polling for token:', tokenId)
      }
    }

    try {
      console.log('🔔 Attempting realtime transaction subscription for:', tokenId)
      
      const channel = supabase
        .channel(`transactions-${tokenId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `token_id=eq.${tokenId}`
          },
          (payload) => {
            console.log('💳 Received realtime transaction update:', payload)
            isRealtimeActive = true
            stopTransactionPolling() // Stop polling when realtime works
            callback(payload.new || payload)
          }
        )
        .subscribe((status, err) => {
          console.log('📡 Transaction subscription status:', status)
          
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime transaction subscription active')
            isRealtimeActive = true
            stopTransactionPolling()
          } else if (status === 'CHANNEL_ERROR' || err) {
            console.log('⚠️ Realtime unavailable, falling back to transaction polling')
            isRealtimeActive = false
            startTransactionPolling()
          }
        })

      // Start polling as backup (will stop if realtime works)
      setTimeout(() => {
        if (!isRealtimeActive) {
          startTransactionPolling()
        }
      }, 2000)

      return {
        unsubscribe: () => {
          channel.unsubscribe()
          stopTransactionPolling()
        }
      }
    } catch (error) {
      console.error('❌ Realtime failed, using transaction polling mode:', error)
      startTransactionPolling()
      return {
        unsubscribe: () => stopTransactionPolling()
      }
    }
  }

  /**
   * Get dashboard statistics
   * Used for homepage stats display
   */
  static async getDashboardStats() {
    try {
      // Get total tokens count
      const { count: totalTokens, error: tokensError } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })

      if (tokensError) throw tokensError

      // Get total users count
      const { count: totalUsers, error: usersError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      if (usersError) throw usersError

      // Get graduated tokens count
      const { count: graduatedTokens, error: graduatedError } = await supabase
        .from('tokens')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'graduated')

      if (graduatedError) throw graduatedError

      // Get total volume (sum of all transaction amounts)
      const { data: volumeData, error: volumeError } = await supabase
        .from('transactions')
        .select('sol_amount')

      if (volumeError) throw volumeError

      const totalVolume = volumeData?.reduce((sum, tx) => sum + (tx.sol_amount || 0), 0) || 0
      const totalVolumeInSOL = totalVolume // Already in SOL

      return {
        totalTokens: totalTokens || 0,
        totalVolume: Math.round(totalVolumeInSOL),
        totalUsers: totalUsers || 0,
        graduatedTokens: graduatedTokens || 0
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      return {
        totalTokens: 0,
        totalVolume: 0,
        totalUsers: 0,
        graduatedTokens: 0
      }
    }
  }

  /**
   * Get user portfolio value and holdings
   * Used for portfolio page
   */
  static async getUserPortfolio(userId: string) {
    try {
      const holdings = await this.getUserHoldings(userId)
      
      let totalValue = 0
      let totalTokens = 0

      const portfolioItems = holdings.map((holding: any) => {
        const tokenValue = (holding.amount / Math.pow(10, holding.token.decimals)) * holding.token.current_price
        totalValue += tokenValue
        totalTokens += 1

        return {
          ...holding,
          currentValue: tokenValue,
          token: holding.token
        }
      })

      return {
        totalValue,
        totalTokens,
        holdings: portfolioItems,
        change24h: 0 // TODO: Calculate 24h change based on price history
      }
    } catch (error) {
      console.error('Failed to fetch user portfolio:', error)
      return {
        totalValue: 0,
        totalTokens: 0,
        holdings: [],
        change24h: 0
      }
    }
  }

  /**
   * Get comments for a specific token
   * Used for token detail page comments section
   */
  static async getTokenComments(tokenId: string, page = 1, pageSize = 20) {
    try {
      const offset = (page - 1) * pageSize
      
      const { data, error, count } = await supabase
        .from('token_comments')
        .select(`
          *,
          user:users(id, username, wallet_address)
        `, { count: 'exact' })
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) throw error

      // Process the data to format likes properly
      const comments = (data || []).map((comment: any) => ({
        ...comment,
        likes_count: 0, // Simplified for now
        user_liked: false // Simplified for now
      }))

      return {
        comments,
        hasMore: (count || 0) > offset + pageSize,
        total: count || 0
      }
    } catch (error) {
      console.error('Failed to get token comments:', error)
      return {
        comments: [],
        hasMore: false,
        total: 0
      }
    }
  }

  /**
   * Create a new comment for a token
   * Used when user posts a comment
   */
  static async createTokenComment(tokenId: string, content: string) {
    try {
      // Get current user from auth store
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()
      
      if (!authStore.isAuthenticated || !authStore.user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('token_comments')
        .insert({
          token_id: tokenId,
          user_id: authStore.user.id,
          content: content.trim()
        })
        .select(`
          *,
          user:users(id, username, wallet_address)
        `)
        .single()

      if (error) throw error

      return {
        ...data,
        likes_count: 0,
        user_liked: false
      }
    } catch (error) {
      console.error('Failed to create comment:', error)
      throw error
    }
  }

  /**
   * Toggle like/unlike on a comment
   * Used for comment interaction
   */
  static async toggleCommentLike(commentId: string) {
    try {
      // Get current user from auth store
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()
      
      if (!authStore.isAuthenticated || !authStore.user) {
        throw new Error('User not authenticated')
      }

      // Check if user already liked this comment
      const { data: existingLike, error: checkError } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', authStore.user.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      let liked = false

      if (existingLike) {
        // Unlike - remove the like
        const { error: deleteError } = await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existingLike.id)

        if (deleteError) throw deleteError
        liked = false
      } else {
        // Like - add the like
        const { error: insertError } = await supabase
          .from('comment_likes')
          .insert({
            comment_id: commentId,
            user_id: authStore.user.id
          })

        if (insertError) throw insertError
        liked = true
      }

      // Get updated likes count
      const { count, error: countError } = await supabase
        .from('comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('comment_id', commentId)

      if (countError) throw countError

      return {
        liked,
        likes_count: count || 0
      }
    } catch (error) {
      console.error('Failed to toggle comment like:', error)
      throw error
    }
  }

  /**
   * Get token price history for charts
   * Used for chart visualization
   */
  static async getTokenPriceHistory(tokenId: string, timeframe: string): Promise<any[]> {
    try {
      // Calculate time range based on timeframe
      const now = new Date()
      let startDate: Date
      
      switch (timeframe) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '4h':
          startDate = new Date(now.getTime() - 4 * 60 * 60 * 1000)
          break
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }

      const { data, error } = await supabase
        .from('token_price_history')
        .select('*')
        .eq('token_id', tokenId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true })

      if (error) {
        console.error('Error fetching token price history:', error)
        return []
      }

      // Convert SOL prices to USD for display
      if (data && data.length > 0) {
        try {
          // Get current SOL price for conversion
          const { priceOracleService } = await import('./priceOracle')
          const solPriceData = await priceOracleService.getSOLPrice()
          const solPriceUSD = solPriceData.price
          
          console.log('📈 [PRICE HISTORY] Converting price history from SOL to USD:', {
            entries: data.length,
            solPriceUSD: solPriceUSD.toFixed(2),
            firstPriceSOL: data[0]?.price?.toFixed(10),
            firstPriceUSD: (data[0]?.price * solPriceUSD)?.toFixed(8)
          })
          
          // Convert all price entries from SOL to USD
          return data.map(entry => ({
            ...entry,
            price: (entry.price || 0) * solPriceUSD // Convert SOL to USD
          }))
        } catch (conversionError) {
          console.warn('Failed to convert price history to USD, using SOL prices:', conversionError)
          return data || []
        }
      }

      return data || []
    } catch (error) {
      console.error('Failed to get token price history:', error)
      return []
    }
  }

  /**
   * Store token price data for historical tracking
   * Used for chart visualization
   */
  static async storeTokenPriceData(tokenId: string, priceData: {
    price: number
    volume?: number
    marketCap?: number
    timestamp?: string
  }): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('token_price_history')
        .insert({
          token_id: tokenId,
          price: priceData.price,
          volume: priceData.volume || 0,
          market_cap: priceData.marketCap || 0,
          timestamp: priceData.timestamp || new Date().toISOString()
        })

      if (error) {
        console.error('Error storing token price data:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to store token price data:', error)
      return false
    }
  }

  /**
   * Get market statistics for dashboard
   */
  static async getMarketStats(): Promise<{
    totalTokens: number
    totalVolume24h: number
    totalMarketCap: number
    activeTraders24h: number
  }> {
    try {
      const [tokensResult, volumeResult, tradersResult, allTokens] = await Promise.all([
        supabase
          .from('tokens')
          .select('id', { count: 'exact', head: true }),
        
        supabase
          .from('transactions')
          .select('sol_amount')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        
        supabase
          .from('transactions')
          .select('user_id', { count: 'exact' })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

        supabase
          .from('tokens')
          .select('current_price, total_supply')
          .eq('status', 'active')
      ])

      const totalTokens = tokensResult.count || 0
      const totalVolume24h = volumeResult.data?.reduce((sum, transaction) => sum + (transaction.sol_amount || 0), 0) || 0 // Already in SOL
      
      // Calculate real market cap based on each token's supply and price
      const totalMarketCap = allTokens.data?.reduce((sum, token) => {
        const price = token.current_price || 0
        const supply = token.total_supply || 0
        return sum + (price * supply)
      }, 0) || 0

      const activeTraders24h = tradersResult.count || 0

      return {
        totalTokens,
        totalVolume24h,
        totalMarketCap,
        activeTraders24h
      }
    } catch (error) {
      console.error('Failed to get market stats:', error)
      return {
        totalTokens: 0,
        totalVolume24h: 0,
        totalMarketCap: 0,
        activeTraders24h: 0
      }
    }
  }

  /**
   * Get trending tokens based on recent activity
   * Used for homepage and market analytics
   */
  static async getTrendingTokens(filter: string = 'volume', limit: number = 20) {
    try {
      let query
      
      // Different queries based on filter type
      switch (filter) {
        case 'volume':
          // Try to get tokens with recent transaction volume first
          query = supabase
            .from('tokens')
            .select(`
              *,
              transactions!inner(sol_amount, created_at)
            `)
            .gte('transactions.created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .order('volume_24h', { ascending: false })
          break
          
        case 'price':
          query = supabase
            .from('tokens')
            .select('*')
            .eq('status', 'active')
            .order('current_price', { ascending: false })
            .limit(limit)
          break
          
        case 'holders':
          query = supabase
            .from('tokens')
            .select('*')
            .eq('status', 'active')
            .order('holders_count', { ascending: false })
            .limit(limit)
          break
          
        case 'new':
          query = supabase
            .from('tokens')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(limit)
          break
          
        case 'featured':
          query = supabase
            .from('tokens')
            .select('*')
            .eq('is_featured', true)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(limit)
          break
          
        default:
          // Default fallback - just get all active tokens
          query = supabase
            .from('tokens')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching trending tokens:', error)
        
        // Fallback: if the complex query fails (e.g., no transactions), get basic tokens
        if (filter === 'volume' && error.message?.includes('inner')) {
          const fallbackQuery = await supabase
            .from('tokens')
            .select('*')
            .eq('status', 'active')
            .order('market_cap', { ascending: false })
            .limit(limit)
            
          if (fallbackQuery.error) {
            console.error('Fallback query also failed:', fallbackQuery.error)
            return []
          }
          
          return this.processTrendingTokens(fallbackQuery.data || [])
        }
        
        return []
      }

      // Special handling for filters that might return empty results
      if ((!data || data.length === 0) && (filter === 'featured' || filter === 'volume')) {
        // Fallback to showing all active tokens sorted appropriately
        let fallbackSort = 'created_at'
        if (filter === 'volume') fallbackSort = 'market_cap'
        if (filter === 'featured') fallbackSort = 'market_cap' // Show highest market cap tokens as "featured"
        
        const fallbackQuery = await supabase
          .from('tokens')
          .select('*')
          .eq('status', 'active')
          .order(fallbackSort, { ascending: false })
          .limit(limit)
          
        if (fallbackQuery.error) {
          console.error('Fallback query failed:', fallbackQuery.error)
          return []
        }
        
        // Mark fallback featured tokens as "featured" for display purposes
        const fallbackData = fallbackQuery.data || []
        if (filter === 'featured' && fallbackData.length > 0) {
          return this.processTrendingTokens(fallbackData.map((token, index) => ({
            ...token,
            is_featured: index < 3 // Mark top 3 as featured for display
          })))
        }
        
        return this.processTrendingTokens(fallbackData)
      }

      return this.processTrendingTokens(data || [])
    } catch (error) {
      console.error('Failed to get trending tokens:', error)
      
      // Final fallback: get any tokens if available
      try {
        const { data: fallbackTokens, error: fallbackError } = await supabase
          .from('tokens')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(limit)
          
        if (fallbackError) {
          console.error('Final fallback failed:', fallbackError)
          return []
        }
        
        return this.processTrendingTokens(fallbackTokens || [])
      } catch (finalError) {
        console.error('All trending token queries failed:', finalError)
        return []
      }
    }
  }

  /**
   * Process trending tokens to add calculated fields
   */
  private static processTrendingTokens(tokens: any[]): any[] {
    return tokens.map((token: any) => ({
      ...token,
      // Add mock trending data if not present
      volume_24h_change: token.volume_24h_change || (Math.random() - 0.5) * 200,
      price_change_24h: token.price_change_24h || (Math.random() - 0.5) * 40,
      bonding_curve_progress: token.bonding_curve_progress || Math.min(
        (token.market_cap / 69000) * 100,
        100
      )
    }))
  }

  /**
   * Advanced search tokens with filters
   * Used for search page functionality
   */
  static async searchTokens(options: {
    query?: string
    filters?: any
    page?: number
    limit?: number
  }) {
    try {
      const {
        query = '',
        filters = {},
        page = 1,
        limit = 20
      } = options

      let supabaseQuery = supabase
        .from('tokens')
        .select(`
          *,
          creator:users(id, username, wallet_address)
        `, { count: 'exact' })

      // Text search across multiple fields
      if (query.trim()) {
        supabaseQuery = supabaseQuery.or(
          `name.ilike.%${query}%,symbol.ilike.%${query}%,description.ilike.%${query}%`
        )
      }

      // Apply filters
      if (filters.marketCapRange) {
        switch (filters.marketCapRange) {
          case 'micro':
            supabaseQuery = supabaseQuery.gte('market_cap', 0).lt('market_cap', 10000)
            break
          case 'small':
            supabaseQuery = supabaseQuery.gte('market_cap', 10000).lt('market_cap', 100000)
            break
          case 'medium':
            supabaseQuery = supabaseQuery.gte('market_cap', 100000).lt('market_cap', 1000000)
            break
          case 'large':
            supabaseQuery = supabaseQuery.gte('market_cap', 1000000)
            break
        }
      }

      if (filters.volumeRange) {
        switch (filters.volumeRange) {
          case 'low':
            supabaseQuery = supabaseQuery.gte('volume_24h', 0).lt('volume_24h', 1000)
            break
          case 'medium':
            supabaseQuery = supabaseQuery.gte('volume_24h', 1000).lt('volume_24h', 10000)
            break
          case 'high':
            supabaseQuery = supabaseQuery.gte('volume_24h', 10000)
            break
        }
      }

      if (filters.ageRange) {
        const now = new Date()
        let startDate = new Date()
        
        switch (filters.ageRange) {
          case '1h':
            startDate = new Date(now.getTime() - 60 * 60 * 1000)
            break
          case '24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            break
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            break
        }
        
        if (filters.ageRange) {
          supabaseQuery = supabaseQuery.gte('created_at', startDate.toISOString())
        }
      }

      if (filters.creatorAddress) {
        // Join with users table to filter by creator wallet address
        supabaseQuery = supabaseQuery.eq('creator.wallet_address', filters.creatorAddress)
      }

      if (filters.minHolders) {
        supabaseQuery = supabaseQuery.gte('holders_count', filters.minHolders)
      }

      if (filters.minProgress) {
        supabaseQuery = supabaseQuery.gte('bonding_curve_progress', filters.minProgress)
      }

      if (filters.featuredOnly) {
        supabaseQuery = supabaseQuery.eq('is_featured', true)
      }

      if (filters.graduatedOnly) {
        supabaseQuery = supabaseQuery.eq('status', 'graduated')
      }

      if (filters.excludeNsfw) {
        supabaseQuery = supabaseQuery.eq('is_nsfw', false)
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'created_at'
      const ascending = sortBy === 'created_at' ? false : false // Most recent first, highest values first
      supabaseQuery = supabaseQuery.order(sortBy, { ascending })

      // Apply pagination
      const offset = (page - 1) * limit
      supabaseQuery = supabaseQuery.range(offset, offset + limit - 1)

      const { data: tokens, error, count } = await supabaseQuery

      if (error) throw error

      // Add calculated fields for display
      const processedTokens = (tokens || []).map((token: any) => ({
        ...token,
        price_change_24h: (Math.random() - 0.5) * 40, // Mock data
        bonding_curve_progress: token.bonding_curve_progress || Math.min(
          (token.market_cap / 69000) * 100,
          100
        )
      }))

      return {
        tokens: processedTokens,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
        page,
        limit
      }
    } catch (error) {
      console.error('Failed to search tokens:', error)
      return {
        tokens: [],
        total: 0,
        hasMore: false,
        page: 1,
        limit: 20
      }
    }
  }

  /**
   * Direct Messaging Methods
   */
   
  static async getUserConversations(userId: string) {
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          user1_id,
          user2_id,
          created_at,
          last_message:messages(id, content, sender_id, created_at)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order('updated_at', { ascending: false })

      if (error) throw error

      // Process conversations to get other user info and unread count
      const processedConversations = await Promise.all(
        (conversations || []).map(async (conv: any) => {
          const otherUserId = conv.user1_id === userId ? conv.user2_id : conv.user1_id
          
          // Get other user info
          const { data: otherUser } = await supabase
            .from('users')
            .select('id, username, wallet_address')
            .eq('id', otherUserId)
            .single()

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('receiver_id', userId)
            .eq('read', false)

          return {
            id: conv.id,
            otherUser: otherUser || { id: otherUserId, username: 'Unknown', wallet_address: '' },
            lastMessage: conv.last_message?.[0] || null,
            unreadCount: unreadCount || 0
          }
        })
      )

      return processedConversations
    } catch (error) {
      console.error('Failed to get user conversations:', error)
      return []
    }
  }

  static async getConversationMessages(conversationId: string) {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return messages || []
    } catch (error) {
      console.error('Failed to get conversation messages:', error)
      return []
    }
  }

  static async sendMessage(messageData: {
    conversation_id: string
    sender_id: string
    receiver_id: string
    content: string
  }) {
    try {
      const { data: message, error } = await supabase
        .from('messages')
        .insert([{
          ...messageData,
          read: false,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      // Update conversation's updated_at timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', messageData.conversation_id)

      return message
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  static async markConversationAsRead(conversationId: string, userId: string) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('receiver_id', userId)
        .eq('read', false)

      if (error) throw error
    } catch (error) {
      console.error('Failed to mark conversation as read:', error)
    }
  }

  static async findUserByIdentifier(identifier: string) {
    try {
      // Try to find by username first, then by wallet address
      let { data: user, error } = await supabase
        .from('users')
        .select('id, username, wallet_address')
        .eq('username', identifier)
        .single()

      if (!user) {
        // Try by wallet address
        const { data: userByWallet, error: walletError } = await supabase
          .from('users')
          .select('id, username, wallet_address')
          .eq('wallet_address', identifier)
          .single()

        user = userByWallet
        error = walletError
      }

      if (error) throw error
      return user
    } catch (error) {
      console.error('Failed to find user:', error)
      return null
    }
  }

  static async createConversation(user1Id: string, user2Id: string) {
    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`)
        .single()

      if (existingConv) {
        // Return existing conversation with user info
        const otherUserId = user1Id === user1Id ? user2Id : user1Id
        const { data: otherUser } = await supabase
          .from('users')
          .select('id, username, wallet_address')
          .eq('id', otherUserId)
          .single()

        return {
          id: existingConv.id,
          otherUser: otherUser || { id: otherUserId, username: 'Unknown', wallet_address: '' },
          unreadCount: 0
        }
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert([{
          user1_id: user1Id,
          user2_id: user2Id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) throw error

      // Get other user info
      const { data: otherUser } = await supabase
        .from('users')
        .select('id, username, wallet_address')
        .eq('id', user2Id)
        .single()

      return {
        id: newConv.id,
        otherUser: otherUser || { id: user2Id, username: 'Unknown', wallet_address: '' },
        unreadCount: 0
      }
    } catch (error) {
      console.error('Failed to create conversation:', error)
      throw error
    }
  }

  /**
   * Get King of the Hill token based on pump.fun algorithm
   * Criteria: Market cap >$35K, >20 replies, launched <1 hour ago
   */
  static async getKingOfTheHillToken() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select(`
          *,
          creator:users!tokens_creator_id_fkey(id, username, wallet_address),
          comments:token_comments(count),
          transactions:transactions(count)
        `)
        .gte('market_cap', 35000) // $35K minimum market cap
        .gte('created_at', oneHourAgo) // Created within last hour
        .eq('status', 'active')
        .order('market_cap', { ascending: false })
        .limit(10)

      if (error) throw error

      // Filter by comment count (>20 replies) and calculate king score
      const eligibleTokens = (tokens || [])
        .filter(token => {
          const commentCount = Array.isArray(token.comments) ? token.comments.length : token.comments?.count || 0
          return commentCount >= 20
        })
        .map(token => ({
          ...token,
          kingScore: this.calculateKingScore(token)
        }))
        .sort((a, b) => b.kingScore - a.kingScore)

      return eligibleTokens[0] || null
    } catch (error) {
      console.error('Failed to get King of the Hill token:', error)
      return null
    }
  }

  /**
   * Calculate King of the Hill score based on pump.fun algorithm
   */
  static calculateKingScore(token: any): number {
    const marketCapScore = Math.min(token.market_cap / 1000, 100) // Max 100 points for market cap
    const commentCount = Array.isArray(token.comments) ? token.comments.length : token.comments?.count || 0
    const engagementScore = Math.min(commentCount * 2, 200) // Max 200 points for engagement
    
    // Recency bonus (newer tokens get higher score)
    const ageInMinutes = (Date.now() - new Date(token.created_at).getTime()) / (1000 * 60)
    const recencyScore = Math.max(0, 100 - ageInMinutes) // Max 100 points, decreases with age
    
    // Volume bonus
    const volumeScore = Math.min((token.volume_24h || 0) / 1000, 50) // Max 50 points for volume
    
    return marketCapScore + engagementScore + recencyScore + volumeScore
  }

  /**
   * Check if token should graduate (reach $69K market cap)
   */
  static async checkTokenGraduation(tokenId: string) {
    try {
      const { data: token, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single()

      if (error) throw error

      const GRADUATION_THRESHOLD = 69000 // $69K USD
      
      if (token.market_cap >= GRADUATION_THRESHOLD && token.status === 'active') {
        // Mark as ready for graduation
        await this.graduateToken(tokenId)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Failed to check token graduation:', error)
      return false
    }
  }

  /**
   * Graduate token to Raydium with $12K liquidity
   */
  static async graduateToken(tokenId: string) {
    try {
      const { data: token, error } = await supabase
        .from('tokens')
        .update({
          status: 'graduated',
          graduated_at: new Date().toISOString(),
          liquidity_pool_address: null, // Will be set after Raydium integration
          graduation_market_cap: 69000
        })
        .eq('id', tokenId)
        .select()
        .single()

      if (error) throw error

      // TODO: Integrate with Raydium API to create liquidity pool
      // This would involve:
      // 1. Creating LP on Raydium with $12K liquidity
      // 2. Burning LP tokens for permanent lock
      // 3. Sending 0.5 SOL reward to creator
      
      console.log(`Token ${tokenId} graduated with $69K market cap`)
      return token
    } catch (error) {
      console.error('Failed to graduate token:', error)
      throw error
    }
  }

  /**
   * Get bonding curve progress for token
   */
  static async getBondingCurveProgress(tokenId: string) {
    try {
      const { data: token, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single()

      if (error) throw error

      // Get total SOL raised from transactions
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('sol_amount, transaction_type')
        .eq('token_id', tokenId)
        .eq('status', 'completed')

      if (txError) throw txError

      // Calculate net SOL raised (buys - sells)
      const totalSolRaised = (transactions || []).reduce((sum, tx) => {
        if (tx.transaction_type === 'buy') {
          return sum + (tx.sol_amount || 0)
        } else if (tx.transaction_type === 'sell') {
          return sum - (tx.sol_amount || 0)
        }
        return sum
      }, 0)

      const GRADUATION_THRESHOLD_SOL = 85 // 85 SOL to graduate (instead of $69K)
      const progress = Math.min((totalSolRaised / GRADUATION_THRESHOLD_SOL) * 100, 100)
      
      return {
        progress,
        currentMarketCap: token.market_cap,
        graduationThreshold: GRADUATION_THRESHOLD_SOL,
        graduated: progress >= 100 || token.status === 'graduated',
        remaining: Math.max(0, GRADUATION_THRESHOLD_SOL - totalSolRaised),
        solRaised: totalSolRaised
      }
    } catch (error) {
      console.error('Failed to get bonding curve progress:', error)
      return null
    }
  }

  /**
   * Get trending tokens with enhanced sorting
   */
  static async getTrendingTokensEnhanced(limit: number = 10) {
    try {
      const { data: tokens, error } = await supabase
        .from('tokens')
        .select(`
          *,
          creator:users!tokens_creator_id_fkey(id, username, wallet_address, avatar_url),
          comments:token_comments(count),
          transactions:transactions(count)
        `)
        .eq('status', 'active')
        .gte('market_cap', 1000) // Minimum $1K market cap
        .order('volume_24h', { ascending: false })
        .limit(limit * 2) // Get more for filtering

      if (error) throw error

      // Calculate trending scores
      const trendingTokens = (tokens || [])
        .map(token => ({
          ...token,
          trendingScore: this.calculateTrendingScore(token)
        }))
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit)
      
      return trendingTokens
    } catch (error) {
      console.error('Failed to get trending tokens:', error)
      return []
    }
  }

  /**
   * Calculate trending score for token ranking
   */
  static calculateTrendingScore(token: any): number {
    const volumeScore = (token.volume_24h || 0) / 1000 // Volume weight
    const marketCapScore = (token.market_cap || 0) / 10000 // Market cap weight
    const commentCount = Array.isArray(token.comments) ? token.comments.length : token.comments?.count || 0
    const engagementScore = commentCount * 10 // Engagement weight
    
    // Recency bonus (tokens created in last 24h get bonus)
    const ageInHours = (Date.now() - new Date(token.created_at).getTime()) / (1000 * 60 * 60)
    const recencyBonus = ageInHours < 24 ? Math.max(0, 100 - ageInHours * 4) : 0
    
    return volumeScore + marketCapScore + engagementScore + recencyBonus
  }

  /**
   * Update user profile information
   */
  static async updateUserProfile(userId: string, updateData: { username?: string; bio?: string }) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('❌ Failed to update user profile:', error)
      throw error
    }
  }

  /**
   * Get tokens created by a specific user
   */
  static async getTokensByCreator(userId: string) {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select('*')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Transform data to match TokenCard expected format
      const transformedData = data?.map(token => ({
        ...token,
        // Map database fields to TokenCard expected format
        imageUrl: token.image_url,
        price: token.current_price || 0,
        priceChange24h: 0, // We don't have price change data yet
        marketCap: token.market_cap || 0,
        volume24h: token.volume_24h || 0,
        holders: token.holders_count || 0
      })) || []

      console.log(`✅ Found ${transformedData.length} tokens for user ${userId}:`, transformedData)
      return transformedData
    } catch (error) {
      console.error('❌ Failed to get user tokens:', error)
      return []
    }
  }

  /**
   * Get user's trading history
   */
  static async getUserTradingHistory(userId: string) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          tokens:token_id (
            name,
            symbol
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      
      // Transform the data to include token info
      const transformedData = data?.map(tx => ({
        ...tx,
        token_name: tx.tokens?.name || 'Unknown',
        token_symbol: tx.tokens?.symbol || 'UNK',
        type: tx.transaction_type
      })) || []

      return transformedData
    } catch (error) {
      console.error('❌ Failed to get trading history:', error)
      return []
    }
  }

  /**
   * Get user's activity feed
   */
  static async getUserActivity(userId: string) {
    try {
      // For now, return token creation activities from tokens table
      // This could be expanded to include a dedicated activities table
      const { data: tokenData, error: tokenError } = await supabase
        .from('tokens')
        .select('id, name, created_at')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (tokenError) throw tokenError

      const activities = tokenData?.map(token => ({
        id: `token_${token.id}`,
        type: 'token_created',
        token_name: token.name,
        created_at: token.created_at,
        description: `Created token ${token.name}`
      })) || []

      return activities
    } catch (error) {
      console.error('❌ Failed to get user activity:', error)
      return []
    }
  }

  // ===== WATCHLIST FUNCTIONALITY =====

  /**
   * Check if watchlist table exists
   */
  static async checkWatchlistTableExists(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_watchlist')
        .select('id')
        .limit(1)

      return !error
    } catch (error) {
      console.warn('Watchlist table does not exist:', error)
      return false
    }
  }

  /**
   * Add token to user's watchlist
   */
  static async addToWatchlist(userId: string, tokenId: string) {
    try {
      const tableExists = await this.checkWatchlistTableExists()
      if (!tableExists) {
        throw new Error('Watchlist feature is not yet available. Please run the database migration.')
      }

      const { data, error } = await supabase
        .from('user_watchlist')
        .insert({
          user_id: userId,
          token_id: tokenId
        })
        .select()
        .single()

      if (error) {
        // If error is due to unique constraint violation, it means already in watchlist
        if (error.code === '23505') {
          throw new Error('Token is already in your watchlist')
        }
        throw error
      }

      return data
    } catch (error) {
      console.error('Failed to add to watchlist:', error)
      throw error
    }
  }

  /**
   * Remove token from user's watchlist
   */
  static async removeFromWatchlist(userId: string, tokenId: string) {
    try {
      const tableExists = await this.checkWatchlistTableExists()
      if (!tableExists) {
        throw new Error('Watchlist feature is not yet available. Please run the database migration.')
      }

      const { error } = await supabase
        .from('user_watchlist')
        .delete()
        .match({
          user_id: userId,
          token_id: tokenId
        })

      if (error) throw error

      return true
    } catch (error) {
      console.error('Failed to remove from watchlist:', error)
      throw error
    }
  }

  /**
   * Check if token is in user's watchlist
   */
  static async isTokenInWatchlist(userId: string, tokenId: string): Promise<boolean> {
    try {
      const tableExists = await this.checkWatchlistTableExists()
      if (!tableExists) {
        console.warn('Watchlist table does not exist yet')
        return false
      }

      const { data, error } = await supabase
        .from('user_watchlist')
        .select('id')
        .eq('user_id', userId)
        .eq('token_id', tokenId)
        .limit(1)

      if (error) {
        console.warn('Watchlist check error:', error)
        return false
      }

      return !!(data && data.length > 0)
    } catch (error) {
      console.error('Failed to check watchlist status:', error)
      return false
    }
  }

  /**
   * Get user's watchlist with token details
   */
  static async getUserWatchlist(userId: string, limit = 50, offset = 0) {
    try {
      const tableExists = await this.checkWatchlistTableExists()
      if (!tableExists) {
        console.warn('Watchlist table does not exist yet')
        return []
      }

      const { data, error } = await supabase
        .from('user_watchlist')
        .select(`
          id,
          created_at,
          token:tokens (
            id,
            name,
            symbol,
            image_url,
            mint_address,
            current_price,
            market_cap,
            volume_24h,
            bonding_curve_progress,
            status,
            created_at
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return data?.map(item => ({
        watchlistId: item.id,
        addedAt: item.created_at,
        ...item.token
      })) || []
    } catch (error) {
      console.error('Failed to get user watchlist:', error)
      return []
    }
  }

  /**
   * Get watchlist count for user
   */
  static async getUserWatchlistCount(userId: string): Promise<number> {
    try {
      const tableExists = await this.checkWatchlistTableExists()
      if (!tableExists) {
        return 0
      }

      const { count, error } = await supabase
        .from('user_watchlist')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (error) throw error

      return count || 0
    } catch (error) {
      console.error('Failed to get watchlist count:', error)
      return 0
    }
  }

  /**
   * Get trending tokens from watchlists
   */
  static async getTrendingWatchlistTokens(limit = 10) {
    try {
      const tableExists = await this.checkWatchlistTableExists()
      if (!tableExists) {
        return []
      }

      const { data, error } = await supabase
        .from('tokens')
        .select(`
          id,
          name,
          symbol,
          image_url,
          mint_address,
          current_price,
          market_cap,
          volume_24h,
          bonding_curve_progress,
          status,
          created_at
        `)
        .gt('watchlist_count', 0)
        .order('watchlist_count', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Failed to get trending watchlist tokens:', error)
      return []
    }
  }

  /**
   * Get top holders for a token based on user holdings
   */
  static async getTokenTopHolders(tokenId: string, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('user_holdings')
        .select(`
          amount,
          users:user_id (
            id,
            wallet_address,
            username
          )
        `)
        .eq('token_id', tokenId)
        .gt('amount', 0)
        .order('amount', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Get token info to calculate total supply for percentage calculation
      const tokenInfo = await this.getTokenById(tokenId)
      const totalSupply = tokenInfo?.total_supply || 1000000000 // Default 1B tokens
      const decimals = tokenInfo?.decimals || 9 // Default 9 decimals

      // Calculate total actual holdings to use as denominator
      const totalHoldings = data?.reduce((sum, holding) => sum + holding.amount, 0) || 1

      // Transform data to include percentage and formatted address
      const topHolders = data?.map((holding) => {
        const user = holding.users as any
        
        // Convert amount from smallest unit to display unit for showing
        const displayAmount = holding.amount / Math.pow(10, decimals)
        
        // Calculate percentage based on actual holdings distribution
        // This shows what % of all held tokens this person owns
        let percentage = ((holding.amount / totalHoldings) * 100)
        
        // Ensure percentage makes sense (should be between 0-100)
        if (percentage > 100) {
          console.warn('⚠️ Percentage calculation error, falling back to safer calculation')
          // Fallback: assume total supply is in smallest units like holdings
          percentage = ((holding.amount / totalSupply) * 100)
          
          // If still wrong, use a different approach
          if (percentage > 100) {
            // Maybe total_supply is in display units, convert holdings to display units for comparison
            const displayTotalSupply = totalSupply * Math.pow(10, decimals)
            percentage = ((holding.amount / displayTotalSupply) * 100)
          }
        }
        
        return {
          address: user?.wallet_address ? this.formatWalletAddress(user.wallet_address) : 'Unknown',
          fullAddress: user?.wallet_address || '',
          username: user?.username || null,
          amount: holding.amount,
          displayAmount: displayAmount,
          percentage: parseFloat(Math.min(percentage, 100).toFixed(2)) // Cap at 100%
        }
      }) || []

      console.log(`✅ Found ${topHolders.length} holders for token ${tokenId}`)
      return topHolders
    } catch (error) {
      console.error('❌ Failed to get token top holders:', error)
      return []
    }
  }

  /**
   * Helper method to format wallet addresses
   */
  private static formatWalletAddress(address: string): string {
    if (!address) return 'Unknown'
    if (address.length <= 8) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  /**
   * Debug method to check user tokens and relationships
   */
  static async debugUserTokens(walletAddress: string) {
    try {
      console.log('🔍 Debug: Starting user token investigation for wallet:', walletAddress)
      
      // 1. Check if user exists
      const user = await this.getUserByWallet(walletAddress)
      console.log('🔍 Debug: User found:', user)
      
      if (!user) {
        console.log('❌ Debug: No user found for wallet address')
        return
      }
      
      // 2. Check tokens with this creator_id
      const { data: tokensByCreatorId, error: error1 } = await supabase
        .from('tokens')
        .select('*')
        .eq('creator_id', user.id)
      
      console.log('🔍 Debug: Tokens by creator_id:', tokensByCreatorId)
      
      // 3. Check if there are any tokens with this wallet as mint_address or other fields
      const { data: allTokens, error: error2 } = await supabase
        .from('tokens')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      
             console.log('🔍 Debug: Recent tokens in database:', allTokens)
       
       // 5. Show detailed token info
       console.log('🔍 Debug: Token details:')
       allTokens?.forEach((token, index) => {
         console.log(`  Token ${index + 1}:`, {
           id: token.id,
           name: token.name,
           symbol: token.symbol,
           creator_id: token.creator_id,
           mint_address: token.mint_address,
           created_at: token.created_at
         })
       })
      
      // 4. Check users table
      const { data: allUsers, error: error3 } = await supabase
        .from('users')
        .select('*')
        .limit(5)
      
             console.log('🔍 Debug: Recent users in database:', allUsers)
       
       // 6. Show detailed user info
       console.log('🔍 Debug: User details:')
       allUsers?.forEach((user, index) => {
         console.log(`  User ${index + 1}:`, {
           id: user.id,
           wallet_address: user.wallet_address,
           username: user.username,
           tokens_created: user.tokens_created,
           created_at: user.created_at
         })
       })
      
      return {
        user,
        tokensByCreatorId,
        allTokens,
        allUsers
      }
    } catch (error) {
      console.error('❌ Debug: Error during investigation:', error)
    }
  }

  /**
   * Fix duplicate user records and consolidate tokens
   */
  static async fixDuplicateUser(correctWalletAddress: string, duplicateUserId: string) {
    try {
      console.log('🔧 Fixing duplicate user records...')
      
      // Get the correct user (with full wallet address)
      const correctUser = await this.getUserByWallet(correctWalletAddress)
      if (!correctUser) {
        console.error('❌ Correct user not found')
        return false
      }
      
      console.log('✅ Found correct user:', correctUser.id)
      
      // Update all tokens from duplicate user to correct user
      const { data: updatedTokens, error: updateError } = await supabase
        .from('tokens')
        .update({ creator_id: correctUser.id })
        .eq('creator_id', duplicateUserId)
        .select()
      
      if (updateError) {
        console.error('❌ Failed to update tokens:', updateError)
        return false
      }
      
      console.log(`✅ Updated ${updatedTokens?.length || 0} tokens to correct user`)
      
      // Update the correct user's token count
      const tokenCount = updatedTokens?.length || 0
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ tokens_created: (correctUser.tokens_created || 0) + tokenCount })
        .eq('id', correctUser.id)
      
      if (userUpdateError) {
        console.error('❌ Failed to update user token count:', userUpdateError)
      } else {
        console.log('✅ Updated user token count')
      }
      
      // Optionally delete the duplicate user record
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', duplicateUserId)
      
      if (deleteError) {
        console.error('❌ Failed to delete duplicate user:', deleteError)
      } else {
        console.log('✅ Deleted duplicate user record')
      }
      
      return true
    } catch (error) {
      console.error('❌ Error fixing duplicate user:', error)
      return false
    }
  }
}

// Export the configured client as default
export default supabase