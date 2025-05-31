<template>
  <div class="simple-chart-container">
    <!-- Chart Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center space-x-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ tokenSymbol }} Price Chart
        </h2>
        <div v-if="currentPrice" class="flex items-center space-x-2">
          <span class="text-2xl font-bold text-gray-900 dark:text-white">
            ${{ formatPrice(currentPrice) }}
          </span>
          <span :class="[
            'text-sm font-medium px-2 py-1 rounded',
            priceChange >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          ]">
            {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
          </span>
        </div>
      </div>
      
      <!-- Chart Controls -->
      <div class="flex items-center space-x-3">
        <!-- Timeframe Selector -->
        <div class="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          <button
            v-for="timeframe in timeframes"
            :key="timeframe.value"
            @click="setTimeframe(timeframe.value)"
            :class="[
              'px-3 py-1 text-sm rounded-md transition-colors',
              selectedTimeframe === timeframe.value
                ? 'bg-primary-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            ]"
          >
            {{ timeframe.label }}
          </button>
        </div>
        
        <!-- Refresh Button -->
        <button
          @click="refreshChart"
          :disabled="loading"
          class="p-2 text-primary-600 hover:text-primary-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh Chart"
        >
          <div class="w-4 h-4" :class="loading ? 'animate-spin' : ''">⟳</div>
        </button>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10 rounded-lg">
        <div class="flex flex-col items-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mb-2"></div>
          <span class="text-sm text-gray-600 dark:text-gray-400">Loading chart data...</span>
        </div>
      </div>
      
      <!-- Error State -->
      <div v-if="error" class="h-96 flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-2">⚠️</div>
          <p class="text-red-500 mb-2">{{ error }}</p>
          <button @click="refreshChart" class="text-sm text-primary-600 hover:text-primary-700">
            Try Again
          </button>
        </div>
      </div>
      
      <!-- No Data State -->
      <div v-else-if="!hasData && !loading" class="h-96 flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-2">📈</div>
          <p class="text-gray-500 dark:text-gray-400 mb-1">No price data available yet</p>
          <p class="text-sm text-gray-400 dark:text-gray-500">Start trading to see price movements</p>
        </div>
      </div>
      
      <!-- Simple Chart Canvas -->
      <div v-else class="h-96 w-full">
        <svg ref="chartSvg" class="w-full h-full">
          <!-- Price Line using path instead of polyline -->
          <path
            v-if="chartPath"
            :d="chartPath"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2"
            class="transition-all duration-300"
          />
          
          <!-- Price Area -->
          <path
            v-if="areaPath"
            :d="areaPath"
            fill="url(#priceGradient)"
            class="transition-all duration-300"
          />
          
          <!-- Gradient Definition -->
          <defs>
            <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
              <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0" />
            </linearGradient>
          </defs>
          
          <!-- Data Points -->
          <circle
            v-for="(point, index) in validChartPoints"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            r="3"
            fill="#3b82f6"
            class="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            @mouseenter="showTooltip(point, index)"
            @mouseleave="hideTooltip"
          />
        </svg>
        
        <!-- Chart Tooltip -->
        <div
          v-if="tooltip.show"
          class="absolute bg-gray-900 text-white text-xs rounded px-2 py-1 pointer-events-none z-20"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
        >
          <div>Price: ${{ formatPrice(tooltip.price) }}</div>
          <div>Time: {{ tooltip.time }}</div>
        </div>
      </div>
    </div>

    <!-- Chart Stats -->
    <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div class="text-center">
        <div class="text-sm text-gray-500 dark:text-gray-400">Current</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatPrice(currentPrice) }}
        </div>
      </div>
      
      <div class="text-center">
        <div class="text-sm text-gray-500 dark:text-gray-400">24h Change</div>
        <div :class="[
          'text-lg font-semibold',
          priceChange >= 0 ? 'text-green-600' : 'text-red-600'
        ]">
          {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </div>
      </div>
      
      <div class="text-center">
        <div class="text-sm text-gray-500 dark:text-gray-400">24h High</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatPrice(high24h) }}
        </div>
      </div>
      
      <div class="text-center">
        <div class="text-sm text-gray-500 dark:text-gray-400">24h Low</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatPrice(low24h) }}
        </div>
      </div>
      
      <div class="text-center">
        <div class="text-sm text-gray-500 dark:text-gray-400">24h Volume</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatVolume(volume24h) }}
        </div>
      </div>
      
      <div class="text-center">
        <div class="text-sm text-gray-500 dark:text-gray-400">Market Cap</div>
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatMarketCap(marketCap) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { priceOracleService, formatPrice, formatMarketCap, formatVolume } from '@/services/priceOracle'
import { SupabaseService } from '@/services/supabase'

