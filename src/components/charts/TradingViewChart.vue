<template>
  <div class="tradingview-chart-container bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    <!-- Chart Header with Tools -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <!-- Chart Type Selector -->
      <div class="flex items-center gap-2">
        <button 
          v-for="type in chartTypes" 
          :key="type.value"
          @click="setChartType(type.value)"
          :class="[
            'px-3 py-1 text-xs font-medium rounded transition-colors',
            chartType === type.value 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          ]"
        >
          {{ type.label }}
        </button>
      </div>

      <!-- Timeframe Selector -->
      <div class="flex items-center gap-2">
        <button 
          v-for="timeframe in timeframes" 
          :key="timeframe.value"
          @click="setTimeframe(timeframe.value)"
          :class="[
            'px-3 py-1 text-xs font-medium rounded transition-colors',
            selectedTimeframe === timeframe.value 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          ]"
        >
          {{ timeframe.label }}
        </button>
      </div>

      <!-- Chart Tools -->
      <div class="flex items-center gap-2">
        <button 
          @click="toggleIndicator('ma')"
          :class="[
            'px-2 py-1 text-xs font-medium rounded transition-colors',
            indicators.ma ? 'bg-purple-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          ]"
          title="Moving Average"
        >
          MA
        </button>
        <button 
          @click="toggleIndicator('volume')"
          :class="[
            'px-2 py-1 text-xs font-medium rounded transition-colors',
            indicators.volume ? 'bg-orange-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          ]"
          title="Volume"
        >
          VOL
        </button>
        <button 
          @click="resetZoom"
          class="px-2 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          title="Reset Zoom"
        >
          🔍
        </button>
        <button 
          @click="toggleFullscreen"
          class="px-2 py-1 text-xs font-medium rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>

    <!-- Price Info Bar -->
    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ tokenSymbol }}/SOL</span>
          <span :class="['text-lg font-bold', priceChangeColor]">
            ${{ currentPrice.toFixed(8) }}
          </span>
        </div>
        
        <div v-if="priceData.length > 0" class="flex items-center gap-4 text-sm">
          <span class="text-gray-600 dark:text-gray-400">
            O: <span class="text-gray-900 dark:text-white">${{ formatPrice(priceData[priceData.length - 1]?.open || 0) }}</span>
          </span>
          <span class="text-gray-600 dark:text-gray-400">
            H: <span class="text-green-600">${{ formatPrice(getHighPrice()) }}</span>
          </span>
          <span class="text-gray-600 dark:text-gray-400">
            L: <span class="text-red-600">${{ formatPrice(getLowPrice()) }}</span>
          </span>
          <span class="text-gray-600 dark:text-gray-400">
            C: <span class="text-gray-900 dark:text-white">${{ formatPrice(priceData[priceData.length - 1]?.close || 0) }}</span>
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        Real-time
      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative">
      <div 
        ref="chartContainer" 
        :class="[
          'chart-area',
          isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-800' : 'h-96'
        ]"
        style="width: 100%; height: 400px;"
      ></div>
      
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-90">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-gray-600 dark:text-gray-400">Loading chart data...</span>
        </div>
      </div>
      
      <!-- Error state -->
      <div v-if="chartError" class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 bg-opacity-90">
        <div class="text-center">
          <div class="text-red-500 text-sm mb-2">Chart Error</div>
          <div class="text-xs text-gray-600 dark:text-gray-400">{{ chartError }}</div>
          <button @click="retryChart" class="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
            Retry
          </button>
        </div>
      </div>
      
      <!-- Debug info (temporary) -->
      <div v-if="showDebug" class="absolute top-2 left-2 text-xs bg-black text-white p-2 rounded z-10">
        Container: {{ chartContainer ? 'Ready' : 'Not ready' }}<br>
        Chart: {{ chart ? 'Initialized' : 'Not initialized' }}<br>
        Data: {{ priceData.length }} candles<br>
        Loading: {{ loading }}<br>
        Error: {{ chartError || 'None' }}
      </div>
      
      <!-- Fallback Simple Chart -->
      <canvas 
        v-if="!chart && !loading && !chartError"
        ref="fallbackCanvas"
        class="absolute inset-0 w-full h-full"
        width="800"
        height="400"
      ></canvas>
    </div>

    <!-- Chart Footer with Stats -->
    <div class="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-4">
          <span class="text-gray-600 dark:text-gray-400">Volume: <span class="text-gray-900 dark:text-white">{{ formatVolume(totalVolume) }}</span></span>
          <span class="text-gray-600 dark:text-gray-400">Market Cap: <span class="text-gray-900 dark:text-white">${{ formatMarketCap(marketCap) }}</span></span>
        </div>
        <div class="text-gray-500 dark:text-gray-400">
          Powered by FloppFun • Data updates every 5s
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { createChart, ColorType } from 'lightweight-charts'

