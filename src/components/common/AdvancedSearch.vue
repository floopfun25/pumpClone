<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <!-- Search Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">🔍 Advanced Search</h2>
        <p class="text-gray-600 dark:text-gray-400">Find exactly what you're looking for</p>
      </div>
      <button 
        @click="resetFilters"
        class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Reset Filters
      </button>
    </div>

    <!-- Main Search Bar -->
    <div class="relative mb-6">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span class="text-gray-400">🔍</span>
      </div>
      <input
        v-model="searchQuery"
        @input="handleSearch"
        type="text"
        placeholder="Search tokens, creators, or descriptions..."
        class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      <div v-if="searching" class="absolute inset-y-0 right-0 pr-3 flex items-center">
        <div class="spinner w-5 h-5"></div>
      </div>
    </div>

    <!-- Quick Filters -->
    <div class="mb-6">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Filters</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="filter in quickFilters"
          :key="filter.key"
          @click="toggleQuickFilter(filter.key)"
          :class="[
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            activeQuickFilters.includes(filter.key)
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          ]"
        >
          {{ filter.emoji }} {{ filter.label }}
        </button>
      </div>
    </div>

    <!-- Advanced Filters -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- Market Cap Range -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Market Cap Range
        </label>
        <select v-model="filters.marketCapRange" class="input-field text-sm">
          <option value="">Any Size</option>
          <option value="micro">Micro ($0 - $10K)</option>
          <option value="small">Small ($10K - $100K)</option>
          <option value="medium">Medium ($100K - $1M)</option>
          <option value="large">Large ($1M+)</option>
        </select>
      </div>

      <!-- Age Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Token Age
        </label>
        <select v-model="filters.ageRange" class="input-field text-sm">
          <option value="">Any Age</option>
          <option value="1h">Last Hour</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last Week</option>
          <option value="30d">Last Month</option>
        </select>
      </div>

      <!-- Volume Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          24h Volume
        </label>
        <select v-model="filters.volumeRange" class="input-field text-sm">
          <option value="">Any Volume</option>
          <option value="low">Low ($0 - $1K)</option>
          <option value="medium">Medium ($1K - $10K)</option>
          <option value="high">High ($10K+)</option>
        </select>
      </div>

      <!-- Sort By -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Sort By
        </label>
        <select v-model="filters.sortBy" class="input-field text-sm">
          <option value="created_at">Newest First</option>
          <option value="market_cap">Market Cap</option>
          <option value="volume_24h">24h Volume</option>
          <option value="holders_count">Holder Count</option>
          <option value="bonding_curve_progress">Progress</option>
        </select>
      </div>
    </div>

    <!-- Advanced Options Toggle -->
    <div class="mb-4">
      <button
        @click="showAdvanced = !showAdvanced"
        class="flex items-center text-sm text-primary-600 hover:text-primary-700"
      >
        <span>{{ showAdvanced ? '▼' : '▶' }}</span>
        <span class="ml-1">Advanced Options</span>
      </button>
    </div>

    <!-- Advanced Options Panel -->
    <div v-if="showAdvanced" class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Creator Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Creator Address
          </label>
          <input
            v-model="filters.creatorAddress"
            type="text"
            placeholder="Enter wallet address..."
            class="input-field text-sm"
          />
        </div>

        <!-- Min Holders -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Minimum Holders
          </label>
          <input
            v-model.number="filters.minHolders"
            type="number"
            placeholder="0"
            class="input-field text-sm"
          />
        </div>

        <!-- Bonding Curve Progress -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Min Progress (%)
          </label>
          <input
            v-model.number="filters.minProgress"
            type="number"
            placeholder="0"
            min="0"
            max="100"
            class="input-field text-sm"
          />
        </div>
      </div>

      <!-- Boolean Filters -->
      <div class="mt-4 space-y-2">
        <label class="flex items-center">
          <input
            v-model="filters.featuredOnly"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Featured tokens only</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="filters.graduatedOnly"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Graduated tokens only</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="filters.excludeNsfw"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Hide NSFW content</span>
        </label>
      </div>
    </div>

    <!-- Search Results Summary -->
    <div v-if="searchQuery || hasActiveFilters" class="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ searching ? 'Searching...' : `Found ${resultCount} tokens` }}
          </span>
          <span v-if="searchQuery" class="text-sm text-gray-500 dark:text-gray-400 ml-2">
            matching "{{ searchQuery }}"
          </span>
        </div>
        <button
          v-if="hasActiveFilters"
          @click="clearSearch"
          class="text-sm text-red-600 hover:text-red-700"
        >
          Clear Search
        </button>
      </div>

      <!-- Active Filters Display -->
      <div v-if="activeFiltersDisplay.length > 0" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="filter in activeFiltersDisplay"
          :key="filter"
          class="inline-flex items-center px-2 py-1 rounded text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200"
        >
          {{ filter }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

interface SearchFilters {
  marketCapRange: string
  ageRange: string
  volumeRange: string
  sortBy: string
  creatorAddress: string
  minHolders: number | null
  minProgress: number | null
  featuredOnly: boolean
  graduatedOnly: boolean
  excludeNsfw: boolean
}

// Emits
const emit = defineEmits<{
  'search': [query: string, filters: SearchFilters]
  'filter-change': [filters: SearchFilters]
}>()

// Props
interface Props {
  loading?: boolean
  resultCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  resultCount: 0
})

