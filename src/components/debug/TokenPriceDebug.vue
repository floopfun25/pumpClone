<template>
  <div class="bg-gray-100 p-4 rounded-lg my-4">
    <h3 class="text-lg font-bold mb-4">Token Price Debug</h3>
    <div class="flex gap-2 mb-4">
      <button
        @click="debugTokenPrices"
        class="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Debug Token Prices
      </button>
      <button
        @click="fixTokenPrices"
        class="bg-green-500 text-white px-4 py-2 rounded"
      >
        Fix Token Prices
      </button>
      <button
        @click="quickFixDatabase"
        class="bg-red-500 text-white px-4 py-2 rounded"
      >
        Quick DB Fix
      </button>
      <button
        @click="testBondingCurve"
        class="bg-purple-500 text-white px-4 py-2 rounded"
      >
        Test Bonding Curve
      </button>
    </div>

    <div v-if="fixing" class="bg-yellow-100 p-3 rounded mb-4">
      <p>🔧 Fixing token prices...</p>
    </div>

    <div v-if="debugResults" class="space-y-2">
      <div
        v-for="token in debugResults"
        :key="token.id"
        class="bg-white p-3 rounded"
      >
        <p>
          <strong>{{ token.name }} ({{ token.symbol }})</strong>
        </p>
        <p>Mint: {{ token.mint_address }}</p>
        <p>Current Price: {{ token.current_price }}</p>
        <p>Market Cap: {{ token.market_cap }}</p>
        <p>Created: {{ token.created_at }}</p>
        <div
          v-if="bondingCurveResults[token.id]"
          class="mt-2 p-2 bg-blue-50 rounded"
        >
          <p><strong>Bonding Curve:</strong></p>
          <p>
            Calculated Price:
            {{ bondingCurveResults[token.id].currentPrice?.toFixed(8) }}
          </p>
          <p>
            Virtual SOL: {{ bondingCurveResults[token.id].virtualSolReserves }}
          </p>
          <p>
            Virtual Tokens:
            {{ bondingCurveResults[token.id].virtualTokenReserves }}
          </p>
          <p>
            Progress: {{ bondingCurveResults[token.id].progress?.toFixed(2) }}%
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const debugResults = ref<any[]>([]);
const bondingCurveResults = ref<Record<string, any>>({});
const fixing = ref(false);

const debugTokenPrices = async () => {
  try {
    console.log("🔍 Debugging token prices...");

    // TODO: Database operations now handled by Spring Boot backend
    console.log('Operation: Debug token prices - would fetch from backend');
    debugResults.value = [];
  } catch (error) {
    console.error("❌ Debug failed:", error);
  }
};

const testBondingCurve = async () => {
  try {
    console.log("🧮 Testing bonding curve calculations...");
    const { BondingCurveService } = await import("@/services/bondingCurve");

    for (const token of debugResults.value) {
      const state = await BondingCurveService.getTokenBondingCurveState(
        token.id,
      );
      bondingCurveResults.value[token.id] = state;
      console.log(`Bonding curve for ${token.name}:`, state);
    }
  } catch (error) {
    console.error("❌ Bonding curve test failed:", error);
  }
};

const fixTokenPrices = async () => {
  try {
    fixing.value = true;
    console.log("🔧 Fixing token prices...");

    // TODO: Database operations now handled by Spring Boot backend
    console.log('Operation: Fix token prices - would update via backend');

    console.log("✅ Token price fixing completed!");
  } catch (error) {
    console.error("❌ Fix failed:", error);
  } finally {
    fixing.value = false;
  }
};

const quickFixDatabase = async () => {
  try {
    fixing.value = true;
    console.log("🚀 Quick fixing database...");

    // TODO: Database operations now handled by Spring Boot backend
    console.log('Operation: Quick fix database - would update via backend');

    console.log("✅ Quick database fix completed!");
  } catch (error) {
    console.error("❌ Quick fix failed:", error);
  } finally {
    fixing.value = false;
  }
};
</script>
