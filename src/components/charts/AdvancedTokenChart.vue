<template>
  <div class="advanced-chart-container">
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
        
        <!-- Chart Type Selector -->
        <div class="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          <button
            v-for="chartType in chartTypes"
            :key="chartType.value"
            @click="setChartType(chartType.value)"
            :class="[
              'px-3 py-1 text-sm rounded-md transition-colors',
              selectedChartType === chartType.value
                ? 'bg-primary-500 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            ]"
          >
            {{ chartType.label }}
          </button>
        </div>
        
        <!-- Refresh & Settings -->
        <button
          @click="refreshChart"
          :disabled="loading"
          class="p-2 text-primary-600 hover:text-primary-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh Chart"
        >
          <div :class="loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'">⟳</div>
        </button>
        
        <button
          @click="toggleFullscreen"
          class="p-2 text-primary-600 hover:text-primary-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Fullscreen"
        >
          <div class="w-4 h-4">⛶</div>
        </button>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
      
      <!-- Enhanced Chart Canvas -->
      <div v-else class="chart-wrapper p-4">
        <canvas 
          ref="chartCanvas" 
          class="w-full h-96 border-0"
          @mousemove="handleMouseMove"
          @mouseleave="hideTooltip"
        ></canvas>
        
        <!-- Chart Tooltip -->
        <div
          v-if="tooltip.show"
          class="absolute bg-gray-900 text-white text-xs rounded px-3 py-2 pointer-events-none z-20 shadow-lg"
          :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
        >
          <div class="font-medium">{{ formatPrice(tooltip.price) }}</div>
          <div class="text-gray-300">{{ tooltip.time }}</div>
          <div v-if="tooltip.volume" class="text-gray-300">Vol: {{ formatVolume(tooltip.volume) }}</div>
        </div>
      </div>
    </div>

    <!-- Enhanced Chart Stats -->
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

    <!-- Live Price Feed -->
    <div v-if="hasData" class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-blue-900 dark:text-blue-100">Live Price Feed</span>
        </div>
        <div class="text-sm text-blue-700 dark:text-blue-300">
          Last updated: {{ lastUpdateTime }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { priceOracleService, formatPrice, formatMarketCap, formatVolume } from '@/services/priceOracle'
import { SupabaseService } from '@/services/supabase'
import { MarketDataService } from '@/services/marketDataService'

interface Props {
  tokenId: string
  tokenSymbol: string
  mintAddress?: string
  token?: any
}

interface CandlestickData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

const props = defineProps<Props>()

// Chart state
const chartCanvas = ref<HTMLCanvasElement>()
const loading = ref(false)
const error = ref('')

// Data state
const chartData = ref<CandlestickData[]>([])
const selectedTimeframe = ref('24h')
const selectedChartType = ref('candlestick')
const lastUpdateTime = ref('')

// Real-time subscription
let priceSubscription: (() => void) | null = null

// Tooltip state
const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  price: 0,
  time: '',
  volume: 0
})

// Configuration
const timeframes = [
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' }
]

const chartTypes = [
  { label: '📊 Candlestick', value: 'candlestick' }
]

// Computed properties
const hasData = computed(() => chartData.value.length > 0)

const marketData = ref({
  price: 0,
  priceChange24h: 0,
  volume24h: 0,
  marketCap: 0,
  holders: 0,
  transactions24h: 0
})

const currentPrice = computed(() => marketData.value.price)
const priceChange = computed(() => marketData.value.priceChange24h)
const volume24h = computed(() => marketData.value.volume24h)
const marketCap = computed(() => marketData.value.marketCap)

const high24h = computed(() => {
  if (!hasData.value) return 0
  return Math.max(...chartData.value.map(d => d.high))
})

const low24h = computed(() => {
  if (!hasData.value) return 0
  return Math.min(...chartData.value.map(d => d.low))
})

