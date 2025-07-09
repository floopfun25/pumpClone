<template>
  <div class="tradingview-chart-container bg-[#0b0e11] border border-[#2b3139] rounded-xl overflow-hidden">
    <!-- Chart Header -->
    <div class="flex items-center justify-between p-4 border-b border-[#2b3139] bg-[#1e2329]">
      <!-- Token Info -->
      <h3 class="text-white font-medium">{{ tokenSymbol }}/SOL</h3>
      
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
      </div>

      <div class="flex items-center gap-4">
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
        

      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative">
      <!-- TradingView Widget (Primary) -->
      <div 
        v-if="!useFallback"
        ref="tradingViewContainer" 
        :class="[
          'tradingview-widget-container',
          isFullscreen ? 'fixed inset-0 z-50 bg-[#0b0e11] p-4' : 'h-[500px]'
        ]"
      >
        <div 
          :id="chartId"
          class="tradingview-widget w-full h-full"
        ></div>
      </div>

      <!-- Enhanced Lightweight Charts (Fallback) -->
      <div 
        v-else
        :class="[
          isFullscreen ? 'fixed inset-0 z-50 bg-[#0b0e11] p-4' : 'h-[500px]'
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
          <button 
            v-if="showFallbackOption"
            @click="switchToFallback"
            class="mt-2 px-3 py-1 text-xs bg-[#2ebd85] text-white rounded hover:bg-[#26a069] transition-colors"
          >
            Use Enhanced Chart Instead
          </button>
        </div>
      </div>
      
      <!-- Error State -->
      <div v-if="error && !loading" class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-90 z-20">
        <div class="text-center">
          <div class="text-[#f6465d] text-lg mb-2">⚠️ Chart Error</div>
          <div class="text-xs text-[#848e9c] mb-4">{{ error }}</div>
          <div class="flex gap-2 justify-center">
            <button 
              @click="initChart" 
              class="px-4 py-2 text-sm bg-[#2ebd85] text-white rounded hover:bg-[#26a069] transition-colors"
            >
              Retry Chart
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Footer -->
    <div class="p-3 bg-[#1e2329] border-t border-[#2b3139]">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-4">
          <span class="text-[#848e9c]">Volume: <span class="text-[#d1d4dc]">{{ formatVolume(totalVolume) }}</span></span>
          <span class="text-[#848e9c]">Market Cap: <span class="text-[#d1d4dc]">${{ formatMarketCap(marketCap) }}</span></span>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { createChart, ColorType, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'

// TypeScript declarations
declare global {
  interface Window {
    TradingView: any
  }
  var TradingView: any
}

interface Props {
  tokenId: string
  tokenSymbol: string
  mintAddress: string
}

interface DrawingTool {
  id: string
  name: string
  icon: string
}

interface Drawing {
  id: string
  type: string
  points: { x: number; y: number; price: number; time: number }[]
  color: string
}

const props = defineProps<Props>()

// Chart state
const tradingViewContainer = ref<HTMLElement>()
const chartContainer = ref<HTMLElement>()
const drawingCanvas = ref<HTMLCanvasElement>()
const loading = ref(true)
const loadingMessage = ref('Initializing chart...')
const error = ref('')
const isFullscreen = ref(false)
const useFallback = ref(true) // Always use enhanced chart
const showFallbackOption = ref(false)
const chartId = ref(`chart_${Math.random().toString(36).substr(2, 9)}`)

// Chart instances
let lightweightChart: any = null
let candlestickSeries: any = null
let volumeSeries: any = null

// Chart data
const priceData = ref<any[]>([])
const volumeData = ref<any[]>([])
const currentPrice = ref(0)
const totalVolume = ref(0)
const marketCap = ref(0)
const chartType = ref<'candlestick' | 'line' | 'area'>('candlestick')
const solPriceUSD = ref(0) // Store current SOL price for conversion

// Drawing tools state
const selectedTool = ref('cursor')
const drawings = ref<Drawing[]>([])
const isDrawing = ref(false)
const currentDrawing = ref<Drawing | null>(null)
const canvasWidth = ref(800)
const canvasHeight = ref(500)

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

const chartTypes = [
  { label: 'Candles', value: 'candlestick' }
]

const drawingTools: DrawingTool[] = [
  { id: 'cursor', name: 'Cursor', icon: '🖱️' },
  { id: 'trendline', name: 'Trend Line', icon: '📈' },
  { id: 'horizontal', name: 'Horizontal Line', icon: '➖' },
  { id: 'vertical', name: 'Vertical Line', icon: '|' },
  { id: 'rectangle', name: 'Rectangle', icon: '▭' },
  { id: 'fibonacci', name: 'Fibonacci', icon: '🌀' }
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
    showFallbackOption.value = false
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
        if (useFallback.value && lightweightChart && candlestickSeries) {
          if (chartType.value === 'candlestick') {
            candlestickSeries.setData(priceData.value)
          } else if (chartType.value === 'line') {
            const lineData = priceData.value.map(candle => ({
              time: candle.time,
              value: Number(candle.close) || 0
            })).filter(item => item.value > 0)
            
            if (lineData.length > 0) {
              candlestickSeries.setData(lineData)
            }
          } else if (chartType.value === 'area') {
            const areaData = priceData.value.map(candle => ({
              time: candle.time,
              value: Number(candle.close) || 0
            })).filter(item => item.value > 0)
            
            if (areaData.length > 0) {
              candlestickSeries.setData(areaData)
            }
          }
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
    height: 500,
    layout: {
      background: { type: ColorType.Solid, color: '#0b0e11' },
      textColor: '#d1d4dc',
    },
    grid: {
      vertLines: { color: '#1e2329' },
      horzLines: { color: '#1e2329' }
    },
    crosshair: {
      mode: 1,
      vertLine: { color: '#848e9c' },
      horzLine: { color: '#848e9c' }
    },
    rightPriceScale: {
      borderColor: '#2b3139',
      textColor: '#848e9c',
      scaleMargins: {
        top: 0.1,
        bottom: 0.2,
      },
    },
    timeScale: {
      borderColor: '#2b3139',
      timeVisible: true,
      secondsVisible: false
    }
  })

  // Add series with the loaded data
  try {
    addSeries()
  } catch (error) {
    console.error('Failed to add chart series:', error)
    throw error
  }
  
  // Setup canvas for drawings
  setupDrawingCanvas()

  loading.value = false
}

