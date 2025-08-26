<template>
  <!-- Global loading overlay -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm mx-4"
    >
      <!-- Loading Spinner -->
      <div class="flex flex-col items-center space-y-4">
        <div class="relative">
          <!-- Outer spinning ring -->
          <div
            class="w-16 h-16 border-4 border-gray-200 dark:border-gray-600 rounded-full animate-spin border-t-primary-500"
          ></div>

          <!-- Inner pulsing dot -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="w-4 h-4 bg-primary-500 rounded-full animate-pulse"
            ></div>
          </div>
        </div>

        <!-- Loading Text -->
        <div class="text-center">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Loading...
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Please wait while we process your request
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// No additional logic needed for basic loading overlay
</script>

<style scoped>
/* Custom loading animations */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

/* Ensure overlay is above everything */
.fixed {
  z-index: 9999;
}
</style>
