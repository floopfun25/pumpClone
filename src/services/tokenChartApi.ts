import { SupabaseService } from '@/services/supabase'
export async function fetchTokenChartDataWithFallback(tokenId: string, tokenSymbol: string, interval: string = '1h') {
  let errorLog = [];
  // Try Birdeye
  try {
    const birdeyeData = await retryFetch(() => fetchBirdeyeChartData(tokenId, interval))
    if (birdeyeData.length > 0) return birdeyeData;
    errorLog.push('Birdeye returned no data')
  } catch (err) {
    errorLog.push(`Birdeye failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('Birdeye failed:', err)
  }
  // Try CoinGecko
  try {
    const days = interval === '24h' ? 1 : 7
    const coingeckoData = await retryFetch(() => fetchCoinGeckoChartData(tokenSymbol.toLowerCase(), days))
    if (coingeckoData.length > 0) return coingeckoData;
    errorLog.push('CoinGecko returned no data')
  } catch (err) {
    errorLog.push(`CoinGecko failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('CoinGecko failed:', err)
  }
  // Try Supabase
  try {
    const supabaseData = await SupabaseService.getTokenPriceHistory(tokenId, interval)
    if (supabaseData && supabaseData.length > 0) return supabaseData;
    errorLog.push('Supabase returned no data')
  } catch (err) {
    errorLog.push(`Supabase failed: ${err instanceof Error ? err.message : String(err)}`)
    console.error('Supabase failed:', err)
  }
  // All sources failed
  const errorMsg = `All chart data sources failed.\nDetails: ${errorLog.join(' | ')}`
  throw new Error(errorMsg)
}
// Helper: retry fetch
async function retryFetch(fn: () => Promise<any[]>, retries = 2, delay = 500): Promise<any[]> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await fn()
      if (result && result.length > 0) return result
    } catch (err) {
      if (i === retries) throw err
      await new Promise(res => setTimeout(res, delay))
    }
  }
  return []

}
// src/services/tokenChartApi.ts
// Service to fetch token price history from Birdeye and CoinGecko

export async function fetchBirdeyeChartData(tokenAddress: string, interval: string = '1h') {
  try {
    const url = `https://public-api.birdeye.so/public/token/${tokenAddress}/chart?interval=${interval}`
    const response = await fetch(url)
    if (!response.ok) throw new Error('Birdeye API error')
    const data = await response.json()
    // Format data for chart.js
    return (data.data || []).map((point: any) => ({
      timestamp: point.timestamp,
      price: point.price,
      volume: point.volume
    }))
  } catch (err) {
    console.error('Birdeye chart fetch failed:', err)
    return []
  }
}

export async function fetchCoinGeckoChartData(tokenId: string, days: number = 1) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${tokenId}/market_chart?vs_currency=usd&days=${days}`
    const response = await fetch(url)
    if (!response.ok) throw new Error('CoinGecko API error')
    const data = await response.json()
    // Format data for chart.js
    return (data.prices || []).map((point: any) => ({
      timestamp: point[0],
      price: point[1]
    }))
  } catch (err) {
    console.error('CoinGecko chart fetch failed:', err)
    return []
  }
}
