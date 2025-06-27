<template>
  <div class="bg-gray-100 p-4 rounded-lg my-4">
    <h3 class="text-lg font-bold mb-4">Token Price Debug</h3>
    <div class="flex gap-2 mb-4">
      <button @click="debugTokenPrices" class="bg-blue-500 text-white px-4 py-2 rounded">
        Debug Token Prices
      </button>
      <button @click="fixTokenPrices" class="bg-green-500 text-white px-4 py-2 rounded">
        Fix Token Prices
      </button>
      <button @click="quickFixDatabase" class="bg-red-500 text-white px-4 py-2 rounded">
        Quick DB Fix
      </button>
      <button @click="testBondingCurve" class="bg-purple-500 text-white px-4 py-2 rounded">
        Test Bonding Curve
      </button>
    </div>
    
    <div v-if="fixing" class="bg-yellow-100 p-3 rounded mb-4">
      <p>🔧 Fixing token prices...</p>
    </div>
    
    <div v-if="debugResults" class="space-y-2">
      <div v-for="token in debugResults" :key="token.id" class="bg-white p-3 rounded">
        <p><strong>{{ token.name }} ({{ token.symbol }})</strong></p>
        <p>Mint: {{ token.mint_address }}</p>
        <p>Current Price: {{ token.current_price }}</p>
        <p>Market Cap: {{ token.market_cap }}</p>
        <p>Created: {{ token.created_at }}</p>
        <div v-if="bondingCurveResults[token.id]" class="mt-2 p-2 bg-blue-50 rounded">
          <p><strong>Bonding Curve:</strong></p>
          <p>Calculated Price: {{ bondingCurveResults[token.id].currentPrice?.toFixed(8) }}</p>
          <p>Virtual SOL: {{ bondingCurveResults[token.id].virtualSolReserves }}</p>
          <p>Virtual Tokens: {{ bondingCurveResults[token.id].virtualTokenReserves }}</p>
          <p>Progress: {{ bondingCurveResults[token.id].progress?.toFixed(2) }}%</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/services/supabase'

const debugResults = ref<any[]>([])
const bondingCurveResults = ref<Record<string, any>>({})
const fixing = ref(false)

