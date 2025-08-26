<template>
  <div
    v-if="isVisible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
  >
    <div
      class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
    >
      <div
        class="bg-red-600 text-white px-4 py-3 flex justify-between items-center"
      >
        <h3 class="text-lg font-semibold">Debug Information</h3>
        <button @click="close" class="text-white hover:text-gray-200 text-xl">
          &times;
        </button>
      </div>

      <div class="p-4 overflow-y-auto max-h-[60vh]">
        <pre
          class="text-sm text-gray-800 whitespace-pre-wrap font-mono select-all bg-gray-50 p-3 rounded border"
          >{{ debugText }}</pre
        >
      </div>

      <div class="bg-gray-50 px-4 py-3 flex gap-2">
        <button
          @click="copyToClipboard"
          class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          {{ copyButtonText }}
        </button>
        <button
          @click="close"
          class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

interface Props {
  isVisible: boolean;
  debugText: string;
  title?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
}>();

const copyButtonText = ref("Copy Debug Info");

const close = () => {
  emit("close");
};

const copyToClipboard = async () => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Use modern clipboard API
      await navigator.clipboard.writeText(props.debugText);
      copyButtonText.value = "Copied!";
      setTimeout(() => {
        copyButtonText.value = "Copy Debug Info";
      }, 2000);
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement("textarea");
      textArea.value = props.debugText;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
        copyButtonText.value = "Copied!";
        setTimeout(() => {
          copyButtonText.value = "Copy Debug Info";
        }, 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
        copyButtonText.value = "Copy Failed";
        setTimeout(() => {
          copyButtonText.value = "Copy Debug Info";
        }, 2000);
      }

      document.body.removeChild(textArea);
    }
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    copyButtonText.value = "Copy Failed";
    setTimeout(() => {
      copyButtonText.value = "Copy Debug Info";
    }, 2000);
  }
};

// Reset copy button text when modal closes
watch(
  () => props.isVisible,
  (newVal) => {
    if (!newVal) {
      copyButtonText.value = "Copy Debug Info";
    }
  },
);
</script>
