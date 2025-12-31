<template>
  <div
    ref="chartContainerWrapper"
    class="chart-container bg-[#0b0e11] border border-[#2b3139] rounded-xl overflow-hidden"
  >
    <!-- Chart Header -->
    <div
      class="flex items-center justify-between p-4 border-b border-[#2b3139] bg-[#1e2329]"
    >
      <!-- Token Info -->
      <div class="flex items-center gap-3">
        <h3 class="text-white font-medium">{{ tokenSymbol }}/SOL</h3>
        <div v-if="isLive" class="flex items-center gap-1">
          <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span class="text-xs text-green-500">LIVE</span>
        </div>
      </div>

      <!-- OHLC Data (crosshair-synced) -->
      <div
        v-if="displayOHLC.time"
        class="flex items-center gap-3"
        style="font-size: 10px"
      >
        <span class="text-[#848e9c]" title="Open">
          O: <span class="text-[#d1d4dc]">{{ formatDisplayPrice(displayOHLC.open) }}</span>
        </span>
        <span class="text-[#848e9c]" title="High">
          H: <span class="text-green-400">{{ formatDisplayPrice(displayOHLC.high) }}</span>
        </span>
        <span class="text-[#848e9c]" title="Low">
          L: <span class="text-red-400">{{ formatDisplayPrice(displayOHLC.low) }}</span>
        </span>
        <span class="text-[#848e9c]" title="Close">
          C: <span class="text-[#d1d4dc]">{{ formatDisplayPrice(displayOHLC.close) }}</span>
        </span>
      </div>
    </div>

    <!-- Price Info Bar -->
    <div
      class="flex items-center justify-between p-3 bg-[#1e2329] border-b border-[#2b3139]"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm text-[#848e9c]">{{ tokenSymbol }}/SOL</span>
        <span :class="['text-lg font-bold', priceChangeColor]">
          {{ formatDisplayPrice(currentPrice) }}
        </span>
        <span
          v-if="priceChange24h !== 0"
          :class="['text-sm', priceChangeColor]"
        >
          ({{ priceChange24h >= 0 ? "+" : "" }}{{ priceChange24h.toFixed(2) }}%)
        </span>
      </div>

      <div class="flex items-center gap-4">
        <!-- Scale Mode Toggle -->
        <button
          @click="toggleScaleMode"
          class="px-2 py-1 text-xs bg-[#2b3139] text-[#d1d4dc] border border-[#3c4043] rounded hover:border-[#f0b90b] transition-colors"
          :title="scaleMode === 0 ? 'Switch to Logarithmic' : 'Switch to Linear'"
        >
          {{ scaleMode === 0 ? 'Linear' : 'Log' }}
        </button>

        <!-- Timeframe Selection -->
        <select
          v-model="selectedTimeframe"
          @change="setTimeframe(selectedTimeframe)"
          class="px-3 py-1 text-xs bg-[#2b3139] text-[#d1d4dc] border border-[#3c4043] rounded focus:outline-none focus:border-[#f0b90b] transition-colors min-w-[80px]"
        >
          <option
            v-for="timeframe in timeframes"
            :key="timeframe.value"
            :value="timeframe.value"
          >
            {{ timeframe.label }}
          </option>
        </select>

        <!-- Fullscreen Toggle -->
        <button
          @click="toggleFullscreen"
          class="p-1 text-[#848e9c] hover:text-[#d1d4dc] transition-colors"
          title="Toggle Fullscreen"
        >
          <svg
            v-if="!isFullscreen"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            ></path>
          </svg>
          <svg
            v-else
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="relative">
      <!-- Chart Area -->
      <div
        ref="chartContainer"
        :class="[
          'chart-area relative w-full',
          isFullscreen ? 'h-screen' : 'h-[400px] md:h-[500px]'
        ]"
      ></div>

      <!-- Skeleton Loading State -->
      <div
        v-if="loading && !error"
        class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-95 z-20"
      >
        <div class="w-full h-full p-4">
          <!-- Skeleton chart bars -->
          <div class="flex items-end justify-around h-full gap-1">
            <div v-for="i in 20" :key="i" class="flex-1 bg-[#2b3139] animate-pulse rounded-t" :style="{ height: `${20 + Math.random() * 60}%` }"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-if="error && !loading"
        class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-90 z-20"
      >
        <div class="text-center max-w-sm">
          <div class="text-[#f6465d] text-lg mb-2">⚠️ Chart Error</div>
          <div class="text-xs text-[#848e9c] mb-4">{{ error }}</div>
          <button
            @click="retryChart"
            class="px-4 py-2 text-sm bg-[#2ebd85] text-white rounded hover:bg-[#26a069] transition-colors"
          >
            Retry Chart
          </button>
        </div>
      </div>

      <!-- Enhanced Empty State -->
      <div
        v-if="!loading && !error && priceData.length === 0"
        class="absolute inset-0 flex items-center justify-center bg-[#0b0e11] bg-opacity-90 z-20"
      >
        <div class="text-center">
          <div class="text-4xl mb-2">📈</div>
          <div class="text-[#848e9c] text-sm mb-2">No trading data yet</div>
          <div class="text-[#848e9c] text-xs opacity-75">
            Chart will appear after the first trade
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Footer -->
    <div class="p-3 bg-[#1e2329] border-t border-[#2b3139]">
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-4">
          <span class="text-[#848e9c]">
            Volume: <span class="text-[#d1d4dc]">{{ formatVolume(totalVolume) }}</span>
          </span>
          <span class="text-[#848e9c]">
            Market Cap: <span class="text-[#d1d4dc]">${{ formatMarketCap(marketCap) }}</span>
          </span>
          <span v-if="lastUpdate" class="text-[#848e9c]">
            Updated: {{ lastUpdate }}
          </span>
        </div>

        <!-- Chart Controls -->
        <div class="flex items-center gap-2">
          <button
            @click="refreshChart"
            :disabled="loading"
            class="p-1 text-[#848e9c] hover:text-[#d1d4dc] transition-colors disabled:opacity-50"
            title="Refresh Chart"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from "vue";
