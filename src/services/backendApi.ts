/**
 * Backend API Service
 * Direct communication with Spring Boot backend
 */

const API_BASE_URL = 'http://localhost:8080/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('jwtToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// ==================== TOKEN METADATA ====================

export async function getTokenByMintAddress(mintAddress: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/mint/${mintAddress}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch token metadata');
  }
  return await response.json();
}

// ==================== PRICE HISTORY ====================

export async function getTokenPriceHistory(tokenId: string, timeframe: string = '24h') {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/price-history?timeframe=${timeframe}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch price history');
  return await response.json();
}

export async function recordTradePrice(tokenId: string, price: number, volume: number, marketCap: number, tradeType: 'BUY' | 'SELL') {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/record-trade`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      price,
      volume,
      marketCap,
      tradeType
    })
  });
  if (!response.ok) {
    console.warn('Failed to record trade price, but continuing');
  }
}

export async function getToken24hStats(tokenId: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/stats`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch token stats');
  return await response.json();
}

// ==================== TOKEN HOLDERS ====================

export async function getTokenTopHolders(tokenId: string, limit: number = 20) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/holders?limit=${limit}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch token holders');
  return await response.json();
}

export async function getTokenHoldersCount(tokenId: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/holders/count`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch holders count');
  const data = await response.json();
  return data.count;
}

// ==================== COMMENTS ====================

export async function getTokenComments(tokenId: string, page: number = 0, size: number = 20) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/comments?page=${page}&size=${size}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch comments');
  return await response.json();
}

export async function createTokenComment(tokenId: string, content: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/comments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content })
  });
  if (!response.ok) throw new Error('Failed to create comment');
  return await response.json();
}

export async function updateComment(tokenId: string, commentId: string, content: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/comments/${commentId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content })
  });
  if (!response.ok) throw new Error('Failed to update comment');
  return await response.json();
}

export async function deleteComment(tokenId: string, commentId: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to delete comment');
}

export async function likeComment(tokenId: string, commentId: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/comments/${commentId}/like`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to like comment');
}

export async function unlikeComment(tokenId: string, commentId: string) {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/comments/${commentId}/like`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to unlike comment');
}

// ==================== WATCHLIST ====================

export async function getWatchlist() {
  const response = await fetch(`${API_BASE_URL}/watchlist`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch watchlist');
  return await response.json();
}

export async function addToWatchlist(tokenId: string) {
  const response = await fetch(`${API_BASE_URL}/watchlist/tokens/${tokenId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to add to watchlist');
}

export async function removeFromWatchlist(tokenId: string) {
  const response = await fetch(`${API_BASE_URL}/watchlist/tokens/${tokenId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to remove from watchlist');
}

export async function isTokenInWatchlist(tokenId: string) {
  const response = await fetch(`${API_BASE_URL}/watchlist/tokens/${tokenId}/check`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) return false;
  const data = await response.json();
  return data.isInWatchlist;
}

// ==================== PORTFOLIO TRACKING ====================

export async function storePortfolioSnapshot(snapshot: {
  totalValue: number;
  solBalance: number;
  solValue: number;
  tokenValue: number;
  tokenCount: number;
}) {
  const response = await fetch(`${API_BASE_URL}/portfolio/snapshot`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) throw new Error('Failed to store portfolio snapshot');
}

export async function get24hPortfolioChange(currentValue: number) {
  const response = await fetch(`${API_BASE_URL}/portfolio/24h-change?currentValue=${currentValue}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to get 24h portfolio change');
  return await response.json();
}

// ==================== BONDING CURVE ====================

export async function getBondingCurveProgress(tokenId: string) {
  // Not implemented yet in backend
  console.warn('Bonding curve progress not implemented in backend yet');
  return {
    progress: 0,
    currentMarketCap: 0,
    targetMarketCap: 0
  };
}
