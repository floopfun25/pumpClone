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
  console.log('🔧 Creating Supabase client with auth support...')
  
  // Environment detection
  const isGitHubPages = window.location.hostname.includes('github.io')
  const isHTTPS = window.location.protocol === 'https:'
  const hasWebCrypto = !!(window.crypto && window.crypto.subtle)
  
  console.log('Environment:', {
    hostname: window.location.hostname,
    isGitHubPages,
    isHTTPS,
    hasWebCrypto,
    userAgent: navigator.userAgent.substring(0, 50) + '...'
  })
  
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
  
  console.log('✅ Supabase configuration valid:', {
    url: supabaseConfig.url,
    anonKeyLength: supabaseConfig.anonKey.length
  })
  
  try {
    // Use CDN version if available, otherwise fall back to bundled
    const clientFactory = (window as any).__SUPABASE_CDN__?.createClient || createClient
    
    if (!clientFactory) {
      throw new Error('Supabase createClient not available from CDN or bundle')
    }
    
    console.log('Using Supabase client factory:', (window as any).__SUPABASE_CDN__ ? 'CDN' : 'bundled')
    
    // Create the client with minimal configuration to avoid headers issues
    const client = clientFactory(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Disable to avoid URL parsing issues
        flowType: 'implicit' as const,
        debug: false
      },
      // Minimal global config to avoid headers issues
      global: {
        headers: {}
      }
    })

    console.log('✅ Supabase client created with auth support')
    return client
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    
    // Try fallback with even more minimal configuration
    try {
      console.log('🔄 Attempting fallback Supabase client creation...')
      const fallbackClient = createClient(supabaseConfig.url, supabaseConfig.anonKey)
      console.log('✅ Fallback Supabase client created')
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
      console.log('🔐 Signing in with wallet using anonymous auth:', walletAddress)
      
      // First, check if user already exists by wallet address in metadata
      const { data: existingSession } = await supabase.auth.getSession()
      
      if (existingSession?.session?.user?.user_metadata?.wallet_address === walletAddress) {
        console.log('✅ Existing session found for wallet:', walletAddress)
        return { user: existingSession.session.user, session: existingSession.session }
      }
      
      // Sign out any existing session first
      if (existingSession?.session) {
        await supabase.auth.signOut()
      }
      
      // Create anonymous user with wallet address in metadata
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            wallet_address: walletAddress,
            username: `user_${walletAddress.slice(0, 8)}`,
            created_via: 'wallet_connection'
          }
        }
      })
      
      if (error) throw error
      
      if (!data.user || !data.session) {
        throw new Error('Failed to create anonymous auth session')
      }
      
      console.log('✅ Anonymous auth session created for wallet:', walletAddress)
      console.log('🔑 User ID:', data.user.id)
      
      // Create or update user profile in our database
      try {
        const userData = {
          id: data.user.id, // Use the Supabase auth user ID
          wallet_address: walletAddress,
          username: `user_${walletAddress.slice(0, 8)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_verified: false,
          total_volume_traded: 0,
          tokens_created: 0,
          reputation_score: 0
        }
        
        await SupabaseService.upsertUser(userData)
        console.log('✅ User profile created/updated in database')
      } catch (dbError) {
        console.warn('⚠️ Failed to create user profile, but auth session is valid:', dbError)
        // Don't throw here as the auth session is still valid
      }
      
      return { user: data.user, session: data.session }
      
    } catch (error) {
      console.error('❌ Wallet auth failed:', error)
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Sign out from Supabase auth
   */
  static async signOut(): Promise<void> {
    try {
      console.log('🔓 Signing out from Supabase auth...')
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      console.log('✅ Successfully signed out')
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
      console.log('🔄 Auth state changed:', event, session?.user?.id)
      callback(event, session)
    })
  }
}

// Utility functions for common database operations
export class SupabaseService {
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
      
      if (error) throw error
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
      
      if (error) throw error
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
      
      if (error) throw error
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
   * Subscribe to real-time token price updates
   * Used for live price feeds
   */
  static subscribeToTokenUpdates(tokenId: string, callback: (token: any) => void) {
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
          user:users(id, username, wallet_address),
          likes_count:comment_likes(count),
          user_liked:comment_likes!inner(user_id)
        `, { count: 'exact' })
        .eq('token_id', tokenId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) throw error

      // Process the data to format likes properly
      const comments = (data || []).map((comment: any) => ({
        ...comment,
        likes_count: comment.likes_count?.[0]?.count || 0,
        user_liked: comment.user_liked?.length > 0
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
      const [tokensResult, volumeResult, tradersResult] = await Promise.all([
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
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ])

      const totalTokens = tokensResult.count || 0
      const totalVolume24h = (volumeResult.data?.reduce((sum, transaction) => sum + (transaction.sol_amount || 0), 0) || 0) / 1e9 // Convert lamports to SOL
      const totalMarketCap = totalTokens * 50000 // Mock calculation
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
  static async getTrendingTokens(limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('tokens')
        .select(`
          *,
          transactions!inner(sol_amount, created_at)
        `)
        .gte('transactions.created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching trending tokens:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to get trending tokens:', error)
      return []
    }
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
}

// Export the configured client as default
export default supabase