import {
  createChart,
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData } from "lightweight-charts";

interface Props {
  tokenId: string;
  tokenSymbol: string;
  mintAddress: string;
}

const props = defineProps<Props>();

// Chart state
const chartContainerWrapper = ref<HTMLElement>();
const chartContainer = ref<HTMLElement>();
const loading = ref(true);
const error = ref("");
const isFullscreen = ref(false);

// Chart instances
let lightweightChart: IChartApi | null = null;
let mainSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;

// Chart data
const priceData = ref<CandlestickData[]>([]);
const volumeData = ref<HistogramData[]>([]);
const currentPrice = ref(0);
const totalVolume = ref(0);
const marketCap = ref(0);
const solPriceUSD = ref(0);

// Enhanced chart state
const isLive = ref(false);
const lastUpdate = ref("");
const priceChange24h = ref(0);
const scaleMode = ref<0 | 1>(0); // 0 = Normal, 1 = Logarithmic

// OHLC display state (synced with crosshair)
const displayOHLC = ref<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}>({
  time: 0,
  open: 0,
  high: 0,
  low: 0,
  close: 0,
});

// Chart configuration
const selectedTimeframe = ref("24h");
const timeframes = [
  { label: "1M", value: "1m" },
  { label: "5M", value: "5m" },
  { label: "15M", value: "15m" },
  { label: "30M", value: "30m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
];

// Real-time price subscription
let priceSubscription: (() => void) | null = null;

// Computed
const priceChangeColor = computed(() => {
  if (priceChange24h.value === 0) return "text-[#d1d4dc]";
  return priceChange24h.value > 0 ? "text-[#2ebd85]" : "text-[#f6465d]";
});

// Get current SOL price for USD conversion
const getSolPriceUSD = async () => {
  try {
    const { priceOracleService } = await import("../../services/priceOracle");
    const solPriceData = await priceOracleService.getSOLPrice();
    solPriceUSD.value = solPriceData.price;
  } catch (error) {
    console.warn("Failed to get SOL price, using fallback:", error);
    solPriceUSD.value = 140; // Fallback
  }
};

// Convert SOL price to USD
const convertToUSD = (solPrice: number): number => {
  return solPrice * solPriceUSD.value;
};

// Format price for display with intelligent precision
const formatDisplayPrice = (price: number): string => {
  const usdPrice = convertToUSD(price);

  if (usdPrice >= 1) {
    return `$${usdPrice.toFixed(2)}`;
  } else if (usdPrice >= 0.01) {
    return `$${usdPrice.toFixed(4)}`;
  } else if (usdPrice >= 0.00001) {
    return `$${usdPrice.toFixed(6)}`;
  } else if (usdPrice > 0) {
    return `$${usdPrice.toFixed(8)}`;
  } else {
    return `$0.00`;
  }
};

// Initialize chart
const initChart = async () => {
  try {
    loading.value = true;
    error.value = "";

    // Get SOL price first
    await getSolPriceUSD();

    await initLightweightChart();

    // Set up real-time price updates
    setupRealTimePriceUpdates();
  } catch (err: any) {
    console.error("Chart initialization failed:", err);
    error.value = `Chart initialization failed: ${err.message}`;
    loading.value = false;
  }
};

// Setup real-time price updates
const setupRealTimePriceUpdates = async () => {
  if (!props.tokenId) return;

  try {
    // Ensure we have SOL price for conversion
    if (solPriceUSD.value === 0) {
      await getSolPriceUSD();
    }

    const { RealTimePriceService } = await import(
      "../../services/realTimePriceService"
    );

    priceSubscription = RealTimePriceService.subscribe(
      props.tokenId,
      async (realPriceData) => {
        // Update current price display
        currentPrice.value = realPriceData.price;
        marketCap.value = realPriceData.marketCap;
        priceChange24h.value = realPriceData.priceChange24h || 0;
        isLive.value = true;
        lastUpdate.value = new Date().toLocaleTimeString();

        // Get updated chart data for current timeframe
        const chartData = RealTimePriceService.getChartData(
          props.tokenId,
          selectedTimeframe.value,
        );

        if (chartData.length > 0) {
          // Convert to lightweight charts format
          const newPriceData: CandlestickData[] = chartData.map((candle) => ({
            time: Number(candle.time) as any,
            open: Math.abs(Number(candle.open) || realPriceData.price),
            high: Math.abs(Number(candle.high) || realPriceData.price),
            low: Math.abs(Number(candle.low) || realPriceData.price),
            close: Math.abs(Number(candle.close) || realPriceData.price),
          }));

          const newVolumeData: HistogramData[] = chartData.map((candle, index) => ({
            time: Number(candle.time) as any,
            value: Number(candle.volume) || 0,
            // Volume color based on close vs previous close
            color: index > 0 && candle.close >= chartData[index - 1].close ? "#2ebd85" : "#f6465d",
          }));

          priceData.value = newPriceData;
          volumeData.value = newVolumeData;

          // Update chart - use setData for full refresh to avoid time ordering issues
          if (lightweightChart && mainSeries && volumeSeries) {
            // Create plain objects array to avoid Vue Proxy issues
            const cleanPriceData = newPriceData.map(candle => ({
              time: Number(candle.time),
              open: Number(candle.open),
              high: Number(candle.high),
              low: Number(candle.low),
              close: Number(candle.close),
            }));

            const cleanVolumeData = newVolumeData.map(vol => ({
              time: Number(vol.time),
              value: Number(vol.value),
              color: vol.color,
            }));

            console.log('[CHART] Updating chart with real-time data:', {
              priceDataLength: cleanPriceData.length,
              volumeDataLength: cleanVolumeData.length,
              firstCandle: cleanPriceData[0],
              lastCandle: cleanPriceData[cleanPriceData.length - 1],
              allPrices: cleanPriceData.map(c => c.close)
            });

            mainSeries.setData(cleanPriceData as any);
            volumeSeries.setData(cleanVolumeData as any);
          }
        }
      },
    );
  } catch (error) {
    console.warn("Failed to setup real-time price updates:", error);
  }
};

// Lightweight Charts initialization
const initLightweightChart = async () => {
  if (!chartContainer.value) {
    throw new Error("Chart container not found");
  }

  // Load real chart data first
  await loadRealChartData();

  // Create chart with proper configuration
  lightweightChart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: chartContainer.value.clientHeight || 500,
    layout: {
      background: { type: ColorType.Solid, color: "#0b0e11" },
      textColor: "#d1d4dc",
      fontSize: 12,
    },
    grid: {
      vertLines: { color: "#1e2329", style: 1 },
      horzLines: { color: "#1e2329", style: 1 },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: "#848e9c",
        width: 1,
        style: 2,
        labelBackgroundColor: "#2b3139",
      },
      horzLine: {
        color: "#848e9c",
        width: 1,
        style: 2,
        labelBackgroundColor: "#2b3139",
      },
    },
    rightPriceScale: {
      borderColor: "#2b3139",
      textColor: "#848e9c",
      scaleMargins: {
        top: 0.05,
        bottom: 0.25, // Increased from 0.3 for better volume visibility
      },
      autoScale: true,
      mode: PriceScaleMode.Normal,
      minimumWidth: 80, // Ensure enough space for small values
      alignLabels: true,
      borderVisible: true,
    },
    timeScale: {
      borderColor: "#2b3139",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 12,
      barSpacing: 6,
      minBarSpacing: 3,
      fixLeftEdge: false,
      fixRightEdge: false,
      lockVisibleTimeRangeOnResize: true,
      rightBarStaysOnScroll: true,
      visible: true,
      tickMarkFormatter: (time: number) => {
        return formatTimeAxisLabel(time, selectedTimeframe.value);
      },
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
    },
  });

  // Add series
  addSeries();

  // Subscribe to crosshair move for OHLC sync
  lightweightChart.subscribeCrosshairMove((param) => {
    if (!param.time || !mainSeries) {
      // Show latest candle when not hovering
      if (priceData.value.length > 0) {
        const latest = priceData.value[priceData.value.length - 1];
        displayOHLC.value = {
          time: latest.time as number,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close,
        };
      }
      return;
    }

    const data = param.seriesData.get(mainSeries) as CandlestickData | undefined;
    if (data) {
      displayOHLC.value = {
        time: param.time as number,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
      };
    }
  });

  // Auto-fit data
  if (priceData.value.length > 0) {
    lightweightChart.timeScale().fitContent();
  }

  loading.value = false;
};

