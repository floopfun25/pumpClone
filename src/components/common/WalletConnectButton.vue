<template>
  <button
    @click="handleConnect"
    :disabled="connecting"
    class="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-pump-purple hover:bg-pump-purple/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pump-purple transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <LoadingSpinner v-if="connecting" size="sm" class="mr-2" />
    <Icon v-else name="wallet" class="mr-2" />
    {{ connecting ? "Connecting..." : "Connect Wallet" }}
  </button>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useWalletStore } from "@/stores/wallet";
import Icon from "./Icon.vue";
import LoadingSpinner from "./LoadingSpinner.vue";

const walletStore = useWalletStore();
const connecting = ref(false);

const handleConnect = async () => {
  try {
    connecting.value = true;
    await walletStore.connectWallet();
  } catch (error) {
    console.error("Failed to connect wallet:", error);
  } finally {
    connecting.value = false;
  }
};
</script>
