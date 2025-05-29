<template>
  <!-- Token card component for displaying token information in a grid -->
  <div class="token-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-lg">
    <!-- Token Image and Header -->
    <div class="flex items-start gap-4 mb-4">
      <div class="w-12 h-12 bg-gradient-to-br from-primary-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
        {{ tokenSymbol }}
      </div>
      
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 dark:text-white truncate">
          {{ tokenName }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          ${{ tokenSymbol }}
        </p>
      </div>
      
      <!-- Status Badge -->
      <span class="px-2 py-1 text-xs font-medium rounded-full bg-pump-green text-white">
        Active
      </span>
    </div>
    
    <!-- Token Metrics -->
    <div class="space-y-3">
      <!-- Price -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">Price</span>
        <span class="font-medium text-gray-900 dark:text-white">
          $0.0001234
        </span>
      </div>
      
      <!-- Market Cap -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">Market Cap</span>
        <span class="font-medium text-gray-900 dark:text-white">
          $12.3K
        </span>
      </div>
      
      <!-- Volume 24h -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">24h Volume</span>
        <span class="font-medium text-pump-green">
          $456
        </span>
      </div>
      
      <!-- Progress Bar for Bonding Curve -->
      <div class="pt-2">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs text-gray-600 dark:text-gray-400">Progress</span>
          <span class="text-xs text-gray-600 dark:text-gray-400">15%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div class="bg-gradient-to-r from-pump-green to-primary-500 h-2 rounded-full" style="width: 15%"></div>
        </div>
      </div>
    </div>
    
    <!-- Creator Info -->
    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Created by</span>
        <span class="font-medium text-primary-600 dark:text-primary-400">
          {{ creatorAddress }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
// Component props for token data
const props = defineProps({
  token: {
    type: Object,
    default: () => ({
      id: '1',
      name: 'Sample Token',
      symbol: 'SAMPLE',
      mint_address: 'ABC123...',
      creator_address: '123...456',
      current_price: 0.0001234,
      market_cap: 12300,
      volume_24h: 456,
      bonding_curve_progress: 15
    })
  }
})

// Computed properties for display
const tokenName = props.token?.name || 'Sample Token'
const tokenSymbol = props.token?.symbol || 'SAMPLE'
const creatorAddress = props.token?.creator_address 
  ? `${props.token.creator_address.slice(0, 4)}...${props.token.creator_address.slice(-4)}`
  : '123...456'
</script>

<style scoped>
/* Component-specific styles are handled by Tailwind classes */
</style> 