// Format time axis labels based on timeframe
const formatTimeAxisLabel = (time: number, timeframe: string): string => {
  const date = new Date(time * 1000);

  switch (timeframe) {
    case "1m":
    case "5m":
    case "15m":
    case "30m":
      // HH:mm for intraday
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    case "1h":
    case "4h":
      // MMM DD HH:mm for hourly
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }) + " " + date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    case "24h":
    case "7d":
      // MMM DD for daily
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
    case "30d":
      // MMM DD YYYY for monthly
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    default:
      return date.toLocaleDateString();
  }
};

const addSeries = () => {
  if (!lightweightChart) return;

  // Remove existing series
  if (mainSeries) {
    lightweightChart.removeSeries(mainSeries);
    mainSeries = null;
  }

  if (volumeSeries) {
    lightweightChart.removeSeries(volumeSeries);
    volumeSeries = null;
  }

  // Add candlestick series (using v5 API)
  mainSeries = lightweightChart.addSeries(CandlestickSeries, {
    upColor: "#2ebd85",
    downColor: "#f6465d",
    borderUpColor: "#2ebd85",
    borderDownColor: "#f6465d",
    wickUpColor: "#2ebd85",
    wickDownColor: "#f6465d",
    priceFormat: {
      type: "custom",
      minMove: 0.00000001,
      formatter: (price: number) => {
        // Format very small prices with appropriate precision
        if (price === 0) return '0';
        if (price < 0.00000001) return price.toExponential(2);
        if (price < 0.000001) return price.toFixed(8);
        if (price < 0.01) return price.toFixed(6);
        return price.toFixed(4);
      },
    },
    autoscaleInfoProvider: () => {
      // Calculate min and max from actual data
      if (priceData.value.length === 0) {
        return { priceRange: { minValue: 0, maxValue: 1 } };
      }

      const prices = priceData.value.flatMap(candle => [
        candle.high,
        candle.low
      ]);

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // If all prices are identical or very close, create a range around them
      const priceRange = maxPrice - minPrice;
      if (priceRange === 0 || priceRange < maxPrice * 0.01) {
        // Add 10% padding above and below when prices are identical/similar
        const padding = maxPrice * 0.1;
        const result = {
          priceRange: {
            minValue: Math.max(0, minPrice - padding), // Never go below 0
            maxValue: maxPrice + padding,
          },
        };
        console.log('[CHART] Autoscale for identical prices:', {
          actualPrice: maxPrice,
          padding,
          minValue: result.priceRange.minValue,
          maxValue: result.priceRange.maxValue
        });
        return result;
      }

      // Normal case: use actual min/max with 5% padding
      const padding = priceRange * 0.05;
      const result = {
        priceRange: {
          minValue: Math.max(0, minPrice - padding), // Never go below 0
          maxValue: maxPrice + padding,
        },
      };
      console.log('[CHART] Autoscale for varying prices:', {
        minPrice,
        maxPrice,
        priceRange,
        padding,
        minValue: result.priceRange.minValue,
        maxValue: result.priceRange.maxValue
      });
      return result;
    },
  });

  if (priceData.value.length > 0) {
    console.log('[CHART] Setting candlestick data:', {
      dataLength: priceData.value.length,
      firstCandle: priceData.value[0],
      lastCandle: priceData.value[priceData.value.length - 1]
    });
    mainSeries.setData(priceData.value);
  }

  // Add volume histogram series (using v5 API)
  volumeSeries = lightweightChart.addSeries(HistogramSeries, {
    color: "#26a69a",
    priceFormat: {
      type: "volume",
    },
    priceScaleId: "", // Use separate price scale for volume
  });

  // Configure the volume price scale with margins
  volumeSeries.priceScale().applyOptions({
    scaleMargins: {
      top: 0.8, // Volume takes 20% at bottom
      bottom: 0.0,
    },
  });

  if (volumeData.value.length > 0) {
    volumeSeries.setData(volumeData.value);
  }
};

