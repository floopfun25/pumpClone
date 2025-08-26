<template>
  <div
    class="secure-auth-test p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
  >
    <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
      🔐 Secure Authentication Test
    </h2>

    <div class="space-y-4">
      <!-- Current Status -->
      <div class="status-card p-4 rounded-lg border">
        <h3 class="text-lg font-semibold mb-2">Current Status</h3>
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="font-medium">Wallet Connected:</span>
            <span
              :class="
                walletStore.isConnected ? 'text-green-600' : 'text-red-600'
              "
            >
              {{ walletStore.isConnected ? "✅ Yes" : "❌ No" }}
            </span>
          </div>
          <div v-if="walletStore.isConnected" class="flex items-center gap-2">
            <span class="font-medium">Wallet Address:</span>
            <span class="text-sm font-mono">{{
              walletStore.walletAddress
            }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-medium">Authenticated:</span>
            <span
              :class="
                authStore.isAuthenticated ? 'text-green-600' : 'text-red-600'
              "
            >
              {{ authStore.isAuthenticated ? "✅ Yes" : "❌ No" }}
            </span>
          </div>
        </div>
      </div>

      <!-- Test Steps -->
      <div class="test-steps space-y-3">
        <h3 class="text-lg font-semibold">Authentication Test Steps</h3>

        <!-- Step 1: Connect Wallet -->
        <div
          class="step-card p-3 rounded border"
          :class="
            walletStore.isConnected
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          "
        >
          <div class="flex items-center justify-between">
            <span class="font-medium">1. Connect Wallet</span>
            <span v-if="walletStore.isConnected" class="text-green-600"
              >✅</span
            >
          </div>
          <button
            v-if="!walletStore.isConnected"
            @click="connectWallet"
            :disabled="connecting"
            class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {{ connecting ? "Connecting..." : "Connect Wallet" }}
          </button>
        </div>

        <!-- Step 2: Generate Challenge -->
        <div
          class="step-card p-3 rounded border"
          :class="
            challenge
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          "
        >
          <div class="flex items-center justify-between">
            <span class="font-medium"
              >2. Generate Authentication Challenge</span
            >
            <span v-if="challenge" class="text-green-600">✅</span>
          </div>
          <button
            v-if="walletStore.isConnected && !challenge"
            @click="generateChallenge"
            :disabled="generatingChallenge"
            class="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {{ generatingChallenge ? "Generating..." : "Generate Challenge" }}
          </button>
          <div v-if="challenge" class="mt-2 text-sm">
            <div class="font-mono text-xs break-all bg-gray-100 p-2 rounded">
              Challenge: {{ challenge.challenge }}
            </div>
            <div class="text-gray-600 mt-1">
              Expires: {{ new Date(challenge.expiresAt).toLocaleTimeString() }}
            </div>
          </div>
        </div>

        <!-- Step 3: Sign Challenge -->
        <div
          class="step-card p-3 rounded border"
          :class="
            signature
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          "
        >
          <div class="flex items-center justify-between">
            <span class="font-medium">3. Sign Challenge with Wallet</span>
            <span v-if="signature" class="text-green-600">✅</span>
          </div>
          <button
            v-if="challenge && !signature"
            @click="signChallenge"
            :disabled="signing"
            class="mt-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
          >
            {{ signing ? "Signing..." : "Sign Challenge" }}
          </button>
          <div v-if="signature" class="mt-2 text-sm">
            <div class="font-mono text-xs break-all bg-gray-100 p-2 rounded">
              Signature: {{ signatureDisplay }}
            </div>
          </div>
        </div>

        <!-- Step 4: Verify and Authenticate -->
        <div
          class="step-card p-3 rounded border"
          :class="
            authStore.isAuthenticated
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          "
        >
          <div class="flex items-center justify-between">
            <span class="font-medium">4. Verify Signature & Authenticate</span>
            <span v-if="authStore.isAuthenticated" class="text-green-600"
              >✅</span
            >
          </div>
          <button
            v-if="signature && !authStore.isAuthenticated"
            @click="verifyAndAuthenticate"
            :disabled="authenticating"
            class="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {{ authenticating ? "Verifying..." : "Verify & Authenticate" }}
          </button>
        </div>
      </div>

      <!-- Test Full Flow -->
      <div class="full-test mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 class="text-lg font-semibold mb-2">Complete Authentication Test</h3>
        <button
          @click="testFullAuthFlow"
          :disabled="!walletStore.isConnected || testing"
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ testing ? "Testing..." : "Test Complete Secure Auth Flow" }}
        </button>
      </div>

      <!-- Reset -->
      <div class="reset-section mt-4">
        <button
          @click="resetTest"
          class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Reset Test
        </button>
      </div>

      <!-- Logs -->
      <div v-if="logs.length > 0" class="logs-section mt-6">
        <h3 class="text-lg font-semibold mb-2">Test Logs</h3>
        <div
          class="max-h-40 overflow-y-auto bg-black text-green-400 p-4 rounded font-mono text-sm"
        >
          <div v-for="(log, index) in logs" :key="index" class="mb-1">
            [{{ log.timestamp }}] {{ log.message }}
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div
        v-if="error"
        class="error-display mt-4 p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <h4 class="text-red-800 font-semibold">Error:</h4>
        <p class="text-red-700 mt-1">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useWalletStore } from "@/stores/wallet";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import type { AuthChallenge } from "@/services/secureAuth";
