<template>
  <div
    class="flex flex-col h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
  >
    <!-- Chat Header -->
    <div
      class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-center">
        <img
          :src="participant?.avatar || '/default-avatar.png'"
          :alt="participant?.username"
          class="w-8 h-8 rounded-full mr-3"
        />
        <div>
          <h3 class="font-medium text-gray-900 dark:text-white">
            {{ participant?.username || "Unknown User" }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{
              participant?.walletAddress &&
              formatWalletAddress(participant.walletAddress)
            }}
          </p>
        </div>
      </div>

      <!-- Chat Actions -->
      <div class="flex items-center gap-2">
        <button
          @click="$emit('minimize')"
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Icon name="minus" class="w-4 h-4" />
        </button>
        <button
          @click="$emit('close')"
          class="p-2 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Icon name="x" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Messages Container -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-2 max-h-96"
    >
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
        <span class="ml-2 text-sm text-gray-500 dark:text-gray-400"
          >Loading messages...</span
        >
      </div>

      <!-- Messages -->
      <MessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :current-user-id="currentUserId"
      />

      <!-- Empty State -->
      <div v-if="!loading && messages.length === 0" class="text-center py-8">
        <Icon
          name="message-circle"
          class="w-12 h-12 text-gray-400 mx-auto mb-2"
        />
        <p class="text-sm text-gray-500 dark:text-gray-400">No messages yet</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          Send a message to start the conversation
        </p>
      </div>
    </div>

    <!-- Message Input -->
    <div class="p-4 border-t border-gray-200 dark:border-gray-700">
      <form @submit.prevent="sendMessage" class="flex items-center gap-2">
        <input
          v-model="newMessage"
          type="text"
          placeholder="Type a message..."
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pump-purple focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          :disabled="sending"
          maxlength="500"
        />
        <button
          type="submit"
          :disabled="!newMessage.trim() || sending"
          class="px-4 py-2 bg-pump-purple text-white rounded-lg hover:bg-pump-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Icon v-if="sending" name="spinner" class="w-4 h-4 animate-spin" />
          <Icon v-else name="send" class="w-4 h-4" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import MessageBubble from "./MessageBubble.vue";
import Icon from "@/components/common/Icon.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

interface User {
  id: string;
  username: string;
  avatar?: string;
  walletAddress: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  user: User;
  status?: "sending" | "sent" | "delivered" | "read";
}

interface Props {
  participant: User;
  currentUserId: string;
  conversationId?: string;
}

const props = defineProps<Props>();

defineEmits<{
  close: [];
  minimize: [];
  messagesSent: [count: number];
}>();

// Reactive state
const messages = ref<Message[]>([]);
const newMessage = ref("");
const loading = ref(false);
const sending = ref(false);
const messagesContainer = ref<HTMLElement>();

// Methods
const formatWalletAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const loadMessages = async () => {
  loading.value = true;
  try {
    // Mock loading messages - would integrate with Supabase real-time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock messages for demo
    messages.value = [
      {
        id: "1",
        content: "Hey! Saw your token launch, looks promising! 🚀",
        timestamp: new Date(Date.now() - 3600000),
        user: props.participant,
      },
      {
        id: "2",
        content:
          "Thanks! Been working on it for weeks. What do you think of the tokenomics?",
        timestamp: new Date(Date.now() - 3400000),
        user: { id: props.currentUserId, username: "You", walletAddress: "" },
      },
      {
        id: "3",
        content: "The bonding curve looks solid. Might ape in 😎",
        timestamp: new Date(Date.now() - 3000000),
        user: props.participant,
      },
    ];
  } catch (error) {
    console.error("Failed to load messages:", error);
  } finally {
    loading.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || sending.value) return;

  const messageContent = newMessage.value.trim();
  newMessage.value = "";
  sending.value = true;

  try {
    // Create optimistic message
    const optimisticMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      timestamp: new Date(),
      user: { id: props.currentUserId, username: "You", walletAddress: "" },
      status: "sending",
    };

    messages.value.push(optimisticMessage);
    scrollToBottom();

    // Mock sending message - would integrate with Supabase
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update message status
    const sentMessage = messages.value.find(
      (m) => m.id === optimisticMessage.id,
    );
    if (sentMessage) {
      sentMessage.status = "sent";
    }
  } catch (error) {
    console.error("Failed to send message:", error);
    // Remove failed message
    messages.value = messages.value.filter(
      (m) => m.id !== Date.now().toString(),
    );
  } finally {
    sending.value = false;
  }
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Watchers
watch(
  () => messages.value.length,
  () => {
    scrollToBottom();
  },
);

// Lifecycle
onMounted(() => {
  loadMessages();
});
</script>