const loadRealChartData = async () => {
  if (!props.tokenId) {
    console.warn("No token ID provided for chart data");
    return;
  }

  try {
    // Get SOL price if not already loaded
    if (solPriceUSD.value === 0) {
      await getSolPriceUSD();
    }

    // Get historical chart data from backend
    const { RealTimePriceService } = await import(
      "../../services/realTimePriceService"
    );
    const chartData = await RealTimePriceService.getHistoricalChartData(
      props.tokenId,
      selectedTimeframe.value,
    );

    // If no data, show empty state
    if (chartData.length === 0) {
      priceData.value = [];
      volumeData.value = [];
      loading.value = false;
      return;
    }

    // Convert chart data to lightweight charts format
    priceData.value = chartData.map((candle) => {
      const data = {
        time: Number(candle.time) as any,
        open: Math.abs(Number(candle.open)),
        high: Math.abs(Number(candle.high)),
        low: Math.abs(Number(candle.low)),
        close: Math.abs(Number(candle.close)),
      };

      // Debug log for first few candles
      if (priceData.value.length < 3) {
        console.log('[CHART DEBUG] Candle data:', {
          raw: {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
          },
          converted: {
            time: data.time,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close
          }
        });
      }

      return data;
    });

    volumeData.value = chartData.map((candle, index) => ({
      time: Number(candle.time) as any,
      value: Number(candle.volume) || 0,
      // Color based on close vs previous close
      color: index > 0 && candle.close >= chartData[index - 1].close ? "#2ebd85" : "#f6465d",
    }));

    // Update current stats
    const latestCandle = chartData[chartData.length - 1];
    currentPrice.value = latestCandle.close;
    totalVolume.value = chartData.reduce(
      (sum, candle) => sum + (candle.volume || 0),
      0,
    );

    // Get market cap from bonding curve
    const { BondingCurveService } = await import("../../services/bondingCurve");
    const state = await BondingCurveService.getTokenBondingCurveState(props.tokenId);
    marketCap.value = state.marketCap;

    // Calculate 24h price change
    if (chartData.length > 1) {
      const firstCandle = chartData[0];
      const lastCandle = chartData[chartData.length - 1];
      priceChange24h.value =
        ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
    }

    // Set initial OHLC display
    if (priceData.value.length > 0) {
      const latest = priceData.value[priceData.value.length - 1];
      displayOHLC.value = {
        time: latest.time as number,
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
      };
    }

    lastUpdate.value = new Date().toLocaleTimeString();
  } catch (err: any) {
    console.error("Failed to load chart data:", err);
    error.value = `Failed to load chart data: ${err.message}`;
  }
};

