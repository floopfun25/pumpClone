<template>
  <div
    class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 pt-20"
  >
    <div class="container mx-auto px-4 py-8">
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-white mb-2">
          🔧 Configuration Debug
        </h1>
        <p class="text-gray-300">Verify current app configuration</p>
      </div>

      <div class="max-w-4xl mx-auto space-y-6">
        <!-- Environment Variables -->
        <div
          class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
        >
          <h3 class="text-xl font-bold text-white mb-4">
            🌍 Environment Variables
          </h3>
          <div class="space-y-3 font-mono text-sm">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div class="text-gray-300">VITE_SOLANA_NETWORK:</div>
                <div class="text-green-400">
                  {{ envVars.VITE_SOLANA_NETWORK }}
                </div>
              </div>
              <div>
                <div class="text-gray-300">VITE_DEVNET_FEE_WALLET:</div>
                <div class="text-green-400 break-all">
                  {{ envVars.VITE_DEVNET_FEE_WALLET }}
                </div>
              </div>
              <div>
                <div class="text-gray-300">VITE_DEVNET_TREASURY:</div>
                <div class="text-green-400 break-all">
                  {{ envVars.VITE_DEVNET_TREASURY }}
                </div>
              </div>
              <div>
                <div class="text-gray-300">VITE_DEVNET_AUTHORITY:</div>
                <div class="text-green-400 break-all">
                  {{ envVars.VITE_DEVNET_AUTHORITY }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loaded Configuration -->
        <div
          class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
        >
          <h3 class="text-xl font-bold text-white mb-4">
            ⚙️ Loaded Configuration
          </h3>
          <div class="space-y-3 font-mono text-sm">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div class="text-gray-300">Platform Fee Wallet:</div>
                <div class="text-green-400 break-all">
                  {{ config.platform.feeWallet }}
                </div>
              </div>
              <div>
                <div class="text-gray-300">Platform Treasury:</div>
                <div class="text-green-400 break-all">
                  {{ config.platform.treasury }}
                </div>
              </div>
              <div>
                <div class="text-gray-300">Platform Authority:</div>
                <div class="text-green-400 break-all">
                  {{ config.platform.authority }}
                </div>
              </div>
              <div>
                <div class="text-gray-300">Network:</div>
                <div class="text-orange-400">{{ config.solana.network }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Configuration Status -->
        <div
          class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
        >
          <h3 class="text-xl font-bold text-white mb-4">
            ✅ Configuration Status
          </h3>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-300">Using New Fee Wallet:</span>
              <span :class="usingNewWallet ? 'text-green-400' : 'text-red-400'">
                {{ usingNewWallet ? "✅ YES" : "❌ NO" }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-300">Fee Wallet = Treasury:</span>
              <span
                :class="
                  feeWalletSameAsTreasury ? 'text-yellow-400' : 'text-green-400'
                "
              >
                {{
                  feeWalletSameAsTreasury
                    ? "⚠️ SAME (collecting full trade)"
                    : "✅ DIFFERENT"
                }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-300">Environment Loaded:</span>
              <span class="text-green-400"
                >✅ {{ new Date().toLocaleTimeString() }}</span
              >
            </div>
          </div>
        </div>

        <!-- Expected Wallets -->
        <div
          class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
        >
          <h3 class="text-xl font-bold text-white mb-4">
            🎯 Expected Configuration
          </h3>
          <div class="space-y-3 font-mono text-sm">
            <div>
              <div class="text-gray-300">New Fee Wallet (should be used):</div>
              <div class="text-green-400 break-all">
                D45ywEm23MkXT6hLLopWgTmnCoyF2XKooFdGFaF75tWK
              </div>
            </div>
            <div>
              <div class="text-gray-300">
                Old Fee Wallet (should NOT be used):
              </div>
              <div class="text-red-400 break-all">
                J3X42Cu4XAFHjbLYVjDCYXwigegrZkyfDZUtTMxedqkZ
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div
          class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
        >
          <h3 class="text-xl font-bold text-white mb-4">🚀 Quick Actions</h3>
          <div class="flex flex-wrap gap-3">
            <button
              @click="copyConfig"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium transition-colors"
            >
              📋 Copy Configuration
            </button>
            <button
              @click="checkWalletBalances"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium transition-colors"
            >
              💰 Check Wallet Balances
            </button>
            <router-link
              to="/feeWallet"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white font-medium transition-colors inline-block"
            >
              📊 Fee Wallet Monitor
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { solanaConfig, platformConfig } from "@/config";

// Reactive data
const envVars = ref({
  VITE_SOLANA_NETWORK: import.meta.env.VITE_SOLANA_NETWORK,
  VITE_DEVNET_FEE_WALLET: import.meta.env.VITE_DEVNET_FEE_WALLET,
  VITE_DEVNET_TREASURY: import.meta.env.VITE_DEVNET_TREASURY,
  VITE_DEVNET_AUTHORITY: import.meta.env.VITE_DEVNET_AUTHORITY,
  VITE_MAINNET_FEE_WALLET: import.meta.env.VITE_MAINNET_FEE_WALLET,
  VITE_MAINNET_TREASURY: import.meta.env.VITE_MAINNET_TREASURY,
  VITE_MAINNET_AUTHORITY: import.meta.env.VITE_MAINNET_AUTHORITY,
});

const config = ref({
  solana: solanaConfig,
  platform: platformConfig,
});

// Computed properties
const usingNewWallet = computed(() => {
  const newWallet = "D45ywEm23MkXT6hLLopWgTmnCoyF2XKooFdGFaF75tWK";
  return config.value.platform.feeWallet === newWallet;
});

const feeWalletSameAsTreasury = computed(() => {
  return config.value.platform.feeWallet === config.value.platform.treasury;
});

// Methods
const copyConfig = async () => {
  const configText = JSON.stringify(
    {
      environment: envVars.value,
      loaded: config.value,
    },
    null,
    2,
  );

  try {
    await navigator.clipboard.writeText(configText);
    console.log("📋 Configuration copied to clipboard");
  } catch (error) {
    console.error("Failed to copy configuration:", error);
  }
};

const checkWalletBalances = () => {
  console.log("💰 Wallet balance commands:");
  console.log(`solana balance ${config.value.platform.feeWallet} --url devnet`);
  console.log(`solana balance ${config.value.platform.treasury} --url devnet`);
};

onMounted(() => {
  console.log("🔧 Configuration Debug Page loaded");
  console.log("Environment Variables:", envVars.value);
  console.log("Loaded Configuration:", config.value);
});
</script>

<style scoped>
/* Custom styling for better readability */
.break-all {
  word-break: break-all;
}
</style>