const addSeries = () => {
  if (!lightweightChart) return

  // Remove existing series
  if (candlestickSeries) {
    try {
      lightweightChart.removeSeries(candlestickSeries)
    } catch (error) {
      console.warn('Error removing candlestick series:', error)
    }
    candlestickSeries = null
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
    // Add new series based on type using correct v5 API
    if (chartType.value === 'candlestick') {
      // Add candlestick series using correct API
      candlestickSeries = lightweightChart.addSeries(CandlestickSeries, {
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
        candlestickSeries.setData(priceData.value)
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
    } else if (chartType.value === 'line') {
      // Add line series using correct API
      candlestickSeries = lightweightChart.addSeries(LineSeries, {
        color: '#2ebd85',
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 8,
          formatter: (price: number) => `$${convertToUSD(price).toFixed(8)}`,
        },
      })
      
      const lineData = priceData.value.map(candle => ({
        time: candle.time,
        value: Number(candle.close) || 0
      })).filter(item => item.value > 0)
      
      if (lineData.length > 0) {
        candlestickSeries.setData(lineData)
      }
    } else if (chartType.value === 'area') {
      // Add area series using correct API
      candlestickSeries = lightweightChart.addSeries(AreaSeries, {
        topColor: 'rgba(46, 189, 133, 0.4)',
        bottomColor: 'rgba(46, 189, 133, 0.05)',
        lineColor: '#2ebd85',
        lineWidth: 2,
        priceFormat: {
          type: 'price',
          precision: 8,
          formatter: (price: number) => `$${convertToUSD(price).toFixed(8)}`,
        },
      })
      
      const areaData = priceData.value.map(candle => ({
        time: candle.time,
        value: Number(candle.close) || 0
      })).filter(item => item.value > 0)
      
      if (areaData.length > 0) {
        candlestickSeries.setData(areaData)
      }
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
    
    // Ensure we have valid data
    if (chartData.length === 0) {
      // Create a minimal dataset with current price
      const now = Date.now()
      const currentPrice = bondingCurveState.currentPrice
      
      chartData.push({
        time: now - 5 * 60 * 1000, // 5 minutes ago
        open: currentPrice,
        high: currentPrice * 1.001,
        low: currentPrice * 0.999,
        close: currentPrice,
        volume: 0
      })
      
      chartData.push({
        time: now,
        open: currentPrice,
        high: currentPrice * 1.001,
        low: currentPrice * 0.999,
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

// Drawing functionality
const setupDrawingCanvas = () => {
  if (!drawingCanvas.value || !chartContainer.value) return
  
  const container = chartContainer.value
  canvasWidth.value = container.clientWidth
  canvasHeight.value = container.clientHeight
  
  const canvas = drawingCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Set canvas size
  canvas.width = canvasWidth.value
  canvas.height = canvasHeight.value
  
  // Enable pointer events for drawing
  canvas.style.pointerEvents = 'auto'
}

const onMouseDown = (event: MouseEvent) => {
  if (selectedTool.value === 'cursor') return
  
  isDrawing.value = true
  const rect = chartContainer.value?.getBoundingClientRect()
  if (!rect) return
  
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Start new drawing
  currentDrawing.value = {
    id: Date.now().toString(),
    type: selectedTool.value,
    points: [{ x, y, price: 0, time: 0 }],
    color: '#f0b90b'
  }
}

const onMouseMove = (event: MouseEvent) => {
  if (!isDrawing.value || !currentDrawing.value) return
  
  const rect = chartContainer.value?.getBoundingClientRect()
  if (!rect) return
  
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Update drawing
  if (currentDrawing.value.points.length === 1) {
    currentDrawing.value.points.push({ x, y, price: 0, time: 0 })
  } else {
    currentDrawing.value.points[1] = { x, y, price: 0, time: 0 }
  }
  
  drawCanvas()
}

const onMouseUp = () => {
  if (!isDrawing.value || !currentDrawing.value) return
  
  // Finalize drawing
  drawings.value.push({ ...currentDrawing.value })
  currentDrawing.value = null
  isDrawing.value = false
  
  drawCanvas()
}

const onChartClick = (event: MouseEvent) => {
  if (selectedTool.value !== 'cursor') return
  // Handle click events for cursor tool
}

const drawCanvas = () => {
  const canvas = drawingCanvas.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // Draw all drawings
  const allDrawings = [...drawings.value]
  if (currentDrawing.value) {
    allDrawings.push(currentDrawing.value)
  }
  
  allDrawings.forEach((drawing: Drawing) => {
    if (!drawing || drawing.points.length < 2) return
    
    ctx.strokeStyle = drawing.color
    ctx.lineWidth = 2
    ctx.beginPath()
    
    const [start, end] = drawing.points
    
    switch (drawing.type) {
      case 'trendline':
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        break
      case 'horizontal':
        ctx.moveTo(0, start.y)
        ctx.lineTo(canvas.width, start.y)
        break
      case 'vertical':
        ctx.moveTo(start.x, 0)
        ctx.lineTo(start.x, canvas.height)
        break
      case 'rectangle':
        const width = end.x - start.x
        const height = end.y - start.y
        ctx.rect(start.x, start.y, width, height)
        break
    }
    
    ctx.stroke()
  })
}

// Chart controls
const setChartType = (type: string) => {
  chartType.value = type as any
  if (useFallback.value && lightweightChart) {
    addSeries()
  }
}

const setTimeframe = async (timeframe: string) => {
  selectedTimeframe.value = timeframe
  
  // Clear existing data
  priceData.value = []
  volumeData.value = []
  
  // Reload chart data with new timeframe
  await loadRealChartData()
  
  // Force chart update
  if (useFallback.value && lightweightChart) {
    nextTick(() => {
      addSeries()
    })
  }
}

const selectDrawingTool = (toolId: string) => {
  selectedTool.value = toolId
}

const clearDrawings = () => {
  drawings.value = []
  currentDrawing.value = null
  drawCanvas()
}

const switchToFallback = () => {
  useFallback.value = true
  showFallbackOption.value = false
  error.value = ''
  
  // Initialize lightweight chart
  nextTick(async () => {
    await initLightweightChart()
    // Set up real-time price updates for fallback chart
    setupRealTimePriceUpdates()
  })
}

// TradingView functions removed - we now use only the enhanced chart

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  
  nextTick(() => {
    if (useFallback.value && lightweightChart) {
      lightweightChart.resize(
        chartContainer.value?.clientWidth || 800,
        chartContainer.value?.clientHeight || 500
      )
      setupDrawingCanvas()
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
  setTimeout(() => {
    initChart()
  }, 500)
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
</script>

<style scoped>
.tradingview-chart-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.chart-area {
  min-height: 500px;
  cursor: crosshair;
}

.chart-area.cursor {
  cursor: default;
}

.tradingview-widget-container {
  position: relative;
}

.tradingview-widget {
  background: #0b0e11;
}

.tradingview-widget-container.fixed,
.chart-area.fixed {
  background: #0b0e11;
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