<template>
  <div class="lightweight-chart-container bg-[#0b0e11] border border-[#2b3139] rounded-xl overflow-hidden">
    <!-- Chart Header -->
    <div class="flex items-center justify-between p-4 border-b border-[#2b3139] bg-[#1e2329]">
      <!-- Token Info -->
      <div class="flex items-center gap-3">
        <h3 class="text-white font-medium">{{ tokenSymbol }}/SOL</h3>
        <div v-if="isLive" class="flex items-center gap-1">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-xs text-green-500">LIVE</span>
        </div>
      </div>
      
      <!-- OHLC Data -->
      <div v-if="priceData.length > 0" class="flex items-center gap-3" style="font-size: 10px;">
        <span class="text-[#848e9c]" title="Open">
          O: <span class="text-[#d1d4dc]">${{ convertToUSD(priceData[priceData.length - 1]?.open || 0).toFixed(8) }}</span>
        </span>
        <span class="text-[#848e9c]" title="High">
          H: <span class="text-[#2ebd85]">${{ convertToUSD(getHighPrice()).toFixed(8) }}</span>
        </span>
        <span class="text-[#848e9c]" title="Low">
          L: <span class="text-[#f6465d]">${{ convertToUSD(getLowPrice()).toFixed(8) }}</span>
        </span>
        <span class="text-[#848e9c]" title="Close">
          C: <span class="text-[#d1d4dc]">${{ convertToUSD(priceData[priceData.length - 1]?.close || 0).toFixed(8) }}</span>
        </span>
      </div>
    </div>

    <!-- Price Info Bar -->
    <div class="flex items-center justify-between p-3 bg-[#1e2329] border-b border-[#2b3139]">
      <div class="flex items-center gap-2">
        <span class="text-sm text-[#848e9c]">{{ tokenSymbol }}/SOL</span>
        <span :class="['text-lg font-bold', priceChangeColor]">
          ${{ convertToUSD(currentPrice).toFixed(8) }}
        </span>
        <span v-if="priceChange24h !== 0" :class="['text-sm', priceChangeColor]">
          ({{ priceChange24h >= 0 ? '+' : '' }}{{ priceChange24h.toFixed(2) }}%)
        </span>
      </div>

      <div class="flex items-center gap-4">
        <!-- Technical Indicators Toggle -->
        <div class="flex items-center gap-2">
          <button
            @click="toggleIndicators"
            :class="[
              'px-2 py-1 text-xs rounded transition-colors',
              showIndicators 
                ? 'bg-[#f0b90b] text-[#0b0e11]' 
                : 'bg-[#2b3139] text-[#d1d4dc] hover:bg-[#3c4043]'
            ]"
            title="Toggle Technical Indicators"
          >
            📊
          </button>
        </div>
        
        <!-- Timeframe Selection -->
        <div class="flex items-center">
          <select 
            v-model="selectedTimeframe"
            @change="setTimeframe(selectedTimeframe)"
            class="px-3 py-1 text-xs bg-[#2b3139] text-[#d1d4dc] border border-[#3c4043] rounded focus:outline-none focus:border-[#f0b90b] transition-colors min-w-[80px]"
          >
            <option 
              v-for="timeframe in timeframes" 
              :key="timeframe.value"
              :value="timeframe.value"
              class="bg-[#2b3139] text-[#d1d4dc]"
            >
              {{ timeframe.label }}
            </option>
          </select>
        </div>
        
        <!-- Fullscreen Toggle -->
        <button
          @click="toggleFullscreen"
          class="p-1 text-[#848e9c] hover:text-[#d1d4dc] transition-colors"
          title="Toggle Fullscreen"
        >
          <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative">
      <!-- Enhanced Lightweight Charts -->
      <div 
        :class="[
          isFullscreen ? 'fixed inset-0 z-50 bg-[#0b0e11] p-4' : 'h-[400px] md:h-[500px]'
        ]"
      >
        <!-- Chart Area -->
        <div 
          ref="chartContainer" 
          class="chart-area relative w-full h-full"
        >
        </div>
      </div>
      
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-90 z-20">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-[#f0b90b] border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-[#848e9c]">{{ loadingMessage }}</span>
          <div class="text-xs text-[#848e9c] opacity-75">Loading {{ selectedTimeframe }} data...</div>
        </div>
      </div>
      
      <!-- Error State -->
      <div v-if="error && !loading" class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-90 z-20">
        <div class="text-center max-w-sm">
          <div class="text-[#f6465d] text-lg mb-2">⚠️ Chart Error</div>
          <div class="text-xs text-[#848e9c] mb-4">{{ error }}</div>
          <div class="flex gap-2 justify-center">
            <button 
              @click="retryChart" 
              class="px-4 py-2 text-sm bg-[#2ebd85] text-white rounded hover:bg-[#26a069] transition-colors"
            >
              Retry Chart
            </button>
            <button 
              @click="useFallbackData" 
              class="px-4 py-2 text-sm bg-[#f0b90b] text-[#0b0e11] rounded hover:bg-[#d4a017] transition-colors"
            >
              Use Demo Data
            </button>
          </div>
        </div>
      </div>
      
      <!-- No Data State -->
      <div v-if="!loading && !error && priceData.length === 0" class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-90 z-20">
        <div class="text-center">
          <div class="text-4xl mb-2">📈</div>
          <div class="text-[#848e9c] text-sm mb-2">No price data available</div>
          <div class="text-[#848e9c] text-xs opacity-75">Start trading to see price movements</div>
        </div>
      </div>
    </div>

    <!-- Chart Footer -->
    <div class="p-3 bg-[#1e2329] border-t border-[#2b3139]">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-4">
          <span class="text-[#848e9c]">Volume: <span class="text-[#d1d4dc]">{{ formatVolume(totalVolume) }}</span></span>
          <span class="text-[#848e9c]">Market Cap: <span class="text-[#d1d4dc]">${{ formatMarketCap(marketCap) }}</span></span>
          <span v-if="lastUpdate" class="text-[#848e9c]">Updated: {{ lastUpdate }}</span>
        </div>
        
        <!-- Chart Controls -->
        <div class="flex items-center gap-2">
          <button
            @click="refreshChart"
            :disabled="loading"
            class="p-1 text-[#848e9c] hover:text-[#d1d4dc] transition-colors disabled:opacity-50"
            title="Refresh Chart"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