// Enhanced Canvas Chart Drawing
const drawChart = () => {
  if (!chartCanvas.value || !hasData.value) return
  
  const canvas = chartCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = 384 * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  
  const width = rect.width
  const height = 384
  const padding = 40
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height)
  
  // Set up chart dimensions
  const chartWidth = width - 2 * padding
  const chartHeight = height - 2 * padding
  
  const minPrice = low24h.value
  const maxPrice = high24h.value
  const priceRange = maxPrice - minPrice || 1
  
  // Draw grid
  ctx.strokeStyle = '#f3f4f6'
  ctx.lineWidth = 1
  
  // Horizontal grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i * chartHeight) / 5
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }
  
  // Vertical grid lines
  for (let i = 0; i <= 6; i++) {
    const x = padding + (i * chartWidth) / 6
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, height - padding)
    ctx.stroke()
  }
  
  // Draw chart based on type
  if (selectedChartType.value === 'candlestick') {
    drawCandlesticks(ctx, chartWidth, chartHeight, padding, minPrice, priceRange)
  } else if (selectedChartType.value === 'line') {
    drawLine(ctx, chartWidth, chartHeight, padding, minPrice, priceRange)
  } else if (selectedChartType.value === 'area') {
    drawArea(ctx, chartWidth, chartHeight, padding, minPrice, priceRange)
  }
  
  // Draw price labels
  drawPriceLabels(ctx, width, height, padding, minPrice, maxPrice)
  
  // Draw time labels
  drawTimeLabels(ctx, width, height, padding, chartWidth)
}

const drawCandlesticks = (ctx: CanvasRenderingContext2D, chartWidth: number, chartHeight: number, padding: number, minPrice: number, priceRange: number) => {
  const candleWidth = Math.max(2, chartWidth / chartData.value.length - 2)
  
  chartData.value.forEach((candle, index) => {
    const x = padding + (index * chartWidth) / (chartData.value.length - 1)
    const openY = padding + chartHeight - ((candle.open - minPrice) / priceRange) * chartHeight
    const closeY = padding + chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight
    const highY = padding + chartHeight - ((candle.high - minPrice) / priceRange) * chartHeight
    const lowY = padding + chartHeight - ((candle.low - minPrice) / priceRange) * chartHeight
    
    const isGreen = candle.close > candle.open
    ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444'
    ctx.fillStyle = isGreen ? '#10b981' : '#ef4444'
    ctx.lineWidth = 1
    
    // Draw wick
    ctx.beginPath()
    ctx.moveTo(x, highY)
    ctx.lineTo(x, lowY)
    ctx.stroke()
    
    // Draw body
    const bodyTop = Math.min(openY, closeY)
    const bodyHeight = Math.abs(closeY - openY)
    ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, bodyHeight)
  })
}

const drawLine = (ctx: CanvasRenderingContext2D, chartWidth: number, chartHeight: number, padding: number, minPrice: number, priceRange: number) => {
  if (chartData.value.length === 0) return
  
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  chartData.value.forEach((candle, index) => {
    const x = padding + (index * chartWidth) / (chartData.value.length - 1)
    const y = padding + chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()
}

const drawArea = (ctx: CanvasRenderingContext2D, chartWidth: number, chartHeight: number, padding: number, minPrice: number, priceRange: number) => {
  if (chartData.value.length === 0) return
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight)
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)')
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)')
  
  ctx.fillStyle = gradient
  ctx.beginPath()
  
  // Start from bottom-left
  const firstX = padding
  const bottomY = padding + chartHeight
  ctx.moveTo(firstX, bottomY)
  
  // Draw line to first point
  const firstY = padding + chartHeight - ((chartData.value[0].close - minPrice) / priceRange) * chartHeight
  ctx.lineTo(firstX, firstY)
  
  // Draw the price line
  chartData.value.forEach((candle, index) => {
    const x = padding + (index * chartWidth) / (chartData.value.length - 1)
    const y = padding + chartHeight - ((candle.close - minPrice) / priceRange) * chartHeight
    ctx.lineTo(x, y)
  })
  
  // Close the area
  const lastX = padding + chartWidth
  ctx.lineTo(lastX, bottomY)
  ctx.closePath()
  ctx.fill()
  
  // Draw the line on top
  drawLine(ctx, chartWidth, chartHeight, padding, minPrice, priceRange)
}

const drawPriceLabels = (ctx: CanvasRenderingContext2D, width: number, height: number, padding: number, minPrice: number, maxPrice: number) => {
  ctx.fillStyle = '#6b7280'
  ctx.font = '12px system-ui'
  ctx.textAlign = 'right'
  
  for (let i = 0; i <= 5; i++) {
    const price = minPrice + (maxPrice - minPrice) * (1 - i / 5)
    const y = padding + (i * (height - 2 * padding)) / 5
    ctx.fillText(formatPrice(price), width - padding - 5, y + 4)
  }
}

const drawTimeLabels = (ctx: CanvasRenderingContext2D, width: number, height: number, padding: number, chartWidth: number) => {
  ctx.fillStyle = '#6b7280'
  ctx.font = '12px system-ui'
  ctx.textAlign = 'center'
  
  const labelCount = 6
  for (let i = 0; i <= labelCount; i++) {
    const dataIndex = Math.floor((i * (chartData.value.length - 1)) / labelCount)
    if (dataIndex < chartData.value.length) {
      const time = new Date(chartData.value[dataIndex].time).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      const x = padding + (i * chartWidth) / labelCount
      ctx.fillText(time, x, height - padding + 15)
    }
  }
}

