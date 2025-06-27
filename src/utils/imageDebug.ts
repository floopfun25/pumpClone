/**
 * Image debugging utilities
 */

/**
 * Test if an image URL is accessible and log detailed information
 */
export async function testImageUrl(url: string, context?: string): Promise<boolean> {
  if (!url) {
    console.log(`🔍 [IMAGE DEBUG] ${context || 'Image'}: No URL provided`)
    return false
  }

  console.log(`🔍 [IMAGE DEBUG] ${context || 'Image'}: Testing URL:`, url)

  try {
    // Test with fetch first
    const response = await fetch(url, { 
      method: 'HEAD',
      mode: 'cors'
    })
    
    console.log(`📡 [IMAGE DEBUG] ${context || 'Image'}: Fetch response:`, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
        'cache-control': response.headers.get('cache-control'),
        'access-control-allow-origin': response.headers.get('access-control-allow-origin')
      }
    })

    if (response.ok) {
      console.log(`✅ [IMAGE DEBUG] ${context || 'Image'}: URL is accessible`)
      return true
    } else {
      console.error(`❌ [IMAGE DEBUG] ${context || 'Image'}: URL returned error ${response.status}`)
      return false
    }
  } catch (fetchError) {
    console.error(`❌ [IMAGE DEBUG] ${context || 'Image'}: Fetch failed:`, fetchError)
    
    // Try with Image element as fallback
    return new Promise((resolve) => {
      const img = new Image()
      
      img.onload = () => {
        console.log(`✅ [IMAGE DEBUG] ${context || 'Image'}: Image element loaded successfully`)
        resolve(true)
      }
      
      img.onerror = (error) => {
        console.error(`❌ [IMAGE DEBUG] ${context || 'Image'}: Image element failed:`, error)
        resolve(false)
      }
      
      img.src = url
      
      // Timeout after 10 seconds
      setTimeout(() => {
        console.warn(`⏰ [IMAGE DEBUG] ${context || 'Image'}: Image load timeout`)
        resolve(false)
      }, 10000)
    })
  }
}

/**
 * Test multiple image URLs and report results
 */
export async function testMultipleImageUrls(urls: Array<{url: string, context: string}>): Promise<void> {
  console.log(`🔍 [IMAGE DEBUG] Testing ${urls.length} image URLs...`)
  
  const results = await Promise.allSettled(
    urls.map(({url, context}) => testImageUrl(url, context))
  )
  
  let successCount = 0
  let failCount = 0
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      successCount++
    } else {
      failCount++
    }
  })
  
  console.log(`📊 [IMAGE DEBUG] Results: ${successCount} successful, ${failCount} failed`)
}

/**
 * Analyze Supabase storage URL structure
 */
export function analyzeSupabaseUrl(url: string): void {
  if (!url) {
    console.log('🔍 [URL ANALYSIS] No URL provided')
    return
  }

  console.log('🔍 [URL ANALYSIS] Analyzing URL:', url)
  
  try {
    const urlObj = new URL(url)
    
    console.log('📋 [URL ANALYSIS] URL Components:', {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      pathname: urlObj.pathname,
      search: urlObj.search,
      hash: urlObj.hash
    })
    
    // Check if it's a Supabase URL
    if (urlObj.hostname.includes('supabase.co')) {
      const pathParts = urlObj.pathname.split('/')
      console.log('🏪 [URL ANALYSIS] Supabase URL detected:', {
        bucket: pathParts[4], // Usually the bucket name
        filepath: pathParts.slice(5).join('/'),
        isPublic: urlObj.pathname.includes('/public/'),
        project: urlObj.hostname.split('.')[0]
      })
    }
    
    // Check URL accessibility patterns
    if (urlObj.protocol === 'https:') {
      console.log('✅ [URL ANALYSIS] Uses HTTPS (good)')
    } else {
      console.log('⚠️ [URL ANALYSIS] Not using HTTPS')
    }
    
  } catch (error) {
    console.error('❌ [URL ANALYSIS] Invalid URL:', error)
  }
} 