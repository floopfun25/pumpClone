<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Price Chart</h2>
      <div class="flex items-center space-x-2">
        <!-- Time Frame Selector -->
        <div class="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          <button
            v-for="timeframe in timeframes"
            :key="timeframe.value"
            @click="selectedTimeframe = timeframe.value"
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
          class="text-primary-600 hover:text-primary-700 text-sm p-2"
        >
          🔄
        </button>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10">
        <div class="spinner w-8 h-8"></div>
      </div>
      
      <div v-if="error" class="h-64 flex items-center justify-center text-red-500">
        <div class="text-center">
          <div class="text-4xl mb-2">⚠️</div>
          <p>{{ error }}</p>
          <button @click="refreshChart" class="mt-2 text-sm text-primary-600 hover:text-primary-700">
            Try Again
          </button>
        </div>
      </div>
      
      <div v-else-if="!hasData" class="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
        <div class="text-center">
          <div class="text-4xl mb-2">📈</div>
          <p class="text-gray-500 dark:text-gray-400">No price data available yet</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Start trading to see price movements</p>
        </div>
      </div>
      
      <div v-else class="h-64">
        <canvas ref="chartCanvas" class="w-full h-full"></canvas>
      </div>
    </div>

    <!-- Price Stats -->
    <div v-if="hasData" class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div class="text-center">
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatPrice(currentPrice) }}
        </div>
        <div class="text-xs text-gray-500">Current</div>
      </div>
      <div class="text-center">
        <div :class="[
          'text-lg font-semibold',
          priceChange24h >= 0 ? 'text-pump-green' : 'text-pump-red'
        ]">
          {{ priceChange24h >= 0 ? '+' : '' }}{{ priceChange24h.toFixed(2) }}%
        </div>
        <div class="text-xs text-gray-500">24h Change</div>
      </div>
      <div class="text-center">
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatPrice(high24h) }}
        </div>
        <div class="text-xs text-gray-500">24h High</div>
      </div>
      <div class="text-center">
        <div class="text-lg font-semibold text-gray-900 dark:text-white">
          ${{ formatPrice(low24h) }}
        </div>
        <div class="text-xs text-gray-500">24h Low</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { SupabaseService } from '@/services/supabase'

// Register Chart.js components
Chart.register(...registerables)

interface Props {
  tokenId: string
  tokenSymbol: string
}

const props = defineProps<Props>()

// State
const chartCanvas = ref<HTMLCanvasElement>()
const chart = ref<Chart>()
const loading = ref(false)
const error = ref('')
const selectedTimeframe = ref('24h')
const priceData = ref<any[]>([])

// Timeframe options
const timeframes = [
  { label: '1H', value: '1h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' }
]

// Computed properties
const hasData = computed(() => priceData.value.length > 0)
const currentPrice = computed(() => {
  if (!hasData.value) return 0
  return priceData.value[priceData.value.length - 1]?.price || 0
})

const priceChange24h = computed(() => {
  if (priceData.value.length < 2) return 0
  const current = currentPrice.value
  const yesterday = priceData.value[0]?.price || current
  return yesterday ? ((current - yesterday) / yesterday) * 100 : 0
})

const high24h = computed(() => {
  if (!hasData.value) return 0
  return Math.max(...priceData.value.map(d => d.price))
})

const low24h = computed(() => {
  if (!hasData.value) return 0
  return Math.min(...priceData.value.map(d => d.price))
})

// Methods
const loadChartData = async () => {
  if (!props.tokenId) return

  loading.value = true
  error.value = ''

  try {
    // Get price history data
    const data = await SupabaseService.getTokenPriceHistory(props.tokenId, selectedTimeframe.value)
    priceData.value = data

    if (data.length > 0) {
      await nextTick()
      createChart()
    }
  } catch (err) {
    console.error('Failed to load chart data:', err)
    error.value = 'Failed to load chart data'
  } finally {
    loading.value = false
  }
}

const createChart = () => {
  if (!chartCanvas.value || !hasData.value) return

  // Destroy existing chart
  if (chart.value) {
    chart.value.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // Prepare data for Chart.js
  const labels = priceData.value.map(d => {
    const date = new Date(d.timestamp)
    if (selectedTimeframe.value === '1h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (selectedTimeframe.value === '24h') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  })

  const prices = priceData.value.map(d => d.price)
  const volumes = priceData.value.map(d => d.volume || 0)

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400)
  gradient.addColorStop(0, priceChange24h.value >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  chart.value = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Price',
          data: prices,
          borderColor: priceChange24h.value >= 0 ? '#22c55e' : '#ef4444',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: priceChange24h.value >= 0 ? '#22c55e' : '#ef4444',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#374151',
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              const price = context.parsed.y
              return `Price: $${formatPrice(price)}`
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false
          },
          ticks: {
            color: '#6b7280',
            maxTicksLimit: 6
          }
        },
        y: {
          display: true,
          position: 'right',
          grid: {
            color: 'rgba(107, 114, 128, 0.1)'
          },
          ticks: {
            color: '#6b7280',
            callback: (value) => '$' + formatPrice(Number(value))
          }
        }
      }
    }
  })
}

const refreshChart = () => {
  loadChartData()
}

const formatPrice = (price: number): string => {
  if (price === 0) return '0.000000'
  if (price < 0.000001) return price.toExponential(2)
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  return price.toFixed(2)
}

// Watchers
watch(() => props.tokenId, () => {
  if (props.tokenId) {
    loadChartData()
  }
})

watch(selectedTimeframe, () => {
  loadChartData()
})

// Lifecycle
onMounted(() => {
  if (props.tokenId) {
    loadChartData()
  }
})

onUnmounted(() => {
  if (chart.value) {
    chart.value.destroy()
  }
})
</script> 