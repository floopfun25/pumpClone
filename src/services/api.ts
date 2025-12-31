/**
 * FloppFun API Service
 * Connects to Spring Boot backend instead of Supabase
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Types
export interface User {
  id: number;
  walletAddress: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  twitterHandle?: string;
  telegramHandle?: string;
  createdAt: string;
}

export interface Token {
  id: number;
  mintAddress: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  metadataUri: string;
  creatorId: number;
  creator?: User;
  totalSupply: number;
  currentPrice: number;
  marketCap: number;
  solInBondingCurve: number;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  hasGraduated: boolean;
  graduatedAt?: string;
  createdAt: string;
}

export interface Transaction {
  id: number;
  signature: string;
  tokenId: number;
  tokenSymbol: string;
  tokenName: string;
  userId: number;
  userWalletAddress: string;
  transactionType: 'BUY' | 'SELL';
  solAmount: number;
  tokenAmount: number;
  pricePerToken: number;
  platformFee: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  blockTime?: number;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  pageable: {
    pageNumber: number;
    pageSize: number;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  first: boolean;
}

// Helper function to get JWT token
function getAuthHeader(): Record<string, string> {
  // Try both key formats for compatibility
  const token = localStorage.getItem('jwtToken') || localStorage.getItem('jwt_token');
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

/**
 * Authentication API
 */
export const authAPI = {
  /**
   * Login with wallet signature
   */
  async login(walletAddress: string, message: string, signature: string): Promise<{ token: string; user: User }> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress, message, signature }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    // Store JWT token (use consistent key)
    localStorage.setItem('jwtToken', data.token);
    localStorage.setItem('jwt_token', data.token); // Legacy support
    return data;
  },

  /**
   * Verify JWT token
   */
  async verify(): Promise<{ valid: boolean; user: User }> {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Token verification failed');
    }

    return response.json();
  },

  /**
   * Logout (clear local token)
   */
  logout() {
    localStorage.removeItem('jwt_token');
  },
};

/**
 * Token API
 */
export const tokenAPI = {
  /**
   * Get all tokens (paginated)
   */
  async getAllTokens(page = 0, size = 20): Promise<PageResponse<Token>> {
    const response = await fetch(`${API_BASE_URL}/tokens?page=${page}&size=${size}`);

    if (!response.ok) {
      throw new Error('Failed to fetch tokens');
    }

    return response.json();
  },

  /**
   * Get token by ID
   */
  async getTokenById(id: number): Promise<Token> {
    const response = await fetch(`${API_BASE_URL}/tokens/${id}`);

    if (!response.ok) {
      throw new Error('Token not found');
    }

    return response.json();
  },

  /**
   * Get token by mint address
   */
  async getTokenByMint(mintAddress: string): Promise<Token> {
    const response = await fetch(`${API_BASE_URL}/tokens/mint/${mintAddress}`);

    if (!response.ok) {
      throw new Error('Token not found');
    }

    return response.json();
  },

  /**
   * Get trending tokens
   */
  async getTrendingTokens(page = 0, size = 20): Promise<PageResponse<Token>> {
    const response = await fetch(`${API_BASE_URL}/tokens/trending?page=${page}&size=${size}`);

    if (!response.ok) {
      throw new Error('Failed to fetch trending tokens');
    }

    return response.json();
  },

  /**
   * Search tokens
   */
  async searchTokens(query: string, page = 0, size = 20): Promise<PageResponse<Token>> {
    const response = await fetch(`${API_BASE_URL}/tokens/search?q=${encodeURIComponent(query)}&page=${page}&size=${size}`);

    if (!response.ok) {
      throw new Error('Search failed');
    }

    return response.json();
  },

  /**
   * Get tokens by creator ID
   */
  async getTokensByCreator(creatorId: number, page = 0, size = 20): Promise<PageResponse<Token>> {
    const response = await fetch(`${API_BASE_URL}/tokens/creator/${creatorId}?page=${page}&size=${size}`);

    if (!response.ok) {
      throw new Error('Failed to fetch creator tokens');
    }

    return response.json();
  },

  /**
   * Create a new token
   */
  async createToken(data: {
    name: string;
    symbol: string;
    description: string;
    imageFile: File;
    mintAddress: string;
    metadataUri: string;
    totalSupply: number;
    decimals: number;
  }): Promise<Token> {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('symbol', data.symbol);
    formData.append('description', data.description);
    formData.append('image', data.imageFile);
    formData.append('mintAddress', data.mintAddress);
    formData.append('metadataUri', data.metadataUri);
    formData.append('totalSupply', data.totalSupply.toString());
    formData.append('decimals', data.decimals.toString());

    const response = await fetch(`${API_BASE_URL}/tokens/create`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });

    if (!response.ok) {
      // Enhanced error handling
      let errorMessage = 'Failed to create token';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If response is not JSON (like 403 HTML response), use status text
        errorMessage = `${response.status} ${response.statusText}`;
      }

      console.error('Token creation failed:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        hasJWT: !!localStorage.getItem('jwtToken'),
      });

      throw new Error(errorMessage);
    }

    return response.json();
  },
};