// State
const searchQuery = ref('')
const searching = ref(false)
const showAdvanced = ref(false)
const activeQuickFilters = ref<string[]>([])

const filters = ref<SearchFilters>({
  marketCapRange: '',
  ageRange: '',
  volumeRange: '',
  sortBy: 'created_at',
  creatorAddress: '',
  minHolders: null,
  minProgress: null,
  featuredOnly: false,
  graduatedOnly: false,
  excludeNsfw: true
})

// Quick filter options
const quickFilters = [
  { key: 'trending', label: 'Trending', emoji: '🔥' },
  { key: 'new', label: 'New', emoji: '🆕' },
  { key: 'featured', label: 'Featured', emoji: '⭐' },
  { key: 'graduated', label: 'Graduated', emoji: '🎓' },
  { key: 'high-volume', label: 'High Volume', emoji: '📈' },
  { key: 'low-mcap', label: 'Low Market Cap', emoji: '💎' }
]

// Computed
const hasActiveFilters = computed(() => {
  return searchQuery.value.length > 0 ||
         filters.value.marketCapRange !== '' ||
         filters.value.ageRange !== '' ||
         filters.value.volumeRange !== '' ||
         filters.value.creatorAddress !== '' ||
         filters.value.minHolders !== null ||
         filters.value.minProgress !== null ||
         filters.value.featuredOnly ||
         filters.value.graduatedOnly ||
         activeQuickFilters.value.length > 0
})

const activeFiltersDisplay = computed(() => {
  const active = []
  
  if (filters.value.marketCapRange) active.push(`Market Cap: ${filters.value.marketCapRange}`)
  if (filters.value.ageRange) active.push(`Age: ${filters.value.ageRange}`)
  if (filters.value.volumeRange) active.push(`Volume: ${filters.value.volumeRange}`)
  if (filters.value.featuredOnly) active.push('Featured')
  if (filters.value.graduatedOnly) active.push('Graduated')
  if (filters.value.excludeNsfw) active.push('Safe Content')
  if (activeQuickFilters.value.length > 0) {
    activeQuickFilters.value.forEach(filter => {
      const filterObj = quickFilters.find(f => f.key === filter)
      if (filterObj) active.push(filterObj.label)
    })
  }
  
  return active
})

// Methods
const debouncedSearch = useDebounceFn(() => {
  performSearch()
}, 300)

const handleSearch = () => {
  searching.value = true
  debouncedSearch()
}

const performSearch = () => {
  emit('search', searchQuery.value, { ...filters.value })
  searching.value = false
}

const toggleQuickFilter = (filterKey: string) => {
  const index = activeQuickFilters.value.indexOf(filterKey)
  
  if (index > -1) {
    activeQuickFilters.value.splice(index, 1)
  } else {
    activeQuickFilters.value.push(filterKey)
  }
  
  // Apply quick filter logic
  applyQuickFilters()
  performSearch()
}

const applyQuickFilters = () => {
  activeQuickFilters.value.forEach(filterKey => {
    switch (filterKey) {
      case 'trending':
        filters.value.sortBy = 'volume_24h'
        break
      case 'new':
        filters.value.ageRange = '24h'
        filters.value.sortBy = 'created_at'
        break
      case 'featured':
        filters.value.featuredOnly = true
        break
      case 'graduated':
        filters.value.graduatedOnly = true
        break
      case 'high-volume':
        filters.value.volumeRange = 'high'
        break
      case 'low-mcap':
        filters.value.marketCapRange = 'micro'
        break
    }
  })
}

const resetFilters = () => {
  searchQuery.value = ''
  activeQuickFilters.value = []
  filters.value = {
    marketCapRange: '',
    ageRange: '',
    volumeRange: '',
    sortBy: 'created_at',
    creatorAddress: '',
    minHolders: null,
    minProgress: null,
    featuredOnly: false,
    graduatedOnly: false,
    excludeNsfw: true
  }
  performSearch()
}

const clearSearch = () => {
  searchQuery.value = ''
  performSearch()
}

// Watchers
watch(filters, () => {
  emit('filter-change', { ...filters.value })
  performSearch()
}, { deep: true })

watch(() => props.loading, (loading) => {
  searching.value = loading
})

// Lifecycle
onMounted(() => {
  // Load saved filters from localStorage
  const savedFilters = localStorage.getItem('floppfun-search-filters')
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters)
      Object.assign(filters.value, parsed)
    } catch (error) {
      console.error('Failed to load saved filters:', error)
    }
  }
})

// Save filters to localStorage when they change
watch(filters, (newFilters) => {
  localStorage.setItem('floppfun-search-filters', JSON.stringify(newFilters))
}, { deep: true })
</script> 