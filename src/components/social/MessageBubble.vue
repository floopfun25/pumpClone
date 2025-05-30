<template>
  <div 
    class="flex mb-4"
    :class="{ 'justify-end': isOwnMessage, 'justify-start': !isOwnMessage }"
  >
    <div 
      class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg"
      :class="messageClasses"
    >
      <!-- Message Header -->
      <div v-if="!isOwnMessage" class="flex items-center mb-1">
        <img 
          :src="message.user?.avatar || '/default-avatar.png'" 
          :alt="message.user?.username"
          class="w-4 h-4 rounded-full mr-2"
        />
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">
          {{ message.user?.username || 'Anonymous' }}
        </span>
      </div>
      
      <!-- Message Content -->
      <div class="text-sm">
        {{ message.content }}
      </div>
      
      <!-- Message Footer -->
      <div class="flex items-center justify-between mt-1">
        <span class="text-xs opacity-75">
          {{ formatTimestamp(message.timestamp) }}
        </span>
        
        <!-- Message Status (for own messages) -->
        <div v-if="isOwnMessage" class="flex items-center">
          <Icon 
            :name="message.status === 'sent' ? 'check' : message.status === 'delivered' ? 'check-double' : 'clock'"
            class="w-3 h-3 opacity-75"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/common/Icon.vue'

interface User {
  id: string
  username: string
  avatar?: string
  walletAddress: string
}

interface Message {
  id: string
  content: string
  timestamp: Date
  user: User
  status?: 'sending' | 'sent' | 'delivered' | 'read'
}

interface Props {
  message: Message
  currentUserId: string
}

const props = defineProps<Props>()

// Computed
const isOwnMessage = computed(() => props.message.user.id === props.currentUserId)

const messageClasses = computed(() => {
  if (isOwnMessage.value) {
    return 'bg-pump-purple text-white'
  } else {
    return 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
  }
})

// Methods
const formatTimestamp = (timestamp: Date): string => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  
  if (diff < 60000) { // Less than 1 minute
    return 'now'
  } else if (diff < 3600000) { // Less than 1 hour
    return `${Math.floor(diff / 60000)}m`
  } else if (diff < 86400000) { // Less than 1 day
    return `${Math.floor(diff / 3600000)}h`
  } else {
    return timestamp.toLocaleDateString()
  }
}
</script> 