interface Props {
  tokenId: string
  tokenSymbol: string
  mintAddress: string
}

const props = defineProps<Props>()

// Chart state
const chartContainer = ref<HTMLElement>()
const loading = ref(true)
const loadingMessage = ref('Initializing chart...')
const error = ref('')
const isFullscreen = ref(false)

// Chart instances
let lightweightChart: any = null
let mainSeries: any = null
let volumeSeries: any = null

// Chart data
const priceData = ref<any[]>([])
const volumeData = ref<any[]>([])
const currentPrice = ref(0)
const totalVolume = ref(0)
const marketCap = ref(0)
const solPriceUSD = ref(0) // Store current SOL price for conversion

// Enhanced chart state
const isLive = ref(false)
const showIndicators = ref(false)
const lastUpdate = ref('')
const priceChange24h = ref(0)

// Chart configuration
const selectedTimeframe = ref('24h')

const timeframes = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
  { label: '30M', value: '30m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' }
]



// Computed
const priceChangeColor = computed(() => {
  if (priceData.value.length === 0) return 'text-[#d1d4dc]'
  const latest = priceData.value[priceData.value.length - 1]
  const previous = priceData.value[priceData.value.length - 2]
  if (!previous) return 'text-[#d1d4dc]'
  return latest.close > previous.close ? 'text-[#2ebd85]' : 'text-[#f6465d]'
})

// Real-time price subscription
let priceSubscription: (() => void) | null = null

// Get current SOL price for USD conversion
const getSolPriceUSD = async () => {
  try {
    const { priceOracleService } = await import('../../services/priceOracle')
    const solPriceData = await priceOracleService.getSOLPrice()
    solPriceUSD.value = solPriceData.price
    console.log('💰 [CHART] Using SOL price for conversion:', `$${solPriceUSD.value.toFixed(2)}`)
  } catch (error) {
    console.error('Failed to get SOL price:', error)
    solPriceUSD.value = 140 // Fallback SOL price
  }
}

// Convert SOL price to USD
const convertToUSD = (solPrice: number): number => {
  return solPrice * solPriceUSD.value
}

// Initialize chart
const initChart = async () => {
  try {
    loading.value = true
    error.value = ''
    
    // Get SOL price first
    await getSolPriceUSD()
    
    await initLightweightChart()
    
    // Set up real-time price updates
    setupRealTimePriceUpdates()
    
  } catch (err: any) {
    console.error('Chart initialization failed:', err)
    
    error.value = `Chart initialization failed: ${err.message}`
    loading.value = false
  }
}

