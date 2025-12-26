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

// ==================== PRICE HISTORY ====================

export async function getTokenPriceHistory(tokenId: string, timeframe: string = '24h') {
  const response = await fetch(`${API_BASE_URL}/tokens/${tokenId}/price-history?timeframe=${timeframe}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch price history');
  return await response.json();
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