const handleMouseMove = (event: MouseEvent) => {
  if (!chartCanvas.value || !hasData.value) return
  
  const rect = chartCanvas.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  const padding = 40
  const chartWidth = rect.width - 2 * padding
  
  if (x >= padding && x <= rect.width - padding) {
    const dataIndex = Math.round(((x - padding) / chartWidth) * (chartData.value.length - 1))
    if (dataIndex >= 0 && dataIndex < chartData.value.length) {
      const candle = chartData.value[dataIndex]
      tooltip.value = {
        show: true,
        x: x + 10,
        y: y - 10,
        price: candle.close,
        time: new Date(candle.time).toLocaleString(),
        volume: candle.volume || 0
      }
    }
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

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
      chartData.value = generateMockCandlestickData()
    } else {
      // Convert price history to candlestick format
      chartData.value = convertToCandlestickData(priceHistory)
    }

    // Draw the chart after data is loaded
    await nextTick()
    drawChart()
    
    // Update last update time
    lastUpdateTime.value = new Date().toLocaleTimeString()

  } catch (err) {
    console.error('Failed to load chart data:', err)
    error.value = 'Failed to load chart data'
  } finally {
    loading.value = false
  }
}

const convertToCandlestickData = (priceHistory: any[]): CandlestickData[] => {
  return priceHistory.map((item, index) => {
    const price = item.price || 0.000001
    const volatility = 0.02 // 2% volatility for mock OHLC
    
    return {
      time: new Date(item.timestamp).getTime(),
      open: price * (1 + (Math.random() - 0.5) * volatility),
      high: price * (1 + Math.random() * volatility),
      low: price * (1 - Math.random() * volatility),
      close: price,
      volume: item.volume || Math.random() * 1000
    }
  })
}

const generateMockCandlestickData = (): CandlestickData[] => {
  const data: CandlestickData[] = []
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
    
    const open = currentPrice
    const close = currentPrice * (1 + change)
    const high = Math.max(open, close) * (1 + Math.random() * 0.02)
    const low = Math.min(open, close) * (1 - Math.random() * 0.02)
    
    data.push({
      time,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000 + 100
    })
    
    currentPrice = close
  }

  return data
}

const setTimeframe = async (timeframe: string) => {
  selectedTimeframe.value = timeframe
  await loadChartData()
}

const setChartType = async (type: string) => {
  selectedChartType.value = type
  await nextTick()
  drawChart()
}

const refreshChart = async () => {
  await loadChartData()
}

const toggleFullscreen = () => {
  // Implement fullscreen functionality
  console.log('Toggle fullscreen')
}

const setupRealTimeUpdates = () => {
  if (!props.mintAddress) return
  
  priceSubscription = priceOracleService.subscribe(props.mintAddress, (priceData: any) => {
    // Update chart with new price data
    const newCandle: CandlestickData = {
      time: Date.now(),
      open: currentPrice.value,
      high: Math.max(currentPrice.value, priceData.price),
      low: Math.min(currentPrice.value, priceData.price),
      close: priceData.price,
      volume: Math.random() * 100 // Mock volume
    }
    
    // Update the last candle or add new one
    const lastCandle = chartData.value[chartData.value.length - 1]
    if (lastCandle && newCandle.time - lastCandle.time < 300000) { // Within 5 minutes
      // Update existing candle
      lastCandle.close = newCandle.close
      lastCandle.high = Math.max(lastCandle.high, newCandle.close)
      lastCandle.low = Math.min(lastCandle.low, newCandle.close)
    } else {
      // Add new candle
      chartData.value.push(newCandle)
    }
    
    // Redraw chart
    drawChart()
    lastUpdateTime.value = new Date().toLocaleTimeString()
  })
}

// Handle window resize
const handleResize = () => {
  if (chartCanvas.value) {
    drawChart()
  }
}

const loadMarketData = async () => {
  if (!props.token?.id) return
  marketData.value = await MarketDataService.getTokenMarketData(props.token.id)
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  await loadChartData()
  setupRealTimeUpdates()
  await loadMarketData()
  
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (priceSubscription) {
    priceSubscription()
  }
  
  window.removeEventListener('resize', handleResize)
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
.advanced-chart-container {
  @apply w-full;
}

.chart-wrapper {
  @apply relative;
}

canvas {
  cursor: crosshair;
}
</style> 