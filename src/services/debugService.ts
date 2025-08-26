import { ref } from "vue";

interface DebugState {
  isVisible: boolean;
  debugText: string;
  title: string;
}

const debugState = ref<DebugState>({
  isVisible: false,
  debugText: "",
  title: "Debug Information",
});

export const useDebugService = () => {
  const showDebugModal = (text: string, title?: string) => {
    debugState.value.debugText = text;
    debugState.value.title = title || "Debug Information";
    debugState.value.isVisible = true;
  };

  const hideDebugModal = () => {
    debugState.value.isVisible = false;
    debugState.value.debugText = "";
  };

  const isDebugVisible = () => debugState.value.isVisible;

  return {
    debugState,
    showDebugModal,
    hideDebugModal,
    isDebugVisible,
  };
};

// Global debug function to replace alert()
export const showDebug = (text: string, title?: string) => {
  const { showDebugModal } = useDebugService();
  showDebugModal(text, title);
};