const debugTokenPrices = async () => {
  try {
    console.log('🔍 Debugging token prices...')
    
    const { data: tokens, error } = await supabase
      .from('tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error

    console.log('📊 Token prices from database:', tokens)
    debugResults.value = tokens || []

    // Also test the price oracle for these tokens
    if (tokens && tokens.length > 0) {
      const { priceOracleService } = await import('@/services/priceOracle')
      
      for (const token of tokens.slice(0, 3)) { // Test first 3 tokens
        const priceData = await priceOracleService.getTokenPrice(token.mint_address)
        console.log(`🔍 Price oracle result for ${token.name}:`, priceData)
      }
    }
  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}

const testBondingCurve = async () => {
  try {
    console.log('🧮 Testing bonding curve calculations...')
    const { BondingCurveService } = await import('@/services/bondingCurve')
    
    for (const token of debugResults.value) {
      const state = await BondingCurveService.getTokenBondingCurveState(token.id)
      bondingCurveResults.value[token.id] = state
      console.log(`Bonding curve for ${token.name}:`, state)
    }
  } catch (error) {
    console.error('❌ Bonding curve test failed:', error)
  }
}

const fixTokenPrices = async () => {
  try {
    fixing.value = true
    console.log('🔧 Fixing token prices...')
    
    const { BondingCurveService } = await import('@/services/bondingCurve')
    
    // Calculate the correct initial price for new tokens
    const INITIAL_VIRTUAL_SOL_RESERVES = 30 // 30 SOL
    const INITIAL_VIRTUAL_TOKEN_RESERVES = 1073000000 // ~1.073B tokens
    const initialPrice = INITIAL_VIRTUAL_SOL_RESERVES / INITIAL_VIRTUAL_TOKEN_RESERVES
    
    console.log(`📊 Initial bonding curve price: ${initialPrice}`)
    
    for (const token of debugResults.value) {
      try {
        console.log(`\n🔍 Processing ${token.name} (${token.symbol})`)
        console.log(`Current price: ${token.current_price}`)
        console.log(`Current market cap: ${token.market_cap}`)
        
        // Calculate proper bonding curve state
        const state = await BondingCurveService.getTokenBondingCurveState(token.id)
        console.log(`Bonding curve state:`, state)
        
        // Determine the correct price to use
        let newPrice = token.current_price
        let newMarketCap = token.market_cap
        
        // If current price is 0 or very small, use calculated bonding curve price
        if (token.current_price === 0 || token.current_price < 0.000001) {
          // Use bonding curve calculated price if available, otherwise initial price
          newPrice = state.currentPrice > 0 ? state.currentPrice : initialPrice
          newMarketCap = state.marketCap > 0 ? state.marketCap : (newPrice * token.total_supply)
          
          console.log(`📈 Updating price from ${token.current_price} to ${newPrice}`)
          console.log(`📈 Updating market cap from ${token.market_cap} to ${newMarketCap}`)
          
          // Update token in database
          const { error } = await supabase
            .from('tokens')
            .update({
              current_price: newPrice,
              market_cap: newMarketCap
            })
            .eq('id', token.id)

          if (error) {
            console.error(`❌ Failed to update ${token.name}:`, error)
          } else {
            console.log(`✅ Updated ${token.name} successfully`)
            
            // Update the local data
            token.current_price = newPrice
            token.market_cap = newMarketCap
            
            // Also store in price history
            try {
              await supabase
                .from('token_price_history')
                .insert({
                  token_id: token.id,
                  price: newPrice,
                  market_cap: newMarketCap,
                  timestamp: new Date().toISOString()
                })
              console.log(`💾 Added price history entry for ${token.name}`)
            } catch (historyError) {
              console.warn(`⚠️ Failed to add price history for ${token.name}:`, historyError)
            }
          }
        } else {
          console.log(`✓ ${token.name} already has a reasonable price: ${token.current_price}`)
        }
      } catch (tokenError) {
        console.error(`❌ Error processing ${token.name}:`, tokenError)
      }
    }
    
    // Refresh the debug data to show updated values
    console.log('🔄 Refreshing debug data...')
    await debugTokenPrices()
    
    console.log('✅ Token price fixing completed!')
  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    fixing.value = false
  }
}

const quickFixDatabase = async () => {
  try {
    fixing.value = true
    console.log('🚀 Quick fixing database...')
    
    // Calculate the correct initial price
    const INITIAL_VIRTUAL_SOL_RESERVES = 30 // 30 SOL
    const INITIAL_VIRTUAL_TOKEN_RESERVES = 1073000000 // ~1.073B tokens
    const initialPrice = INITIAL_VIRTUAL_SOL_RESERVES / INITIAL_VIRTUAL_TOKEN_RESERVES
    
    console.log(`📊 Using initial price: ${initialPrice}`)
    
    // Update all tokens with zero or very small prices directly in database
    const { data: updatedTokens, error } = await supabase
      .from('tokens')
      .update({
        current_price: initialPrice
      })
      .or('current_price.eq.0,current_price.lt.0.000001')
      .select('id, name, symbol, current_price, market_cap, total_supply')
    
    if (error) {
      console.error('❌ Database update failed:', error)
      throw error
    }
    
    console.log(`✅ Updated ${updatedTokens?.length || 0} tokens:`, updatedTokens)
    
    // Update market caps separately for each token
    if (updatedTokens && updatedTokens.length > 0) {
      for (const token of updatedTokens) {
        const marketCap = initialPrice * token.total_supply
        
        await supabase
          .from('tokens')
          .update({ market_cap: marketCap })
          .eq('id', token.id)
      }
    }
    
    // Refresh the debug data
    await debugTokenPrices()
    
    console.log('✅ Quick database fix completed!')
  } catch (error) {
    console.error('❌ Quick fix failed:', error)
  } finally {
    fixing.value = false
  }
}
</script> 