// Setup real-time price updates
const setupRealTimePriceUpdates = async () => {
  if (!props.tokenId) return
  
  try {
    // Ensure we have SOL price for conversion
    if (solPriceUSD.value === 0) {
      await getSolPriceUSD()
    }
    
    const { RealTimePriceService } = await import('../../services/realTimePriceService')
    
    priceSubscription = RealTimePriceService.subscribe(props.tokenId, async (realPriceData) => {
      // Update current price display (price comes in SOL, will be converted to USD in template)
      currentPrice.value = realPriceData.price
      marketCap.value = realPriceData.marketCap
      priceChange24h.value = realPriceData.priceChange24h || 0
      isLive.value = true
      lastUpdate.value = new Date().toLocaleTimeString()
      
      // Get updated chart data for current timeframe
      const chartData = RealTimePriceService.getChartData(props.tokenId, selectedTimeframe.value)
      
      if (chartData.length > 0) {
        // Convert to lightweight charts format with validation
        priceData.value = chartData.map((candle, index) => {
          const candleData = {
            time: Math.floor(candle.time / 1000), // Convert to seconds
            open: Number(candle.open) || realPriceData.price,
            high: Number(candle.high) || realPriceData.price,
            low: Number(candle.low) || realPriceData.price,
            close: Number(candle.close) || realPriceData.price
          }
          
          // Validate OHLC data
          if (candleData.high < candleData.low) {
            candleData.high = candleData.low
          }
          if (candleData.open < candleData.low || candleData.open > candleData.high) {
            candleData.open = candleData.close
          }
          if (candleData.close < candleData.low || candleData.close > candleData.high) {
            candleData.close = (candleData.high + candleData.low) / 2
          }
          
          return candleData
        })
        
        volumeData.value = chartData.map(candle => ({
          time: Math.floor(candle.time / 1000),
          value: Number(candle.volume) || 0,
          color: (candle.close > candle.open) ? '#2ebd85' : '#f6465d'
        }))
        
        // Update chart if using lightweight charts
        if (lightweightChart && mainSeries) {
          mainSeries.setData(priceData.value)
        }
      }
    })
  } catch (error) {
    console.error('Failed to setup real-time price updates:', error)
  }
}

// Lightweight Charts initialization
const initLightweightChart = async () => {
  loadingMessage.value = 'Initializing enhanced chart...'
  
  if (!chartContainer.value) {
    throw new Error('Chart container not found')
  }

  // Load real chart data first
  await loadRealChartData()

  // Create chart with proper configuration
  lightweightChart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: chartContainer.value.clientHeight || 500,
    layout: {
      background: { type: ColorType.Solid, color: '#0b0e11' },
      textColor: '#d1d4dc',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: '#1e2329', style: 1 },
      horzLines: { color: '#1e2329', style: 1 }
    },
    crosshair: {
      mode: 1,
      vertLine: { 
        color: '#848e9c',
        width: 1,
        style: 2,
        labelBackgroundColor: '#2b3139'
      },
      horzLine: { 
        color: '#848e9c',
        width: 1,
        style: 2,
        labelBackgroundColor: '#2b3139'
      }
    },
    rightPriceScale: {
      borderColor: '#2b3139',
      textColor: '#848e9c',
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      },
      autoScale: true,
    },
    timeScale: {
      borderColor: '#2b3139',
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 12,
      barSpacing: 3,
      minBarSpacing: 1,
      fixLeftEdge: true,
      lockVisibleTimeRangeOnResize: true,
      rightBarStaysOnScroll: true,
      visible: true,
      tickMarkFormatter: (time: number) => {
        const date = new Date(time * 1000)
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    }
  })

  // Add series with the loaded data
  try {
    addSeries()
  } catch (error) {
    console.error('Failed to add chart series:', error)
    throw error
  }
  
  loading.value = false
}

