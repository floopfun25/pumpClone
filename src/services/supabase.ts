import { createClient, SupabaseClient } from '@supabase/supabase-js'
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

// Mock client for fallback when Supabase fails
class MockSupabaseClient {
  from() {
    return {
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: { code: 'MOCK_ERROR', message: 'Supabase client failed to initialize' } }),
          range: () => ({ data: [], error: null }),
          limit: () => ({ data: [], error: null }),
          order: () => ({ data: [], error: null }),
          or: () => ({ data: [], error: null })
        }),
        count: () => ({ count: 0, error: null }),
        head: () => ({ count: 0, error: null }),
        gt: () => ({ data: [], error: null })
      }),
      insert: () => ({ data: null, error: { message: 'Mock mode - database operations disabled' } }),
      upsert: () => ({ select: () => ({ single: () => ({ data: null, error: { message: 'Mock mode - database operations disabled' } }) }) }),
      update: () => ({ data: null, error: { message: 'Mock mode - database operations disabled' } }),
      delete: () => ({ data: null, error: { message: 'Mock mode - database operations disabled' } })
    }
  }

  channel() {
    return {
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) })
    }
  }
}

// Lazy client initialization
let supabaseClient: SupabaseClient<Database> | MockSupabaseClient | null = null
let initializationAttempted = false

function getSupabaseClient(): SupabaseClient<Database> | MockSupabaseClient {
  if (supabaseClient) {
    return supabaseClient
  }

  if (initializationAttempted) {
    // Return mock client if initialization already failed
    console.warn('🔄 Using mock Supabase client (initialization previously failed)')
    const mockClient = new MockSupabaseClient() as any
    supabaseClient = mockClient
    return mockClient
  }

  initializationAttempted = true

  // Validate configuration
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
    console.error('❌ Supabase configuration missing')
    const mockClient = new MockSupabaseClient() as any
    supabaseClient = mockClient
    return mockClient
  }

  console.log('🔗 Attempting Supabase client initialization...')

  try {
    // Try to create the client
    const client = createClient(supabaseConfig.url, supabaseConfig.anonKey)
    supabaseClient = client
    console.log('✅ Supabase client created successfully')
    return client
  } catch (error) {
    console.warn('⚠️ Supabase client creation failed, using mock client:', error)
    const mockClient = new MockSupabaseClient() as any
    supabaseClient = mockClient
    return mockClient
  }
}

// Export the lazy-loaded client
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    const client = getSupabaseClient()
    const value = (client as any)[prop]
    
    if (typeof value === 'function') {
      return value.bind(client)
    }
    
    return value
  }
})

// Utility functions for common database operations with error handling
export class SupabaseService {
  /**
   * Check if we're running in mock mode
   */
  static isMockMode(): boolean {
    return supabaseClient instanceof MockSupabaseClient
  }

  /**
   * Get user by wallet address
   * Used for authentication and profile loading
   */
  static async getUserByWallet(walletAddress: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single()
      
      if (error && error.code !== 'PGRST116') {
        if (this.isMockMode()) {
          console.warn('🔄 Mock mode: returning null user')
          return null
        }
        throw error
      }
      
      return data
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
        if (this.isMockMode()) {
          console.warn('🔄 Mock mode: user upsert disabled')
          return null
        }
        throw error
      }
      return data
    } catch (error) {
      console.error('Failed to upsert user:', error)
      return null
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
        `)
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
      
      const { data, error } = await query
      
      if (error) {
        if (this.isMockMode()) {
          console.warn('🔄 Mock mode: returning empty tokens array')
          return []
        }
        throw error
      }
      return data || []
    } catch (error) {
      console.error('Failed to get tokens:', error)
      return []
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
      
      if (error) {
        if (this.isMockMode()) {
          console.warn('🔄 Mock mode: returning null token')
          return null
        }
        throw error
      }
      return data
    } catch (error) {
      console.error('Failed to get token by mint:', error)
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
      
      if (error) {
        if (this.isMockMode()) {
          console.warn('🔄 Mock mode: returning empty holdings array')
          return []
        }
        throw error
      }
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
      
      if (error) {
        if (this.isMockMode()) {
          console.warn('🔄 Mock mode: returning empty transactions array')
          return []
        }
        throw error
      }
      return data || []
    } catch (error) {
      console.error('Failed to get token transactions:', error)
      return []
    }
  }
  
  /**
   * Subscribe to real-time token price updates
   * Used for live price feeds
   */
  static subscribeToTokenUpdates(tokenId: string, callback: (token: any) => void) {
    if (this.isMockMode()) {
      console.warn('🔄 Mock mode: subscriptions disabled')
      return { unsubscribe: () => {} }
    }

    try {
      return supabase
        .channel(`token-${tokenId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tokens',
            filter: `id=eq.${tokenId}`
          },
          callback
        )
        .subscribe()
    } catch (error) {
      console.error('Failed to subscribe to token updates:', error)
      return { unsubscribe: () => {} }
    }
  }
  
  /**
   * Subscribe to real-time transaction updates
   * Used for live trading activity
   */
  static subscribeToTransactions(tokenId: string, callback: (transaction: any) => void) {
    if (this.isMockMode()) {
      console.warn('🔄 Mock mode: subscriptions disabled')
      return { unsubscribe: () => {} }
    }

    try {
      return supabase
        .channel(`transactions-${tokenId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'transactions',
            filter: `token_id=eq.${tokenId}`
          },
          callback
        )
        .subscribe()
    } catch (error) {
      console.error('Failed to subscribe to transactions:', error)
      return { unsubscribe: () => {} }
    }
  }

  /**
   * Get dashboard statistics
   * Used for homepage stats display
   */
  static async getDashboardStats() {
    try {
      if (this.isMockMode()) {
        console.warn('🔄 Mock mode: returning mock dashboard stats')
        return {
          totalTokens: 0,
          totalVolume: 0,
          totalUsers: 0,
          graduatedTokens: 0
        }
      }

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
      const totalVolumeInSOL = totalVolume / 1e9 // Convert lamports to SOL

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
      if (this.isMockMode()) {
        console.warn('🔄 Mock mode: returning empty portfolio')
        return {
          totalValue: 0,
          totalTokens: 0,
          holdings: [],
          change24h: 0
        }
      }

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
}

// Export the configured client as default
export default supabase 