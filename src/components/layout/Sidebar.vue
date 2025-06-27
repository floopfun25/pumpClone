<template>
  <!-- Collapsible sidebar menu -->
  <div 
    class="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-trading-surface border-r border-binance-border transition-all duration-300 z-40 overflow-y-auto"
    :class="isCollapsed ? 'w-16' : 'w-64'"
  >
    <!-- Collapse/Expand Button -->
    <div class="p-4 border-b border-binance-border">
      <button
        @click="toggleCollapse"
        class="w-full flex items-center justify-center p-2 text-binance-gray hover:text-binance-yellow transition-colors rounded-lg hover:bg-trading-elevated"
        :class="isCollapsed ? 'justify-center' : 'justify-end'"
      >
        <svg 
          class="h-5 w-5 transition-transform duration-300"
          :class="isCollapsed ? 'rotate-180' : ''"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <!-- Menu Items -->
    <nav class="p-4 space-y-2">
      <!-- Profile -->
      <router-link
        v-if="walletStore.walletAddress"
        :to="`/profile/${walletStore.walletAddress}`"
        class="sidebar-item"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.profile') }}</span>
      </router-link>

      <!-- Portfolio -->
      <router-link
        to="/portfolio"
        class="sidebar-item"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.portfolio') }}</span>
      </router-link>

      <!-- Settings -->
      <router-link
        to="/settings"
        class="sidebar-item"
        :class="isCollapsed ? 'justify-center' : 'justify-start'"
      >
        <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span v-if="!isCollapsed" class="ml-3 font-medium">{{ t('navigation.settings') }}</span>
      </router-link>


    </nav>
  </div>

  <!-- Overlay for mobile -->
  <div 
    v-if="!isCollapsed && isMobile"
    class="fixed inset-0 bg-black bg-opacity-50 z-30"
    @click="collapseSidebar"
  ></div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTypedI18n } from '@/i18n'
import { useUIStore } from '@/stores/ui'
import { useWalletStore } from '@/stores/wallet'

const { t } = useTypedI18n()
const uiStore = useUIStore()
const walletStore = useWalletStore()

// State
const isMobile = ref(false)

// Computed
const isCollapsed = computed(() => uiStore.isSidebarCollapsed)

// Methods
function toggleCollapse() {
  uiStore.toggleSidebar()
}

function collapseSidebar() {
  if (isMobile.value) {
    uiStore.setSidebarCollapsed(true)
  }
}

function handleResize() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value && !isCollapsed.value) {
    // Auto-collapse on mobile when opening
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
  
  // Sidebar state initialization is now handled globally in App.vue
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.sidebar-item {
  @apply flex items-center p-3 text-binance-gray hover:text-white hover:bg-trading-elevated rounded-lg transition-all duration-200;
}

.sidebar-item.router-link-active {
  @apply text-binance-yellow bg-trading-elevated;
}

/* Smooth transitions */
.transition-all {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .fixed.left-0 {
    z-index: 50;
  }
}
</style> 