const addSeries = () => {
  if (!lightweightChart) return

  // Remove existing series
  if (mainSeries) {
    try {
      lightweightChart.removeSeries(mainSeries)
    } catch (error) {
      console.warn('Error removing main series:', error)
    }
    mainSeries = null
  }
  
  if (volumeSeries) {
    try {
      lightweightChart.removeSeries(volumeSeries)
          } catch (error) {
        console.warn('Error removing volume series:', error)
      }
      volumeSeries = null
  }

  try {
    // Add candlestick series using correct API
    mainSeries = lightweightChart.addSeries(CandlestickSeries, {
      upColor: '#2ebd85',
      downColor: '#f6465d',
      borderUpColor: '#2ebd85',
      borderDownColor: '#f6465d',
      wickUpColor: '#2ebd85',
      wickDownColor: '#f6465d',
      priceFormat: {
        type: 'price',
        precision: 8,
        formatter: (price: number) => `$${convertToUSD(price).toFixed(8)}`,
      },
    })
    
    if (priceData.value.length > 0) {
      mainSeries.setData(priceData.value)
    }
    
    // Add volume histogram series using correct API
    volumeSeries = lightweightChart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // Set as an overlay
      scaleMargins: {
        top: 0.8,
        bottom: 0.0,
      },
    })
    
    if (volumeData.value.length > 0) {
      volumeSeries.setData(volumeData.value)
    }
  } catch (error) {
    console.error('Error creating chart series:', error)
    throw error
  }
}

const loadRealChartData = async () => {
  if (!props.tokenId) {
    console.warn('No token ID provided for chart data')
    return
  }

  try {
    // Get SOL price if not already loaded
    if (solPriceUSD.value === 0) {
      await getSolPriceUSD()
    }
    
    // Get bonding curve state first to ensure we have a valid price
    const { BondingCurveService } = await import('../../services/bondingCurve')
    const bondingCurveState = await BondingCurveService.getTokenBondingCurveState(props.tokenId)
    
    // If price is 0, there's an issue with the bonding curve
    if (bondingCurveState.currentPrice === 0) {
      console.warn('Bonding curve returned price of 0, using fallback price')
      bondingCurveState.currentPrice = 0.000001 // Fallback price
    }
    
    // Get historical chart data from real-time price service
    const { RealTimePriceService } = await import('../../services/realTimePriceService')
    const chartData = await RealTimePriceService.getHistoricalChartData(props.tokenId, selectedTimeframe.value)
    
    // Ensure we have valid data, create a single point if empty
    if (chartData.length === 0) {
      const now = Date.now()
      const currentPrice = bondingCurveState.currentPrice
      
      chartData.push({
        time: now,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        volume: 0
      })
    }
    
    // Convert chart data to lightweight charts format with validation
    priceData.value = chartData.map((candle, index) => {
      const candleData = {
        time: Math.floor(candle.time / 1000), // Convert to seconds
        open: Number(candle.open) || bondingCurveState.currentPrice,
        high: Number(candle.high) || bondingCurveState.currentPrice,
        low: Number(candle.low) || bondingCurveState.currentPrice,
        close: Number(candle.close) || bondingCurveState.currentPrice
      }
      
      // Validate OHLC data
      if (candleData.high < candleData.low) {
        candleData.high = candleData.low
      }
      if (candleData.open < candleData.low || candleData.open > candleData.high) {
        candleData.open = candleData.close
      }
      if (candleData.close < candleData.low || candleData.close > candleData.high) {
        candleData.close = (candleData.high + candleData.low) / 2
      }
      
      return candleData
    })
    
    volumeData.value = chartData.map(candle => ({
      time: Math.floor(candle.time / 1000),
      value: Number(candle.volume) || 0,
      color: (candle.close > candle.open) ? '#2ebd85' : '#f6465d'
    }))
    
    // Update current stats
    const latestCandle = chartData[chartData.length - 1]
    currentPrice.value = latestCandle.close || bondingCurveState.currentPrice
    totalVolume.value = chartData.reduce((sum, candle) => sum + (candle.volume || 0), 0)
    marketCap.value = bondingCurveState.marketCap
    
    // Calculate 24h price change
    if (chartData.length > 1) {
      const firstCandle = chartData[0]
      const lastCandle = chartData[chartData.length - 1]
      priceChange24h.value = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
    }
    
    lastUpdate.value = new Date().toLocaleTimeString()
    
  } catch (err: any) {
    console.error('Failed to load chart data:', err)
    error.value = `Failed to load chart data: ${err.message}`
    
    // Create emergency fallback data
    const now = Date.now()
    const fallbackPrice = 0.000001
    
    priceData.value = [
      {
        time: Math.floor((now - 5 * 60 * 1000) / 1000),
        open: fallbackPrice,
        high: fallbackPrice * 1.001,
        low: fallbackPrice * 0.999,
        close: fallbackPrice
      },
      {
        time: Math.floor(now / 1000),
        open: fallbackPrice,
        high: fallbackPrice * 1.001,
        low: fallbackPrice * 0.999,
        close: fallbackPrice
      }
    ]
    
    volumeData.value = [
      {
        time: Math.floor((now - 5 * 60 * 1000) / 1000),
        value: 0,
        color: '#2ebd85'
      },
      {
        time: Math.floor(now / 1000),
        value: 0,
        color: '#2ebd85'
      }
    ]
    
    currentPrice.value = fallbackPrice
    totalVolume.value = 0
    marketCap.value = 0
  }
}