interface Props {
  tokenId: string
  tokenSymbol: string
  mintAddress: string
}

const props = defineProps<Props>()

// Chart refs and state
const chartContainer = ref<HTMLElement>()
const fallbackCanvas = ref<HTMLCanvasElement>()
const chart = ref<any>()
const candlestickSeries = ref<any>()
const volumeSeries = ref<any>()
const maSeries = ref<any>()

// Chart configuration
const chartType = ref<'candlestick' | 'line' | 'area'>('candlestick')
const selectedTimeframe = ref('1H')
const isFullscreen = ref(false)
const loading = ref(true)
const chartError = ref('')
const showDebug = ref(true) // Enable for debugging

// Chart data
const priceData = ref<any[]>([])
const volumeData = ref<any[]>([])
const currentPrice = ref(0)
const totalVolume = ref(0)
const marketCap = ref(0)

// Chart options
const chartTypes = [
  { label: 'Candles', value: 'candlestick' },
  { label: 'Line', value: 'line' },
  { label: 'Area', value: 'area' }
]

const timeframes = [
  { label: '1m', value: '1M' },
  { label: '5m', value: '5M' },
  { label: '15m', value: '15M' },
  { label: '1h', value: '1H' },
  { label: '4h', value: '4H' },
  { label: '1d', value: '1D' }
]

const indicators = ref({
  ma: false,
  volume: true
})

// Computed
const priceChangeColor = ref('text-green-500')

