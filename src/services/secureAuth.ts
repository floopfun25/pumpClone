/**
 * Secure Authentication Service
 * Handles wallet-based authentication with challenge-response
 */

import bs58 from 'bs58';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export interface AuthChallenge {
  challenge: string;
  timestamp: number;
  expiresAt: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string;
  user?: {
    id: number;
    walletAddress: string;
    username?: string;
  };
}

export class SecureAuthService {
  /**
   * Generate an authentication challenge for a wallet address
   */
  static generateChallenge(walletAddress: string): AuthChallenge {
    const timestamp = Date.now();
    const expiresAt = timestamp + 5 * 60 * 1000; // 5 minutes expiry
    const random = Math.random().toString(36).substring(2, 15);
    const challenge = `Sign this message to authenticate with FloppFun:\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\nNonce: ${random}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;

    return {
      challenge,
      timestamp,
      expiresAt,
    };
  }

  /**
   * Verify signature and authenticate user with backend
   */
  static async verifyAndAuthenticate(
    walletAddress: string,
    signature: Uint8Array,
    challenge: string,
    timestamp: number,
  ): Promise<AuthResult> {
    try {
      // Check if challenge is expired
      const now = Date.now();
      const expiresAt = timestamp + 5 * 60 * 1000;

      if (now > expiresAt) {
        return {
          success: false,
          error: 'Authentication challenge expired. Please try again.',
        };
      }

      // Convert signature to base58 for backend
      const signatureBase58 = bs58.encode(signature);

      // Send to backend for verification
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          message: challenge,
          signature: signatureBase58,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || 'Authentication failed',
        };
      }

      const data = await response.json();

      // Store JWT token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      return {
        success: true,
        token: data.token,
        user: data.user,
      };
    } catch (error) {
      console.error('Error verifying and authenticating:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Verify stored JWT token
   */
  static async verifyToken(): Promise<AuthResult> {
    try {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        return {
          success: false,
          error: 'No authentication token found',
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem('auth_token');
        return {
          success: false,
          error: 'Invalid or expired token',
        };
      }

      const data = await response.json();

      return {
        success: data.valid,
        token,
        user: data.user,
      };
    } catch (error) {
      console.error('Error verifying token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  /**
   * Logout and clear authentication
   */
  static logout(): void {
    localStorage.removeItem('auth_token');
  }

  /**
   * Get stored auth token
   */
  static getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}
