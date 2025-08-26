import { defineStore } from "pinia";
import { ref, reactive } from "vue";

// Toast notification interface
export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
}

// UI store for managing global UI state
export const useUIStore = defineStore("ui", () => {
  // Loading state for global loading indicators
  const isLoading = ref(false);

  // Mobile menu state
  const isMobileMenuOpen = ref(false);

  // Modal state
  const activeModal = ref<string | null>(null);
  const modalData = ref<any>(null);

  // Toast notifications
  const toasts = ref<Toast[]>([]);

  // Theme state - default to dark mode (Binance style)
  const isDarkMode = ref(true);

  // Sidebar state
  const isSidebarCollapsed = ref(true);

  // Search state
  const searchQuery = ref("");
  const searchResults = ref<any[]>([]);
  const isSearching = ref(false);

  // Actions for managing UI state

  /**
   * Set global loading state
   * Used during API calls or async operations
   */
  function setLoading(loading: boolean) {
    isLoading.value = loading;
  }

  /**
   * Toggle mobile menu
   * Used for responsive navigation
   */
  function toggleMobileMenu() {
    isMobileMenuOpen.value = !isMobileMenuOpen.value;
  }

  /**
   * Close mobile menu
   * Used when navigation occurs
   */
  function closeMobileMenu() {
    isMobileMenuOpen.value = false;
  }

  /**
   * Show modal with optional data
   * Used for displaying overlays and dialogs
   */
  function showModal(modalName: string, data?: any) {
    activeModal.value = modalName;
    modalData.value = data;
  }

  /**
   * Close active modal
   * Used to hide overlays and dialogs
   */
  function closeModal() {
    activeModal.value = null;
    modalData.value = null;
  }

  /**
   * Show toast notification
   * Used for user feedback and alerts
   */
  function showToast(toast: Omit<Toast, "id">) {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 5000,
      persistent: false,
      ...toast,
    };

    toasts.value.push(newToast);

    // Auto-remove toast after duration (unless persistent)
    if (!newToast.persistent && newToast.duration) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }

  /**
   * Remove toast by ID
   * Used to dismiss notifications
   */
  function removeToast(id: string) {
    const index = toasts.value.findIndex((toast) => toast.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  }

  /**
   * Clear all toasts
   * Used for cleanup
   */
  function clearToasts() {
    toasts.value = [];
  }

  /**
   * Toggle between dark and light theme
   * Used for theme switching
   */
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
    applyTheme();
  }

  /**
   * Set theme explicitly
   * Used to force a specific theme
   */
  function setTheme(darkMode: boolean) {
    isDarkMode.value = darkMode;
    applyTheme();
  }

  /**
   * Apply theme to document and save preference
   * Internal function for theme management
   */
  function applyTheme() {
    if (typeof document !== "undefined") {
      const htmlElement = document.documentElement;

      if (isDarkMode.value) {
        // Apply dark mode (Binance default)
        htmlElement.classList.add("dark");
        htmlElement.classList.remove("light");
        document.body.style.backgroundColor = "#0b0e11";
      } else {
        // Apply light mode
        htmlElement.classList.remove("dark");
        htmlElement.classList.add("light");
        document.body.style.backgroundColor = "#f5f5f5";
      }

      // Save preference to localStorage
      localStorage.setItem(
        "floppfun-theme",
        isDarkMode.value ? "dark" : "light",
      );
    }
  }

  /**
   * Initialize theme from localStorage or default to dark
   * Used during app initialization
   */
  function initializeTheme() {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("floppfun-theme");

      if (savedTheme) {
        // Use saved preference
        isDarkMode.value = savedTheme === "dark";
      } else {
        // Default to dark mode (Binance style)
        isDarkMode.value = true;
      }

      // Apply the theme
      applyTheme();
    }
  }

  /**
   * Set search query
   * Used for global search functionality
   */
  function setSearchQuery(query: string) {
    searchQuery.value = query;
  }

  /**
   * Set search loading state
   * Used during search operations
   */
  function setSearching(searching: boolean) {
    isSearching.value = searching;
  }

  /**
   * Set search results
   * Used to store search results
   */
  function setSearchResults(results: any[]) {
    searchResults.value = results;
  }

  /**
   * Clear search results and query
   * Used to reset search state
   */
  function clearSearch() {
    searchQuery.value = "";
    searchResults.value = [];
    isSearching.value = false;
  }

  /**
   * Toggle sidebar collapsed state
   * Used for sidebar navigation
   */
  function toggleSidebar() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value;
    saveSidebarState();
  }

  /**
   * Set sidebar collapsed state
   * Used to force sidebar state
   */
  function setSidebarCollapsed(collapsed: boolean) {
    isSidebarCollapsed.value = collapsed;
    saveSidebarState();
  }

  /**
   * Save sidebar state to localStorage
   * Internal function for persistence
   */
  function saveSidebarState() {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "floppfun-sidebar-collapsed",
        JSON.stringify(isSidebarCollapsed.value),
      );
    }
  }

  /**
   * Initialize sidebar state from localStorage
   * Used during app initialization
   */
  function initializeSidebar() {
    if (typeof window !== "undefined") {
      const savedState = localStorage.getItem("floppfun-sidebar-collapsed");

      if (savedState !== null) {
        isSidebarCollapsed.value = JSON.parse(savedState);
      } else {
        // Default to collapsed
        isSidebarCollapsed.value = true;
      }
    }
  }

  return {
    // State
    isLoading,
    isMobileMenuOpen,
    activeModal,
    modalData,
    toasts,
    isDarkMode,
    isSidebarCollapsed,
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
    setTheme,
    initializeTheme,
    setSearchQuery,
    setSearching,
    setSearchResults,
    clearSearch,
    toggleSidebar,
    setSidebarCollapsed,
    initializeSidebar,
  };
});
