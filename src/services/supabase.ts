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

// Enhanced Supabase client creation with GitHub Pages compatibility
function createSupabaseClient(): SupabaseClient<Database> {
  console.log('🔧 Creating Supabase client...')
  
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
    throw new Error('Missing Supabase configuration - check environment variables')
  }
  
  // Check for CDN version first
  const hasCDNSupabase = !!(window as any).__SUPABASE_CDN__ && !!(window as any).__SUPABASE_CDN__.createClient;
  console.log('CDN Supabase available:', hasCDNSupabase);
  
  // Multiple configuration strategies for maximum compatibility
  const configs = [
    // Strategy 1: CDN version (if available)
    ...(hasCDNSupabase ? [{
      name: 'CDN Supabase',
      createClient: (window as any).__SUPABASE_CDN__.createClient,
      config: {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          debug: false
        }
      }
    }] : []),
    
    // Strategy 2: GitHub Pages optimized with custom fetch
    {
      name: 'Bundled Supabase with Custom Fetch',
      createClient: createClient,
      config: {
        auth: {
          persistSession: false,
          autoRefreshToken: false, 
          detectSessionInUrl: false,
          flowType: 'implicit' as const,
          debug: false
        },
        global: {
          fetch: (input: RequestInfo | URL, init?: RequestInit) => {
            console.log('Custom fetch called for:', typeof input === 'string' ? input.substring(0, 50) : input);
            
            // Ensure headers are properly constructed
            const headers = new Headers(init?.headers);
            
            // Add required headers
            if (!headers.has('Content-Type') && init?.method !== 'GET') {
              headers.set('Content-Type', 'application/json');
            }
            
            return fetch(input, {
              ...init,
              headers
            }).then(response => {
              // Validate response immediately
              if (!response || !response.headers || typeof response.headers.get !== 'function') {
                console.warn('Invalid response detected, creating safe response');
                return new Response(response?.body || null, {
                  status: response?.status || 200,
                  statusText: response?.statusText || 'OK',
                  headers: new Headers()
                });
              }
              return response;
            });
          }
        }
      }
    },
    
    // Strategy 3: Minimal configuration without custom fetch
    {
      name: 'Bundled Supabase Minimal',
      createClient: createClient,
      config: {
        auth: {
          persistSession: false,
          autoRefreshToken: false, 
          detectSessionInUrl: false,
          debug: false
        }
      }
    },
    
    // Strategy 4: Bare minimum configuration
    {
      name: 'Bundled Supabase Bare',
      createClient: createClient,
      config: {
        auth: {
          persistSession: false
        }
      }
    }
  ];
  
  // Try each configuration strategy
  for (let i = 0; i < configs.length; i++) {
    const strategy = configs[i];
    console.log(`Attempting Supabase client creation - Strategy ${i + 1}: ${strategy.name}`);
    
    try {
      const client = strategy.createClient(supabaseConfig.url, supabaseConfig.anonKey, strategy.config);
      
      // Test the client immediately
      console.log('Testing client connectivity...');
      client.from('users').select('count', { count: 'exact', head: true }).then(
        () => console.log('✅ Supabase connectivity test passed'),
        (error: unknown) => console.warn('⚠️ Supabase connectivity test failed:', error)
      );
      
      console.log(`✅ Supabase client created successfully with Strategy ${i + 1}: ${strategy.name}`);
      return client;
      
    } catch (error) {
      console.warn(`Strategy ${i + 1} (${strategy.name}) failed:`, error);
      
      // If this is the last strategy, throw the error
      if (i === configs.length - 1) {
        console.error('❌ All Supabase client creation strategies failed');
        
        // Enhanced error reporting
        if (error instanceof Error) {
          if (error.message.includes('headers')) {
            throw new Error(`Supabase headers error (all strategies failed): ${error.message}`);
          } else if (error.message.includes('fetch')) {
            throw new Error(`Supabase fetch error (network issue): ${error.message}`);
          } else if (error.message.includes('crypto')) {
            throw new Error(`Supabase crypto error (WebCrypto issue): ${error.message}`);
          }
        }
        
        throw new Error(`All Supabase strategies failed. Last error: ${error}`);
      }
    }
  }
  
  // This should never be reached, but TypeScript requires it
  throw new Error('Unexpected error in Supabase client creation');
}

// Initialize the client
let supabaseClient: SupabaseClient<Database>

try {
  supabaseClient = createSupabaseClient()
} catch (error) {
  console.error('💥 Critical error initializing Supabase:', error)
  throw error
}