// Chart controls
const retryChart = async () => {
  error.value = "";
  await initChart();
};

const refreshChart = async () => {
  if (loading.value) return;

  loading.value = true;
  await loadRealChartData();

  if (lightweightChart) {
    nextTick(() => {
      addSeries();
      if (priceData.value.length > 0) {
        lightweightChart?.timeScale().fitContent();
      }
    });
  }

  loading.value = false;
};

const setTimeframe = async (timeframe: string) => {
  selectedTimeframe.value = timeframe;
  loading.value = true;

  try {
    priceData.value = [];
    volumeData.value = [];

    await loadRealChartData();

    if (lightweightChart) {
      nextTick(() => {
        addSeries();
        if (priceData.value.length > 0) {
          lightweightChart?.timeScale().fitContent();
        }
      });
    }
  } catch (err: any) {
    console.error("Error changing timeframe:", err);
    error.value = "Failed to load chart data for this timeframe";
  } finally {
    loading.value = false;
  }
};

const toggleScaleMode = () => {
  scaleMode.value = scaleMode.value === 0 ? 1 : 0;

  if (lightweightChart) {
    lightweightChart.applyOptions({
      rightPriceScale: {
        mode: scaleMode.value === 0 ? PriceScaleMode.Normal : PriceScaleMode.Logarithmic,
      },
    });
  }
};

