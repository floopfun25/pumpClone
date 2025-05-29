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

// Create and configure Supabase client
export const supabase: SupabaseClient<Database> = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Custom authentication storage for wallet-based auth
      storage: {
        getItem: (key: string) => {
          if (typeof window === 'undefined') return null
          return localStorage.getItem(key)
        },
        setItem: (key: string, value: string) => {
          if (typeof window === 'undefined') return
          localStorage.setItem(key, value)
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') return
          localStorage.removeItem(key)
        }
      }
    },
    // Global configuration for all requests
    global: {
      headers: {
        'X-Client-Info': 'pump-fun-clone@1.0.0',
      },
    },
    // Real-time subscription configuration
    realtime: {
      params: {
        eventsPerSecond: 20
      }
    }
  }
)

// Utility functions for common database operations
export class SupabaseService {
  /**
   * Get user by wallet address
   * Used for authentication and profile loading
   */
  static async getUserByWallet(walletAddress: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()
    
    if (error && error.code !== 'PGRST116') {
      throw error
    }
    
    return data
  }
  
  /**
   * Create or update user profile
   * Used during wallet authentication
   */
  static async upsertUser(userData: Database['public']['Tables']['users']['Insert']) {
    const { data, error } = await supabase
      .from('users')
      .upsert(userData, {
        onConflict: 'wallet_address',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (error) throw error
    return data
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
    
    if (error) throw error
    return data || []
  }
  
  /**
   * Get token by mint address
   * Used for token detail pages
   */
  static async getTokenByMint(mintAddress: string) {
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
  }
  
  /**
   * Get user's token holdings
   * Used for portfolio display
   */
  static async getUserHoldings(userId: string) {
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
  }
  
  /**
   * Get recent transactions for a token
   * Used for trading activity display
   */
  static async getTokenTransactions(tokenId: string, limit = 50) {
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
  }
  
  /**
   * Subscribe to real-time token price updates
   * Used for live price feeds
   */
  static subscribeToTokenUpdates(tokenId: string, callback: (token: any) => void) {
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
  }
  
  /**
   * Subscribe to real-time transaction updates
   * Used for live trading activity
   */
  static subscribeToTransactions(tokenId: string, callback: (transaction: any) => void) {
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
  }
}

// Export the configured client as default
export default supabase 