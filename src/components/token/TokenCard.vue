<template>
  <!-- Token card component for displaying token information in a grid -->
  <div class="token-card bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 cursor-pointer transform transition-all duration-200 hover:scale-105 hover:shadow-lg">
    <!-- Token Image and Header -->
    <div class="flex items-start gap-4 mb-4">
      <!-- Token Image -->
      <div class="w-12 h-12 rounded-full overflow-hidden">
        <img 
          v-if="token?.image_url" 
          :src="token.image_url" 
          :alt="tokenName"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
          {{ tokenSymbol.slice(0, 2) }}
        </div>
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
      <span 
        :class="[
          'px-2 py-1 text-xs font-medium rounded-full',
          token?.status === 'graduated' ? 'bg-purple-500 text-white' :
          token?.status === 'active' ? 'bg-pump-green text-white' :
          'bg-gray-500 text-white'
        ]"
      >
        {{ statusText }}
      </span>
    </div>
    
    <!-- Token Metrics -->
    <div class="space-y-3">
      <!-- Price -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('token.price') }}</span>
        <span class="font-medium text-gray-900 dark:text-white">
          ${{ currentPrice }}
        </span>
      </div>
      
      <!-- Market Cap -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('token.marketCap') }}</span>
        <span class="font-medium text-gray-900 dark:text-white">
          ${{ marketCap }}
        </span>
      </div>
      
      <!-- Volume 24h -->
      <div class="flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ $t('token.volume24h') }}</span>
        <span class="font-medium text-pump-green">
          ${{ volume24h }}
        </span>
      </div>
      
      <!-- Progress Bar for Bonding Curve -->
      <div class="pt-2">
        <div class="flex justify-between items-center mb-1">
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ $t('token.progress') }}</span>
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ progress }}%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            class="bg-gradient-to-r from-pump-green to-primary-500 h-2 rounded-full transition-all duration-300" 
            :style="`width: ${progress}%`"
          ></div>
        </div>
      </div>
    </div>
    
    <!-- Creator Info -->
    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{{ $t('token.createdBy') }}</span>
        <span class="font-medium text-primary-600 dark:text-primary-400">
          {{ creatorAddress }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Component props for token data
const props = defineProps<{
  token: {
    id: string
    name: string
    symbol: string
    image_url?: string
    creator_address?: string
    current_price: number
    market_cap: number
    volume_24h: number
    bonding_curve_progress: number
    status: string
    creator?: {
      username?: string
      wallet_address: string
    }
  }
}>()

// Computed properties for display with proper fallbacks
const tokenName = computed(() => props.token?.name || t('common.unknown'))
const tokenSymbol = computed(() => props.token?.symbol || 'N/A')

const statusText = computed(() => {
  const status = props.token?.status || 'active'
  switch (status) {
    case 'graduated':
      return t('token.graduated')
    case 'active':
      return t('common.active')
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
})

const creatorAddress = computed(() => {
  if (props.token?.creator?.username) {
    return props.token.creator.username
  }
  if (props.token?.creator?.wallet_address) {
    return `${props.token.creator.wallet_address.slice(0, 4)}...${props.token.creator.wallet_address.slice(-4)}`
  }
  if (props.token?.creator_address) {
    return `${props.token.creator_address.slice(0, 4)}...${props.token.creator_address.slice(-4)}`
  }
  return t('common.unknown')
})

const currentPrice = computed(() => {
  return props.token?.current_price?.toFixed(6) || '0.000000'
})

const marketCap = computed(() => {
  const cap = props.token?.market_cap || 0
  if (cap >= 1000000) return `${(cap / 1000000).toFixed(1)}M`
  if (cap >= 1000) return `${(cap / 1000).toFixed(1)}K`
  return cap.toString()
})

const volume24h = computed(() => {
  const volume = props.token?.volume_24h || 0
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`
  return volume.toString()
})

const progress = computed(() => {
  return Math.round(props.token?.bonding_curve_progress || 0)
})
</script>

<style scoped>
/* Component-specific styles are handled by Tailwind classes */
</style> 