/**
 * Trading API
 */
export const tradingAPI = {
  /**
   * Buy tokens
   */
  async buyTokens(data: {
    mintAddress: string;
    amount: number;
    walletAddress: string;
    signature: string;
  }): Promise<{ status: string; message: string; signature?: string }> {
    const response = await fetch(`${API_BASE_URL}/trades/buy`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Buy failed');
    }

    return response.json();
  },

  /**
   * Sell tokens
   */
  async sellTokens(data: {
    mintAddress: string;
    amount: number;
    walletAddress: string;
    signature: string;
  }): Promise<{ status: string; message: string; signature?: string }> {
    const response = await fetch(`${API_BASE_URL}/trades/sell`, {
      method: 'POST',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sell failed');
    }

    return response.json();
  },

  /**
   * Get token transactions
   */
  async getTokenTransactions(tokenId: number, page = 0, size = 20): Promise<PageResponse<Transaction>> {
    const response = await fetch(`${API_BASE_URL}/trades/token/${tokenId}?page=${page}&size=${size}`);

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    return response.json();
  },

  /**
   * Get user transactions
   */
  async getUserTransactions(userId: number, page = 0, size = 20): Promise<PageResponse<Transaction>> {
    const response = await fetch(`${API_BASE_URL}/trades/user/${userId}?page=${page}&size=${size}`);

    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    return response.json();
  },

  /**
   * Get transaction by signature
   */
  async getTransactionBySignature(signature: string): Promise<Transaction> {
    const response = await fetch(`${API_BASE_URL}/trades/signature/${signature}`);

    if (!response.ok) {
      throw new Error('Transaction not found');
    }

    return response.json();
  },
};

/**
 * User API
 */
export const userAPI = {
  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/${id}`);

    if (!response.ok) {
      throw new Error('User not found');
    }

    return response.json();
  },

  /**
   * Get user by wallet address
   */
  async getUserByWallet(walletAddress: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/wallet/${walletAddress}`);

    if (!response.ok) {
      throw new Error('User not found');
    }

    return response.json();
  },

  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return response.json();
  },

  /**
   * Update user profile
   */
  async updateProfile(data: {
    username?: string;
    bio?: string;
    avatarUrl?: string;
    twitterHandle?: string;
    telegramHandle?: string;
  }): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return response.json();
  },

  /**
   * Get user holdings
   */
  async getUserHoldings(userId: number): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/holdings`);

    if (!response.ok) {
      throw new Error('Failed to fetch holdings');
    }

    return response.json();
  },
};

// Export all
export const api = {
  auth: authAPI,
  tokens: tokenAPI,
  trading: tradingAPI,
  users: userAPI,
};

export default api;