import * as bs58 from "bs58";

const walletStore = useWalletStore();
const authStore = useAuthStore();
const uiStore = useUIStore();

// Test state
const challenge = ref<AuthChallenge | null>(null);
const signature = ref<Uint8Array | null>(null);
const connecting = ref(false);
const generatingChallenge = ref(false);
const signing = ref(false);
const authenticating = ref(false);
const testing = ref(false);
const error = ref("");
const logs = ref<Array<{ timestamp: string; message: string }>>([]);

// Computed
const signatureDisplay = computed(() => {
  if (!signature.value) return "";
  const b58 = bs58.encode(signature.value);
  return b58.slice(0, 20) + "..." + b58.slice(-20);
});

// Methods
const log = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  logs.value.push({ timestamp, message });
  console.log(`[SecureAuthTest] ${message}`);
};

const connectWallet = async () => {
  try {
    connecting.value = true;
    error.value = "";
    log("Opening wallet modal...");
    uiStore.showModal("wallet");
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Wallet connection failed";
    log(`Wallet connection error: ${error.value}`);
  } finally {
    connecting.value = false;
  }
};

const generateChallenge = async () => {
  try {
    generatingChallenge.value = true;
    error.value = "";

    if (!walletStore.walletAddress) {
      throw new Error("No wallet address available");
    }

    log("Generating authentication challenge...");
    const { SecureAuthService } = await import("@/services/secureAuth");
    challenge.value = SecureAuthService.generateChallenge(
      walletStore.walletAddress,
    );
    log(`Challenge generated: ${challenge.value.challenge.slice(0, 10)}...`);
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Challenge generation failed";
    log(`Challenge generation error: ${error.value}`);
  } finally {
    generatingChallenge.value = false;
  }
};

const signChallenge = async () => {
  try {
    signing.value = true;
    error.value = "";

    if (!challenge.value || !walletStore.walletAddress) {
      throw new Error("Missing challenge or wallet address");
    }

    log("Requesting wallet signature...");
    signature.value = await walletStore.signAuthChallenge(
      walletStore.walletAddress,
      challenge.value.challenge,
      challenge.value.timestamp,
    );
    log("Signature received from wallet");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Signing failed";
    log(`Signing error: ${error.value}`);
  } finally {
    signing.value = false;
  }
};

const verifyAndAuthenticate = async () => {
  try {
    authenticating.value = true;
    error.value = "";

    if (!challenge.value || !signature.value || !walletStore.walletAddress) {
      throw new Error("Missing required data for verification");
    }

    log("Verifying signature and authenticating...");
    const { SecureAuthService } = await import("@/services/secureAuth");

    const result = await SecureAuthService.verifyAndAuthenticate(
      walletStore.walletAddress,
      signature.value,
      challenge.value.challenge,
      challenge.value.timestamp,
    );

    if (result.success) {
      log("✅ Authentication successful!");
      // Update auth store (this should happen automatically)
    } else {
      throw new Error(result.error || "Authentication failed");
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Authentication failed";
    log(`Authentication error: ${error.value}`);
  } finally {
    authenticating.value = false;
  }
};

const testFullAuthFlow = async () => {
  try {
    testing.value = true;
    error.value = "";

    if (!walletStore.walletAddress) {
      throw new Error("Wallet not connected");
    }

    log("🚀 Starting complete authentication flow...");
    await authStore.signInWithWallet(walletStore.walletAddress);
    log("✅ Complete authentication flow successful!");
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Full auth flow failed";
    log(`Full auth flow error: ${error.value}`);
  } finally {
    testing.value = false;
  }
};

const resetTest = () => {
  challenge.value = null;
  signature.value = null;
  error.value = "";
  logs.value = [];
  log("Test reset");
};
</script>

<style scoped>
.step-card {
  transition: all 0.2s ease;
}

.logs-section {
  font-family: "Courier New", monospace;
}
</style>
