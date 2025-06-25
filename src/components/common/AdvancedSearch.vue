<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
    <!-- Search Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">🔍 {{ t('search.advancedSearch') }}</h2>
        <p class="text-gray-600 dark:text-gray-400">{{ t('search.findExactly') }}</p>
      </div>
      <button 
        @click="resetFilters"
        class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        {{ t('search.resetFilters') }}
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
        :placeholder="t('search.searchPlaceholder')"
        class="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
      <div v-if="searching" class="absolute inset-y-0 right-0 pr-3 flex items-center">
        <div class="spinner w-5 h-5"></div>
      </div>
    </div>

    <!-- Quick Filters -->
    <div class="mb-6">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{{ t('search.quickFilters') }}</h3>
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
          {{ t('search.marketCapRange') }}
        </label>
        <select v-model="filters.marketCapRange" class="input-field text-sm">
          <option value="">{{ t('search.anySize') }}</option>
          <option value="micro">{{ t('search.micro') }}</option>
          <option value="small">{{ t('search.small') }}</option>
          <option value="medium">{{ t('search.medium') }}</option>
          <option value="large">{{ t('search.large') }}</option>
        </select>
      </div>

      <!-- Age Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('search.tokenAge') }}
        </label>
        <select v-model="filters.ageRange" class="input-field text-sm">
          <option value="">{{ t('search.anyAge') }}</option>
          <option value="1h">{{ t('search.lastHour') }}</option>
          <option value="24h">{{ t('search.last24Hours') }}</option>
          <option value="7d">{{ t('search.lastWeek') }}</option>
          <option value="30d">{{ t('search.lastMonth') }}</option>
        </select>
      </div>

      <!-- Volume Filter -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('search.volume24h') }}
        </label>
        <select v-model="filters.volumeRange" class="input-field text-sm">
          <option value="">{{ t('search.anyVolume') }}</option>
          <option value="low">{{ t('search.lowVolume') }}</option>
          <option value="medium">{{ t('search.mediumVolume') }}</option>
          <option value="high">{{ t('search.highVolume') }}</option>
        </select>
      </div>

      <!-- Sort By -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('search.sortBy') }}
        </label>
        <select v-model="filters.sortBy" class="input-field text-sm">
          <option value="created_at">{{ t('search.newestFirst') }}</option>
          <option value="market_cap">{{ t('search.marketCap') }}</option>
          <option value="volume_24h">{{ t('search.volume24h') }}</option>
          <option value="holders_count">{{ t('search.holderCount') }}</option>
          <option value="bonding_curve_progress">{{ t('search.progress') }}</option>
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
        <span class="ml-1">{{ t('search.advancedOptions') }}</span>
      </button>
    </div>

    <!-- Advanced Options Panel -->
    <div v-if="showAdvanced" class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Creator Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('search.creatorAddress') }}
          </label>
          <input
            v-model="filters.creatorAddress"
            type="text"
            :placeholder="t('search.enterWalletAddress')"
            class="input-field text-sm"
          />
        </div>

        <!-- Min Holders -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('search.minimumHolders') }}
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
            {{ t('search.minProgress') }}
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
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('search.featuredTokensOnly') }}</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="filters.graduatedOnly"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('search.graduatedTokensOnly') }}</span>
        </label>
        <label class="flex items-center">
          <input
            v-model="filters.excludeNsfw"
            type="checkbox"
            class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('search.hideNsfwContent') }}</span>
        </label>
      </div>
    </div>

    <!-- Search Results Summary -->
    <div v-if="searchQuery || hasActiveFilters" class="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ searching ? t('search.searchingTokens') : t('search.foundTokens', { count: resultCount }) }}
          </span>
          <span v-if="searchQuery" class="text-sm text-gray-500 dark:text-gray-400 ml-2">
            {{ t('search.matching', { query: searchQuery }) }}
          </span>
        </div>
        <button
          v-if="hasActiveFilters"
          @click="clearSearch"
          class="text-sm text-red-600 hover:text-red-700"
        >
          {{ t('search.clearSearch') }}
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
import { useTypedI18n } from '@/i18n'

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

// Setup i18n
const { t } = useTypedI18n()

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
const quickFilters = computed(() => [
  { key: 'trending', label: t('search.quickFilterTrending'), emoji: '🔥' },
  { key: 'new', label: t('search.quickFilterNew'), emoji: '🆕' },
  { key: 'featured', label: t('search.quickFilterFeatured'), emoji: '⭐' },
  { key: 'graduated', label: t('search.quickFilterGraduated'), emoji: '🎓' },
  { key: 'high-volume', label: t('search.quickFilterHighVolume'), emoji: '📈' },
  { key: 'low-mcap', label: t('search.quickFilterLowMarketCap'), emoji: '💎' }
])

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
      const filterObj = quickFilters.value.find(f => f.key === filter)
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