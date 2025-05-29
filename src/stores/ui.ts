import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

// Toast notification interface
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  duration?: number
  persistent?: boolean
}

// UI store for managing global UI state
export const useUIStore = defineStore('ui', () => {
  // Loading state for global loading indicators
  const isLoading = ref(false)
  
  // Mobile menu state
  const isMobileMenuOpen = ref(false)
  
  // Modal state
  const activeModal = ref<string | null>(null)
  const modalData = ref<any>(null)
  
  // Toast notifications
  const toasts = ref<Toast[]>([])
  
  // Theme state
  const isDarkMode = ref(false)
  
  // Search state
  const searchQuery = ref('')
  const searchResults = ref<any[]>([])
  const isSearching = ref(false)
  
  // Actions for managing UI state
  
  /**
   * Set global loading state
   * Used during API calls or async operations
   */
  function setLoading(loading: boolean) {
    isLoading.value = loading
  }
  
  /**
   * Toggle mobile menu
   * Used for responsive navigation
   */
  function toggleMobileMenu() {
    isMobileMenuOpen.value = !isMobileMenuOpen.value
  }
  
  /**
   * Close mobile menu
   * Used when navigation occurs
   */
  function closeMobileMenu() {
    isMobileMenuOpen.value = false
  }
  
  /**
   * Show modal with optional data
   * Used for displaying overlays and dialogs
   */
  function showModal(modalName: string, data?: any) {
    activeModal.value = modalName
    modalData.value = data
  }
  
  /**
   * Close active modal
   * Used to hide overlays and dialogs
   */
  function closeModal() {
    activeModal.value = null
    modalData.value = null
  }
  
  /**
   * Show toast notification
   * Used for user feedback and alerts
   */
  function showToast(toast: Omit<Toast, 'id'>) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      persistent: false,
      ...toast
    }
    
    toasts.value.push(newToast)
    
    // Auto-remove toast after duration (unless persistent)
    if (!newToast.persistent && newToast.duration) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }
  
  /**
   * Remove toast by ID
   * Used to dismiss notifications
   */
  function removeToast(id: string) {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }
  
  /**
   * Clear all toasts
   * Used for cleanup
   */
  function clearToasts() {
    toasts.value = []
  }
  
  /**
   * Toggle dark mode
   * Used for theme switching
   */
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
    
    // Update document class for dark mode
    if (typeof document !== 'undefined') {
      if (isDarkMode.value) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      
      // Save preference to localStorage
      localStorage.setItem('darkMode', isDarkMode.value.toString())
    }
  }
  
  /**
   * Initialize dark mode from localStorage
   * Used during app initialization
   */
  function initializeDarkMode() {
    if (typeof window !== 'undefined') {
      const savedDarkMode = localStorage.getItem('darkMode')
      if (savedDarkMode) {
        isDarkMode.value = savedDarkMode === 'true'
      } else {
        // Default to system preference
        isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      }
      
      // Apply dark mode class
      if (isDarkMode.value) {
        document.documentElement.classList.add('dark')
      }
    }
  }
  
  /**
   * Set search query
   * Used for global search functionality
   */
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }
  
  /**
   * Set search loading state
   * Used during search operations
   */
  function setSearching(searching: boolean) {
    isSearching.value = searching
  }
  
  /**
   * Set search results
   * Used to store search results
   */
  function setSearchResults(results: any[]) {
    searchResults.value = results
  }
  
  /**
   * Clear search state
   * Used to reset search
   */
  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    isSearching.value = false
  }
  
  return {
    // State
    isLoading,
    isMobileMenuOpen,
    activeModal,
    modalData,
    toasts,
    isDarkMode,
    searchQuery,
    searchResults,
    isSearching,
    
    // Actions
    setLoading,
    toggleMobileMenu,
    closeMobileMenu,
    showModal,
    closeModal,
    showToast,
    removeToast,
    clearToasts,
    toggleDarkMode,
    initializeDarkMode,
    setSearchQuery,
    setSearching,
    setSearchResults,
    clearSearch
  }
}) 