<template>
  <div>
    <slot v-if="!hasError" />
    <div v-else class="error-boundary">
      <div
        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center"
      >
        <div class="text-red-500 text-4xl mb-3">⚠️</div>
        <h3 class="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
          {{ title || "Something went wrong" }}
        </h3>
        <p class="text-red-600 dark:text-red-300 mb-4 text-sm">
          {{
            message ||
            "This component encountered an error and couldn't be displayed properly."
          }}
        </p>

        <!-- Development Mode Error Details -->
        <div
          v-if="isDev && errorDetails"
          class="mt-4 p-3 bg-red-100 dark:bg-red-900/40 rounded border text-left"
        >
          <details>
            <summary
              class="cursor-pointer text-sm font-medium text-red-700 dark:text-red-200 mb-2"
            >
              Error Details (Development Mode)
            </summary>
            <pre class="text-xs text-red-600 dark:text-red-300 overflow-auto">{{
              errorDetails
            }}</pre>
          </details>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2 justify-center mt-4">
          <button
            @click="retry"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            v-if="showReload"
            @click="reloadPage"
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>

        <!-- Fallback Content -->
        <div
          v-if="$slots.fallback"
          class="mt-6 pt-4 border-t border-red-200 dark:border-red-700"
        >
          <slot name="fallback" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, computed, watch } from "vue";

interface Props {
  title?: string;
  message?: string;
  showReload?: boolean;
  resetOnPropsChange?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showReload: false,
  resetOnPropsChange: true,
});

const emit = defineEmits<{
  error: [error: Error];
  retry: [];
}>();

// State
const hasError = ref(false);
const errorDetails = ref<string>("");
const retryCount = ref(0);

// Computed
const isDev = computed(() => import.meta.env.DEV);

// Error capture
onErrorCaptured((error: Error, instance: any, info: string) => {
  console.error("ErrorBoundary caught error:", error);
  console.error("Component instance:", instance);
  console.error("Error info:", info);

  hasError.value = true;
  errorDetails.value = `${error.message}\n\nStack:\n${error.stack}\n\nComponent Info:\n${info}`;

  emit("error", error);

  // Return false to prevent the error from propagating further
  return false;
});

// Methods
const retry = () => {
  hasError.value = false;
  errorDetails.value = "";
  retryCount.value++;
  emit("retry");
};

const reloadPage = () => {
  window.location.reload();
};

// Reset error state when props change (if enabled)
if (props.resetOnPropsChange) {
  // Watch for any prop changes and reset error state
  const propsWatcher = () => {
    if (hasError.value) {
      hasError.value = false;
      errorDetails.value = "";
    }
  };

  // This is a simple way to watch all props
  // In a more complex scenario, you might want to watch specific props
  Object.keys(props).forEach((key) => {
    if (key !== "resetOnPropsChange") {
      watch(() => (props as any)[key], propsWatcher);
    }
  });
}
</script>

<style scoped>
.error-boundary {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ensure pre text doesn't break layout */
pre {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
}

/* Loading animation for retry */
.error-boundary button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