// Chart controls

// Calculate simple moving average
const calculateSMA = (data: any[], period: number): number[] => {
  if (data.length < period) return []
  
  const sma = []
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0)
    sma.push(sum / period)
  }
  return sma
}

// Toggle technical indicators
const toggleIndicators = () => {
  showIndicators.value = !showIndicators.value
  
  if (showIndicators.value && priceData.value.length > 0) {
    // Calculate and add moving averages
    const sma20 = calculateSMA(priceData.value, 20)
    const sma50 = calculateSMA(priceData.value, 50)
    
    console.log('SMA 20:', sma20)
    console.log('SMA 50:', sma50)
    
    // TODO: Add moving average lines to chart
    // This would require adding LineSeries for the indicators
  }
}

// Retry chart initialization
const retryChart = async () => {
  error.value = ''
  await initChart()
}

// Use fallback demo data
const useFallbackData = async () => {
  error.value = ''
  loading.value = true
  
  // Create demo data
  const now = Date.now()
  const basePrice = 0.000001
  const demoData = []
  
  for (let i = 0; i < 50; i++) {
    const time = now - (50 - i) * 5 * 60 * 1000 // 5-minute intervals
    const price = basePrice * (1 + Math.sin(i * 0.1) * 0.1 + Math.random() * 0.05)
    const open = price * (1 + (Math.random() - 0.5) * 0.02)
    const close = price * (1 + (Math.random() - 0.5) * 0.02)
    const high = Math.max(open, close) * (1 + Math.random() * 0.01)
    const low = Math.min(open, close) * (1 - Math.random() * 0.01)
    
    demoData.push({
      time: Math.floor(time / 1000),
      open,
      high,
      low,
      close
    })
  }
  
  priceData.value = demoData
  volumeData.value = demoData.map(candle => ({
    time: candle.time,
    value: Math.random() * 1000,
    color: candle.close > candle.open ? '#2ebd85' : '#f6465d'
  }))
  
  currentPrice.value = demoData[demoData.length - 1].close
  totalVolume.value = 50000
  marketCap.value = 1000000
  priceChange24h.value = 5.23
  lastUpdate.value = new Date().toLocaleTimeString()
  
  loading.value = false
  
  if (lightweightChart) {
    addSeries()
  }
}

// Refresh chart data
const refreshChart = async () => {
  if (loading.value) return
  
  loading.value = true
  await loadRealChartData()
  
  if (lightweightChart) {
    nextTick(() => {
      addSeries()
    })
  }
  
  loading.value = false
}

const setTimeframe = async (timeframe: string) => {
  selectedTimeframe.value = timeframe
  
  // Clear existing data
  priceData.value = []
  volumeData.value = []
  
  // Reload chart data with new timeframe
  await loadRealChartData()
  
  // Force chart update
  if (lightweightChart) {
    nextTick(() => {
      addSeries()
    })
  }
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  
  nextTick(() => {
    if (lightweightChart) {
      lightweightChart.resize(
        chartContainer.value?.clientWidth || 800,
        chartContainer.value?.clientHeight || 500
      )
    }
  })
}

// Utility functions
const getHighPrice = (): number => {
  if (priceData.value.length === 0) return 0
  return Math.max(...priceData.value.map(p => p.high))
}

const getLowPrice = (): number => {
  if (priceData.value.length === 0) return 0
  return Math.min(...priceData.value.map(p => p.low))
}

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
  // Reduced delay for faster loading
  setTimeout(() => {
    initChart()
  }, 100)
})

onUnmounted(() => {
  // Clean up price subscription
  if (priceSubscription) {
    priceSubscription()
    priceSubscription = null
  }
  
  if (lightweightChart) {
    lightweightChart.remove()
  }
})

// Expose functions to parent component
defineExpose({
  setTimeframe,
  selectedTimeframe
})
</script>

<style scoped>
.lightweight-chart-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.chart-area {
  min-height: 500px;
  cursor: crosshair;
}

.chart-area.cursor {
  cursor: default;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