interface Props {
  tokenId: string
  tokenSymbol: string
  mintAddress?: string
}

interface ChartDataPoint {
  time: number
  price: number
  volume?: number
}

interface ChartPoint {
  x: number
  y: number
  time: string
  price: number
}

const props = defineProps<Props>()

// Chart state
const chartSvg = ref<SVGElement>()
const loading = ref(false)
const error = ref('')

// Data state
const chartData = ref<ChartDataPoint[]>([])
const selectedTimeframe = ref('24h')

// Real-time subscription
let priceSubscription: (() => void) | null = null

// Tooltip state
const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  price: 0,
  time: ''
})

// Configuration
const timeframes = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' }
]

// Computed properties
const hasData = computed(() => chartData.value.length > 0)

const currentPrice = computed(() => {
  if (!hasData.value) return 0
  return chartData.value[chartData.value.length - 1]?.price || 0
})

const priceChange = computed(() => {
  if (chartData.value.length < 2) return 0
  const current = currentPrice.value
  const previous = chartData.value[0]?.price || current
  return previous ? ((current - previous) / previous) * 100 : 0
})

const high24h = computed(() => {
  if (!hasData.value) return 0
  return Math.max(...chartData.value.map(d => d.price))
})

const low24h = computed(() => {
  if (!hasData.value) return 0
  return Math.min(...chartData.value.map(d => d.price))
})

const volume24h = computed(() => {
  if (!hasData.value) return 0
  return chartData.value.reduce((sum, d) => sum + (d.volume || 0), 0)
})

const marketCap = computed(() => {
  // This would be calculated based on total supply and current price
  return currentPrice.value * 1000000 // Mock calculation
})

// Chart rendering
const chartPoints = computed<ChartPoint[]>(() => {
  if (!hasData.value || !chartSvg.value) return []
  
  const svgRect = chartSvg.value.getBoundingClientRect()
  const width = svgRect.width || 800
  const height = svgRect.height || 384
  const padding = 20
  
  const minPrice = low24h.value
  const maxPrice = high24h.value
  const priceRange = maxPrice - minPrice || 1
  
  return chartData.value.map((point, index) => ({
    x: padding + (index / (chartData.value.length - 1)) * (width - 2 * padding),
    y: height - padding - ((point.price - minPrice) / priceRange) * (height - 2 * padding),
    time: new Date(point.time).toLocaleTimeString(),
    price: point.price
  }))
})