// Methods
const initChart = async () => {
  try {
    chartError.value = ''
    loading.value = true
    
    console.log('Initializing chart...')
    
    if (!chartContainer.value) {
      throw new Error('Chart container not found')
    }
    
    console.log('Container dimensions:', {
      width: chartContainer.value.clientWidth,
      height: chartContainer.value.clientHeight,
      offsetWidth: chartContainer.value.offsetWidth,
      offsetHeight: chartContainer.value.offsetHeight
    })
    
    // Ensure container has dimensions
    if (chartContainer.value.clientWidth === 0 || chartContainer.value.clientHeight === 0) {
      throw new Error('Chart container has no dimensions')
    }

    chart.value = createChart(chartContainer.value, {
      width: chartContainer.value.clientWidth,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' }
      },
      crosshair: {
        mode: 0,
        vertLine: {
          width: 1,
          color: '#6b7280',
          style: 0
        },
        horzLine: {
          width: 1,
          color: '#6b7280',
          style: 0
        }
      },
      rightPriceScale: {
        borderColor: '#374151'
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false
      }
    })

    console.log('Chart created:', chart.value)

    // Try different approaches for v5 API
    try {
      // Method 1: Direct method call
      if (typeof chart.value.addCandlestickSeries === 'function') {
        candlestickSeries.value = chart.value.addCandlestickSeries({
          upColor: '#10b981',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981'
        })
      } else {
        // Method 2: addSeries with type
        candlestickSeries.value = chart.value.addSeries('Candlestick', {
          upColor: '#10b981',
          downColor: '#ef4444',
          borderDownColor: '#ef4444',
          borderUpColor: '#10b981',
          wickDownColor: '#ef4444',
          wickUpColor: '#10b981'
        })
      }
      
      console.log('Candlestick series created:', candlestickSeries.value)
    } catch (seriesError) {
      console.error('Failed to create candlestick series:', seriesError)
      console.log('Available methods on chart:', Object.getOwnPropertyNames(chart.value))
      throw seriesError
    }

    // Create volume series using v5 API
    if (indicators.value.volume) {
      try {
        if (typeof chart.value.addHistogramSeries === 'function') {
          volumeSeries.value = chart.value.addHistogramSeries({
            color: '#6b7280',
            priceFormat: {
              type: 'volume'
            },
            priceScaleId: ''
          })
        } else {
          volumeSeries.value = chart.value.addSeries('Histogram', {
            color: '#6b7280',
            priceFormat: {
              type: 'volume'
            },
            priceScaleId: ''
          })
        }
        
        chart.value.priceScale('').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0
          }
        })
        
        console.log('Volume series created:', volumeSeries.value)
      } catch (volumeError) {
        console.warn('Failed to create volume series:', volumeError)
        // Continue without volume series
      }
    }

    // Load initial data
    await loadChartData()
    
    // Set up real-time updates
    startRealTimeUpdates()
    
    console.log('Chart initialization complete')

  } catch (error: any) {
    console.error('Failed to initialize chart:', error)
    chartError.value = error.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

const loadChartData = async () => {
  try {
    // Generate realistic candlestick data for demonstration
    const data = generateCandlestickData()
    priceData.value = data.candlesticks
    volumeData.value = data.volumes
    
    if (candlestickSeries.value) {
      candlestickSeries.value.setData(priceData.value)
    }
    
    if (volumeSeries.value) {
      volumeSeries.value.setData(volumeData.value)
    }
    
    // Update current price
    if (priceData.value.length > 0) {
      const latest = priceData.value[priceData.value.length - 1]
      currentPrice.value = latest.close
    }
    
  } catch (error) {
    console.error('Failed to load chart data:', error)
  }
}

const generateCandlestickData = () => {
  const candlesticks: any[] = []
  const volumes: any[] = []
  const now = Date.now()
  const basePrice = 0.000001 + Math.random() * 0.00001
  
  for (let i = 100; i >= 0; i--) {
    const time = (now - i * 3600000) / 1000 // 1 hour intervals
    const volatility = 0.02
    
    const open = i === 100 ? basePrice : candlesticks[candlesticks.length - 1].close
    const change = (Math.random() - 0.5) * volatility * open
    const close = Math.max(open + change, 0.000001)
    const high = Math.max(open, close) * (1 + Math.random() * 0.02)
    const low = Math.min(open, close) * (1 - Math.random() * 0.02)
    
    candlesticks.push({
      time: time as any,
      open,
      high,
      low,
      close
    })
    
    volumes.push({
      time: time as any,
      value: Math.random() * 1000000,
      color: close > open ? '#10b981' : '#ef4444'
    })
  }
  
  return { candlesticks, volumes }
}

const getHighPrice = (): number => {
  if (priceData.value.length === 0) return 0
  return Math.max(...priceData.value.map(p => p.high))
}

const getLowPrice = (): number => {
  if (priceData.value.length === 0) return 0
  return Math.min(...priceData.value.map(p => p.low))
}

const setChartType = (type: string) => {
  chartType.value = type as any
  // TODO: Recreate series based on type
}

const setTimeframe = (timeframe: string) => {
  selectedTimeframe.value = timeframe
  loadChartData()
}

const toggleIndicator = (indicator: string) => {
  indicators.value[indicator as keyof typeof indicators.value] = !indicators.value[indicator as keyof typeof indicators.value]
  
  if (indicator === 'ma' && indicators.value.ma) {
    addMovingAverage()
  } else if (indicator === 'ma' && !indicators.value.ma) {
    removeMovingAverage()
  }
}

const addMovingAverage = () => {
  if (!chart.value) return
  
  try {
    if (typeof chart.value.addLineSeries === 'function') {
      maSeries.value = chart.value.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 2
      })
    } else {
      maSeries.value = chart.value.addSeries('Line', {
        color: '#8b5cf6',
        lineWidth: 2
      })
    }
    
    // Calculate simple moving average
    const maData = calculateMovingAverage(priceData.value, 20)
    if (maSeries.value) {
      maSeries.value.setData(maData)
    }
  } catch (error) {
    console.error('Failed to add moving average:', error)
  }
}

const removeMovingAverage = () => {
  if (chart.value && maSeries.value) {
    chart.value.removeSeries(maSeries.value)
    maSeries.value = undefined
  }
}

