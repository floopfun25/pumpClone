<template>
  <!-- Main navigation bar with Binance theme -->
  <nav class="nav-binance sticky top-0 z-50">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center h-16">
        <!-- Logo and Brand -->
        <router-link to="/" class="flex items-center space-x-3">
          <div
            class="w-8 h-8 bg-gold-gradient rounded-lg flex items-center justify-center glow-gold"
          >
            <span class="text-binance-dark font-bold text-sm">F</span>
          </div>
          <span class="text-xl font-bold text-white text-shadow">
            {{ t("app.name") }}
          </span>
        </router-link>

        <!-- Search Field -->
        <div class="hidden md:flex flex-1 max-w-lg mx-8">
          <div class="relative w-full">
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('search.placeholder')"
              class="w-full pl-10 pr-4 py-2 border border-binance-border rounded-lg bg-trading-surface text-white focus:ring-2 focus:ring-binance-yellow focus:border-binance-yellow placeholder-binance-gray"
              @keyup.enter="handleSearch"
            />
            <div
              class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            >
              <svg
                class="h-5 w-5 text-binance-gray"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              v-if="searchQuery"
              @click="handleSearch"
              class="absolute inset-y-0 right-0 pr-3 flex items-center text-binance-yellow hover:text-binance-yellow-dark transition-colors"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Desktop Navigation Links -->
        <div class="hidden md:flex items-center space-x-8"></div>

        <!-- Right Side Actions -->
        <div class="flex items-center space-x-4">
          <!-- Create Token Button -->
          <router-link
            to="/create"
            class="hidden md:flex items-center space-x-2 px-4 py-2 bg-binance-yellow hover:bg-binance-yellow-dark text-binance-dark font-semibold rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>{{ t("navigation.create") }}</span>
          </router-link>

          <!-- Wallet Connection Button -->
          <button
            v-if="!isConnected"
            @click="connectWallet"
            class="btn-primary px-6 py-2 font-semibold hidden md:flex"
          >
            {{ t("wallet.connect") }}
          </button>

          <!-- User Menu (when wallet connected) -->
          <div v-else class="relative hidden md:block">
            <button
              @click="toggleUserMenu"
              class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-trading-elevated hover:bg-binance-border/30 transition-colors"
            >
              <div
                class="w-8 h-8 rounded-full bg-gradient-to-br from-binance-yellow to-primary-600 flex items-center justify-center text-black font-bold text-sm"
              >
                {{ walletInitials }}
              </div>
              <span class="text-white font-medium">{{
                shortWalletAddress
              }}</span>
              <svg
                class="w-4 h-4 text-binance-gray"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <!-- User Dropdown Menu -->
            <div
              v-if="showUserMenu"
              class="absolute right-0 mt-2 w-48 bg-trading-surface rounded-lg shadow-xl border border-binance-border py-2"
            >
              <!-- Wallet Balance Display -->
              <div class="px-4 py-3 border-b border-binance-border">
                <div class="text-binance-gray text-xs font-medium mb-1">
                  {{ t("wallet.balance") }}
                </div>
                <div class="text-white font-bold text-lg">{{ balance }}</div>
              </div>

              <router-link
                to="/portfolio"
                class="block px-4 py-2 text-white hover:bg-trading-elevated transition-colors"
                @click="closeUserMenu"
              >
                {{ t("navigation.portfolio") }}
              </router-link>
              <router-link
                to="/settings"
                class="block px-4 py-2 text-white hover:bg-trading-elevated transition-colors"
                @click="closeUserMenu"
              >
                {{ t("navigation.settings") }}
              </router-link>
              <button
                @click="disconnectWallet"
                class="w-full text-left px-4 py-2 text-red-500 hover:bg-trading-elevated transition-colors"
              >
                {{ t("wallet.disconnect") }}
              </button>
            </div>
          </div>

          <!-- Mobile Menu Button -->
          <button
            @click="toggleMobileMenu"
            class="md:hidden p-3 text-binance-gray hover:text-binance-yellow transition-colors rounded-lg hover:bg-trading-elevated"
            :class="{
              'bg-trading-elevated text-binance-yellow': showMobileMenu,
            }"
          >
            <svg
              class="h-6 w-6 transition-transform duration-300"
              :class="{ 'rotate-90': showMobileMenu }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                :d="
                  showMobileMenu
                    ? 'M6 18L18 6M6 6l12 12'
                    : 'M4 6h16M4 12h16M4 18h16'
                "
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Enhanced Mobile Menu -->
    <div
      v-if="showMobileMenu"
      class="md:hidden bg-trading-surface border-t border-binance-border shadow-lg"
    >
      <div class="px-4 py-4 space-y-4">
        <!-- Mobile Search -->
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('search.placeholder')"
            class="w-full pl-12 pr-4 py-3 border border-binance-border rounded-lg bg-trading-elevated text-white focus:ring-2 focus:ring-binance-yellow focus:border-binance-yellow placeholder-binance-gray text-base"
            @keyup.enter="handleSearch"
          />
          <div
            class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"
          >
            <svg
              class="h-5 w-5 text-binance-gray"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <!-- Mobile Create Button -->
        <router-link
          to="/create"
          class="flex items-center justify-center space-x-2 px-4 py-3 bg-binance-yellow hover:bg-binance-yellow-dark text-binance-dark font-semibold rounded-lg transition-colors w-full min-h-[48px]"
          @click="closeMobileMenu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>{{ t("navigation.create") }}</span>
        </router-link>

        <!-- Mobile Wallet Section -->
        <div class="pt-2 border-t border-binance-border">
          <!-- Wallet Connection Button (Mobile) -->
          <button
            v-if="!isConnected"
            @click="connectWallet"
            class="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-trading-elevated hover:bg-binance-border/30 text-white font-semibold rounded-lg transition-colors min-h-[48px]"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>{{ t("wallet.connect") }}</span>
          </button>

          <!-- Mobile Navigation Links (Always Visible) -->
          <div class="space-y-1 mt-4">
            <router-link
              v-if="isConnected"
              to="/portfolio"
              class="flex items-center space-x-3 px-3 py-3 text-white hover:bg-trading-elevated transition-colors rounded-lg min-h-[48px]"
              @click="closeMobileMenu"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <span>{{ t("navigation.portfolio") }}</span>
            </router-link>

            <router-link
              to="/settings"
              class="flex items-center space-x-3 px-3 py-3 text-white hover:bg-trading-elevated transition-colors rounded-lg min-h-[48px]"
              @click="closeMobileMenu"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{{ t("navigation.settings") }}</span>
            </router-link>
          </div>

          <!-- Mobile User Menu (when wallet connected) -->
          <div v-if="isConnected" class="space-y-2 mt-4">
            <!-- User Info -->
            <div
              class="flex items-center space-x-3 p-3 bg-trading-elevated rounded-lg"
            >
              <div
                class="w-10 h-10 rounded-full bg-gradient-to-br from-binance-yellow to-primary-600 flex items-center justify-center text-black font-bold"
              >
                {{ walletInitials }}
              </div>
              <div class="flex-1">
                <div class="text-white font-medium">
                  {{ shortWalletAddress }}
                </div>
                <div class="text-binance-gray text-sm">{{ balance }}</div>
              </div>
            </div>

            <!-- Mobile Navigation Links -->
            <div class="space-y-1">
              <router-link
                to="/portfolio"
                class="flex items-center space-x-3 px-3 py-3 text-white hover:bg-trading-elevated transition-colors rounded-lg min-h-[48px]"
                @click="closeMobileMenu"
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span>{{ t("navigation.portfolio") }}</span>
              </router-link>

              <router-link
                to="/settings"
                class="flex items-center space-x-3 px-3 py-3 text-white hover:bg-trading-elevated transition-colors rounded-lg min-h-[48px]"
                @click="closeMobileMenu"
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{{ t("navigation.settings") }}</span>
              </router-link>

              <button
                @click="disconnectWallet"
                class="w-full flex items-center space-x-3 px-3 py-3 text-red-500 hover:bg-trading-elevated transition-colors rounded-lg min-h-[48px]"
              >
                <svg
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>{{ t("wallet.disconnect") }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>

  <!-- Wallet Selection Modal -->
  <WalletModal
    :is-open="showWalletModal"
    @close="showWalletModal = false"
    @connected="handleWalletConnected"
  />
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useTypedI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { useUIStore } from "@/stores/ui";
import WalletModal from "@/components/common/WalletModal.vue";

// Get composables
const { t } = useTypedI18n();
const router = useRouter();
const authStore = useAuthStore();
const walletStore = useWalletStore();
const uiStore = useUIStore();

// State
const showMobileMenu = ref(false);
const showWalletModal = ref(false);
const showUserMenu = ref(false);
const searchQuery = ref("");

// Computed properties
const isConnected = computed(() => walletStore.isConnected);
const walletAddress = computed(() => walletStore.walletAddress);
const walletAddressFormatted = computed(
  () => walletStore.walletAddressFormatted,
);
const balance = computed(() => walletStore.formattedBalance);
const walletInitials = computed(() => {
  if (!walletAddressFormatted.value) return "W";
  return walletAddressFormatted.value.slice(0, 2).toUpperCase();
});
const shortWalletAddress = computed(() => walletAddressFormatted.value || "");

// Methods
const connectWallet = () => {
  showWalletModal.value = true;
};

const handleWalletConnected = () => {
  showWalletModal.value = false;
};

const disconnectWallet = async () => {
  await walletStore.disconnectWallet();
  showUserMenu.value = false;
};

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value;
};

const closeUserMenu = () => {
  showUserMenu.value = false;
};

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value;
};

const closeMobileMenu = () => {
  showMobileMenu.value = false;
};

// Search functionality
const handleSearch = () => {
  if (!searchQuery.value.trim()) return;

  router.push({
    name: "search",
    query: { q: searchQuery.value.trim() },
  });

  // Clear the search input and close mobile menu
  searchQuery.value = "";
  showMobileMenu.value = false;
};
</script>

<style scoped>
.nav-binance {
  @apply bg-trading-surface border-b border-binance-border;
  backdrop-filter: blur(8px);
}

.glow-gold {
  box-shadow: 0 0 15px rgba(241, 185, 11, 0.3);
}

.text-shadow {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>
