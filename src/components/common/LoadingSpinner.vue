<template>
  <div class="loading-spinner" :class="sizeClass">
    <div class="spinner"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  size?: "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  size: "md",
});

const sizeClass = computed(() => {
  return {
    "spinner-sm": props.size === "sm",
    "spinner-md": props.size === "md",
    "spinner-lg": props.size === "lg",
  };
});
</script>

<style scoped>
.loading-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  border: 2px solid #f3f4f6;
  border-top: 2px solid #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-sm .spinner {
  width: 16px;
  height: 16px;
  border-width: 1px;
}

.spinner-md .spinner {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.spinner-lg .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