const calculateMovingAverage = (data: any[], period: number): any[] => {
  const result: any[] = []
  
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0)
    result.push({
      time: data[i].time,
      value: sum / period
    })
  }
  
  return result
}

const resetZoom = () => {
  chart.value?.timeScale().fitContent()
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => {
    chart.value?.resize(
      chartContainer.value?.clientWidth || 800,
      chartContainer.value?.clientHeight || 400
    )
  })
}

const startRealTimeUpdates = () => {
  // Simulate real-time price updates
  setInterval(() => {
    if (priceData.value.length === 0) return
    
    const lastCandle = priceData.value[priceData.value.length - 1]
    const change = (Math.random() - 0.5) * 0.01 * lastCandle.close
    const newPrice = Math.max(lastCandle.close + change, 0.000001)
    
    const newCandle = {
      time: (Date.now() / 1000) as any,
      open: lastCandle.close,
      high: Math.max(lastCandle.close, newPrice),
      low: Math.min(lastCandle.close, newPrice),
      close: newPrice
    }
    
    priceData.value = [...priceData.value.slice(0, -1), newCandle]
    currentPrice.value = newPrice
    
    if (candlestickSeries.value) {
      candlestickSeries.value.update(newCandle)
    }
  }, 5000) // Update every 5 seconds
}

// Utility functions
const formatPrice = (price: number): string => {
  if (price >= 1) return price.toFixed(4)
  if (price >= 0.001) return price.toFixed(6)
  return price.toExponential(2)
}

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) return (volume / 1000000).toFixed(1) + 'M'
  if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K'
  return volume.toFixed(0)
}

const formatMarketCap = (cap: number): string => {
  if (cap >= 1000000) return (cap / 1000000).toFixed(2) + 'M'
  if (cap >= 1000) return (cap / 1000).toFixed(1) + 'K'
  return cap.toFixed(0)
}

// Lifecycle
onMounted(() => {
  // Wait a bit for DOM to be fully rendered
  setTimeout(() => {
    initChart()
  }, 100)
  
  // Also prepare fallback chart after a delay
  setTimeout(() => {
    if (!chart.value && priceData.value.length === 0) {
      // Generate data for fallback
      const data = generateCandlestickData()
      priceData.value = data.candlesticks
      drawFallbackChart()
    }
  }, 3000)
})

const retryChart = () => {
  chartError.value = ''
  if (chart.value) {
    chart.value.remove()
    chart.value = null
  }
  initChart()
}

const drawFallbackChart = () => {
  const canvas = fallbackCanvas.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const width = canvas.width
  const height = canvas.height
  
  // Clear canvas
  ctx.fillStyle = '#1f2937'
  ctx.fillRect(0, 0, width, height)
  
  // Draw simple grid
  ctx.strokeStyle = '#374151'
  ctx.lineWidth = 1
  
  // Vertical lines
  for (let i = 0; i <= 10; i++) {
    const x = (width / 10) * i
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  
  // Horizontal lines
  for (let i = 0; i <= 8; i++) {
    const y = (height / 8) * i
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  
  // Draw simple price line
  if (priceData.value.length > 0) {
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2
    ctx.beginPath()
    
    priceData.value.forEach((data, index) => {
      const x = (width / priceData.value.length) * index
      const y = height - (data.close / Math.max(...priceData.value.map(p => p.high))) * height
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    
    ctx.stroke()
  }
  
  // Draw text
  ctx.fillStyle = '#ffffff'
  ctx.font = '14px Arial'
  ctx.fillText(`${props.tokenSymbol}/SOL - Fallback Chart`, 10, 30)
  ctx.fillStyle = '#9ca3af'
  ctx.font = '12px Arial'
  ctx.fillText('TradingView chart failed to load', 10, 50)
}

onUnmounted(() => {
  if (chart.value) {
    chart.value.remove()
  }
})
</script>

<style scoped>
.chart-area {
  min-height: 400px;
}

.tradingview-chart-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Custom scrollbar for fullscreen mode */
.chart-area::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.chart-area::-webkit-scrollbar-track {
  background: #374151;
}

.chart-area::-webkit-scrollbar-thumb {
  background: #6b7280;
  border-radius: 4px;
}

.chart-area::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Animation for smooth transitions */
.chart-area {
  transition: all 0.3s ease-in-out;
}
</style> 