export const supabase = supabaseClient

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
   * Get price history for a token chart
   * Used for chart visualization
   */
  static async getTokenPriceHistory(tokenId: string, timeframe: string) {
    try {
      // Calculate the date range based on timeframe
      const now = new Date()
      let startDate = new Date()
      
      switch (timeframe) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
          break
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
          break
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
          break
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
          break
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // Default 24h
      }

      // For now, we'll generate some sample data based on transactions
      // In a real implementation, you'd have a price_history table
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('created_at, price_per_token, sol_amount, token_amount')
        .eq('token_id', tokenId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (error) throw error

      // If no transactions, generate some placeholder data
      if (!transactions || transactions.length === 0) {
        return this.generatePlaceholderPriceData(timeframe)
      }

      // Process transactions into price points
      const pricePoints = transactions.map((tx: any) => ({
        timestamp: tx.created_at,
        price: tx.price_per_token || 0.000001,
        volume: tx.sol_amount || 0
      }))

      // If we have less than 10 points, interpolate more data
      if (pricePoints.length < 10) {
        return this.interpolatePriceData(pricePoints, timeframe)
      }

      return pricePoints
    } catch (error) {
      console.error('Failed to get token price history:', error)
      // Return placeholder data on error
      return this.generatePlaceholderPriceData(timeframe)
    }
  }

  /**
   * Generate placeholder price data for charts when no real data exists
   */
  private static generatePlaceholderPriceData(timeframe: string) {
    const points = timeframe === '1h' ? 12 : timeframe === '24h' ? 24 : timeframe === '7d' ? 14 : 30
    const basePrice = 0.000001 + Math.random() * 0.001
    const data = []
    
    const now = new Date()
    const interval = timeframe === '1h' ? 5 * 60 * 1000 : // 5 minutes
                     timeframe === '24h' ? 60 * 60 * 1000 : // 1 hour  
                     timeframe === '7d' ? 12 * 60 * 60 * 1000 : // 12 hours
                     24 * 60 * 60 * 1000 // 24 hours

    for (let i = 0; i < points; i++) {
      const timestamp = new Date(now.getTime() - (points - 1 - i) * interval)
      const volatility = 0.1 // 10% volatility
      const change = (Math.random() - 0.5) * volatility
      const price = Math.max(0.000001, basePrice * (1 + change))
      
      data.push({
        timestamp: timestamp.toISOString(),
        price,
        volume: Math.random() * 1000
      })
    }

    return data
  }

  /**
   * Interpolate price data to have more data points for smoother charts
   */
  private static interpolatePriceData(pricePoints: any[], timeframe: string) {
    if (pricePoints.length === 0) {
      return this.generatePlaceholderPriceData(timeframe)
    }

    if (pricePoints.length === 1) {
      // Single point, create a flat line with small variations
      const basePrice = pricePoints[0].price
      const data = []
      const points = 20
      const now = new Date()
      const interval = 60 * 60 * 1000 // 1 hour

      for (let i = 0; i < points; i++) {
        const timestamp = new Date(now.getTime() - (points - 1 - i) * interval)
        const variation = (Math.random() - 0.5) * 0.02 // 2% variation
        
        data.push({
          timestamp: timestamp.toISOString(),
          price: basePrice * (1 + variation),
          volume: pricePoints[0].volume || 0
        })
      }

      return data
    }

    // Multiple points, interpolate between them
    return pricePoints
  }

  /**
   * Get trending tokens based on different criteria
   * Used for King of the Hill trending section
   */
  static async getTrendingTokens(sortBy: string = 'volume', limit: number = 10) {
    try {
      let orderColumn = 'volume_24h'
      let ascending = false

      switch (sortBy) {
        case 'volume':
          orderColumn = 'volume_24h'
          ascending = false
          break
        case 'price':
          orderColumn = 'current_price'
          ascending = false
          break
        case 'holders':
          orderColumn = 'holders_count'
          ascending = false
          break
        case 'new':
          orderColumn = 'created_at'
          ascending = false
          break
        case 'featured':
          // Special case for featured tokens
          break
        default:
          orderColumn = 'volume_24h'
          ascending = false
      }

      let query = supabase
        .from('tokens')
        .select(`
          *,
          creator:users(id, username, wallet_address)
        `)

      // Add filters based on sort type
      if (sortBy === 'featured') {
        query = query.eq('is_featured', true)
        orderColumn = 'volume_24h' // Still sort featured by volume
      }

      // Get trending tokens
      const { data: tokens, error } = await query
        .order(orderColumn, { ascending })
        .limit(limit)

      if (error) throw error

      // Calculate additional metrics for trending display
      const trendingTokens = (tokens || []).map((token: any) => {
        // Calculate mock price change (in real app, you'd track this)
        const mockPriceChange = (Math.random() - 0.5) * 40 // -20% to +20%
        const mockVolumeChange = Math.random() * 200 // 0% to 200%
        
        return {
          ...token,
          price_change_24h: mockPriceChange,
          volume_24h_change: mockVolumeChange,
          // Ensure bonding curve progress is calculated
          bonding_curve_progress: token.bonding_curve_progress || Math.min(
            (token.market_cap / 69000) * 100, 
            100
          )
        }
      })

      return trendingTokens
    } catch (error) {
      console.error('Failed to get trending tokens:', error)
      return []
    }
  }
}

// Export the configured client as default
export default supabase