const chartPath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  
  // Validate all points have valid coordinates
  const validPoints = chartPoints.value.filter(point => 
    !isNaN(point.x) && !isNaN(point.y) && 
    isFinite(point.x) && isFinite(point.y)
  )
  
  if (validPoints.length === 0) return ''
  
  return validPoints.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`
  ).join(' ')
})

const areaPath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  
  // Validate all points have valid coordinates
  const validPoints = chartPoints.value.filter(point => 
    !isNaN(point.x) && !isNaN(point.y) && 
    isFinite(point.x) && isFinite(point.y)
  )
  
  if (validPoints.length === 0) return ''
  
  const firstPoint = validPoints[0]
  const lastPoint = validPoints[validPoints.length - 1]
  const validPath = chartPath.value
  
  if (!validPath || !firstPoint || !lastPoint) return ''
  
  return `M ${firstPoint.x},${firstPoint.y} ${validPath.substring(1)} L ${lastPoint.x},384 L ${firstPoint.x},384 Z`
})

const validChartPoints = computed(() => {
  return chartPoints.value.filter(point => 
    !isNaN(point.x) && !isNaN(point.y) && 
    isFinite(point.x) && isFinite(point.y) &&
    point.x >= 0 && point.y >= 0 // Ensure positive coordinates
  )
})

// Methods
const loadChartData = async () => {
  if (!props.tokenId) return

  loading.value = true
  error.value = ''

  try {
    // Get price history from Supabase
    const priceHistory = await SupabaseService.getTokenPriceHistory(props.tokenId, selectedTimeframe.value)
    
    if (priceHistory.length === 0) {
      // Generate some mock data for demonstration
      chartData.value = generateMockChartData()
    } else {
      // Convert price history to chart format
      chartData.value = priceHistory.map(item => ({
        time: new Date(item.timestamp).getTime(),
        price: item.price || 0.000001,
        volume: item.volume || Math.random() * 1000
      }))
    }

  } catch (err) {
    console.error('Failed to load chart data:', err)
    error.value = 'Failed to load chart data'
  } finally {
    loading.value = false
  }
}

const generateMockChartData = (): ChartDataPoint[] => {
  const data: ChartDataPoint[] = []
  const basePrice = 0.001
  let currentPrice = basePrice
  const now = Date.now()
  const interval = selectedTimeframe.value === '1h' ? 5 * 60 * 1000 : // 5 minutes
                   selectedTimeframe.value === '4h' ? 15 * 60 * 1000 : // 15 minutes
                   selectedTimeframe.value === '24h' ? 60 * 60 * 1000 : // 1 hour
                   selectedTimeframe.value === '7d' ? 4 * 60 * 60 * 1000 : // 4 hours
                   24 * 60 * 60 * 1000 // 1 day

  const points = selectedTimeframe.value === '1h' ? 12 :
                 selectedTimeframe.value === '4h' ? 16 :
                 selectedTimeframe.value === '24h' ? 24 :
                 selectedTimeframe.value === '7d' ? 42 : 30

  for (let i = 0; i < points; i++) {
    const time = now - (points - 1 - i) * interval
    const volatility = 0.05 // 5% volatility
    const change = (Math.random() - 0.5) * volatility
    
    currentPrice *= (1 + change)
    
    data.push({
      time,
      price: currentPrice,
      volume: Math.random() * 1000 + 100
    })
  }

  return data
}

const setTimeframe = async (timeframe: string) => {
  selectedTimeframe.value = timeframe
  await loadChartData()
}

const refreshChart = async () => {
  await loadChartData()
}

const showTooltip = (point: ChartPoint, index: number) => {
  tooltip.value = {
    show: true,
    x: point.x,
    y: point.y - 30,
    price: point.price,
    time: point.time
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

const setupRealTimeUpdates = () => {
  if (!props.mintAddress) return
  
  priceSubscription = priceOracleService.subscribe(props.mintAddress, (priceData: any) => {
    // Add new price data to chart
    const newPoint: ChartDataPoint = {
      time: Date.now(),
      price: priceData.price,
      volume: Math.random() * 100 // Mock volume
    }
    
    chartData.value.push(newPoint)
    
    // Keep only recent data based on timeframe
    const maxPoints = selectedTimeframe.value === '1h' ? 12 :
                     selectedTimeframe.value === '4h' ? 16 :
                     selectedTimeframe.value === '24h' ? 24 :
                     selectedTimeframe.value === '7d' ? 42 : 30
    
    if (chartData.value.length > maxPoints) {
      chartData.value = chartData.value.slice(-maxPoints)
    }
  })
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  await loadChartData()
  setupRealTimeUpdates()
})

onUnmounted(() => {
  if (priceSubscription) {
    priceSubscription()
  }
})

// Watch for token changes
watch(() => props.tokenId, async () => {
  if (priceSubscription) {
    priceSubscription()
  }
  
  await loadChartData()
  setupRealTimeUpdates()
})
</script>

<style scoped>
.simple-chart-container {
  @apply w-full;
}

svg {
  overflow: visible;
}
</style> 