const toggleFullscreen = () => {
  if (!chartContainerWrapper.value) return;

  if (!isFullscreen.value) {
    // Enter fullscreen
    if (chartContainerWrapper.value.requestFullscreen) {
      chartContainerWrapper.value.requestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

// Utility functions
const formatVolume = (volume: number): string => {
  if (volume >= 1000000) return (volume / 1000000).toFixed(1) + "M";
  if (volume >= 1000) return (volume / 1000).toFixed(1) + "K";
  return volume.toFixed(0);
};

const formatMarketCap = (cap: number): string => {
  if (cap >= 1000000) return (cap / 1000000).toFixed(2) + "M";
  if (cap >= 1000) return (cap / 1000).toFixed(1) + "K";
  return cap.toFixed(0);
};

// Lifecycle
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  nextTick(() => {
    initChart().then(() => {
      // Handle resize
      resizeObserver = new ResizeObserver(() => {
        if (lightweightChart && chartContainer.value) {
          lightweightChart.resize(
            chartContainer.value.clientWidth,
            chartContainer.value.clientHeight,
          );
        }
      });

      if (chartContainer.value) {
        resizeObserver.observe(chartContainer.value);
      }
    });
  });
});

// Listen for fullscreen changes
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;

  // Resize chart when fullscreen state changes
  nextTick(() => {
    if (lightweightChart && chartContainer.value) {
      lightweightChart.resize(
        chartContainer.value.clientWidth,
        chartContainer.value.clientHeight,
      );
    }
  });
};

onMounted(() => {
  document.addEventListener("fullscreenchange", handleFullscreenChange);
});

onUnmounted(() => {
  // Clean up resize observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Clean up fullscreen listener
  document.removeEventListener("fullscreenchange", handleFullscreenChange);

  // Clean up price subscription
  if (priceSubscription) {
    priceSubscription();
    priceSubscription = null;
  }

  // Remove chart
  if (lightweightChart) {
    lightweightChart.remove();
  }
});

// Expose functions to parent component
defineExpose({
  setTimeframe,
  selectedTimeframe,
});
</script>

<style scoped>
.chart-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.chart-area {
  min-height: 400px;
  cursor: crosshair;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
