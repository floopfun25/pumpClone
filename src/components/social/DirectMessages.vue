<template>
  <div class="direct-messages">
    <!-- DM Button Trigger -->
    <button
      v-if="!isOpen"
      @click="openDM"
      :class="[
        'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
        buttonClass || 'bg-primary-500 hover:bg-primary-600 text-white'
      ]"
    >
      <span class="text-lg">💬</span>
      <span>{{ buttonText }}</span>
      <span v-if="unreadCount > 0" class="bg-red-500 text-white text-xs rounded-full px-2 py-1 ml-1">
        {{ unreadCount }}
      </span>
    </button>

    <!-- DM Panel -->
    <div 
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="closeDM"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[600px] mx-4 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">💬 Direct Messages</h2>
            <span v-if="unreadCount > 0" class="bg-red-500 text-white text-xs rounded-full px-2 py-1">
              {{ unreadCount }} new
            </span>
          </div>
          <button 
            @click="closeDM"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>

        <div class="flex h-[536px]">
          <!-- Conversations List -->
          <div class="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <!-- Search & New Chat -->
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <div class="flex gap-2 mb-3">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search conversations..."
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  @click="showNewChat = true"
                  class="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  title="New Chat"
                >
                  ➕
                </button>
              </div>
            </div>

            <!-- Conversations -->
            <div class="flex-1 overflow-y-auto">
              <div v-if="filteredConversations.length === 0" class="p-4 text-center text-gray-500 dark:text-gray-400">
                {{ searchQuery ? 'No conversations found' : 'No messages yet' }}
              </div>
              
              <div
                v-for="conversation in filteredConversations"
                :key="conversation.id"
                @click="selectConversation(conversation)"
                :class="[
                  'p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  selectedConversation?.id === conversation.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                ]"
              >
                <div class="flex items-center gap-3">
                  <!-- User Avatar -->
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold">
                    {{ conversation.otherUser.username.slice(0, 2).toUpperCase() }}
                  </div>
                  
                  <!-- Conversation Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <h3 class="font-medium text-gray-900 dark:text-white truncate">
                        {{ conversation.otherUser.username }}
                      </h3>
                      <span class="text-xs text-gray-500 dark:text-gray-400">
                        {{ conversation.lastMessage?.created_at ? formatTime(conversation.lastMessage.created_at) : '' }}
                      </span>
                    </div>
                    
                    <p class="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                      {{ conversation.lastMessage?.content || 'No messages yet' }}
                    </p>
                    
                    <div v-if="conversation.unreadCount > 0" class="mt-1">
                      <span class="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                        {{ conversation.unreadCount }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Chat Area -->
          <div class="flex-1 flex flex-col">
            <!-- No Conversation Selected -->
            <div v-if="!selectedConversation" class="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div class="text-center">
                <div class="text-6xl mb-4">💬</div>
                <h3 class="text-lg font-medium mb-2">Select a conversation</h3>
                <p class="text-sm">Choose a conversation from the left to start messaging</p>
              </div>
            </div>

            <!-- Active Conversation -->
            <div v-else class="flex flex-col h-full">
              <!-- Chat Header -->
              <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    {{ selectedConversation.otherUser.username.slice(0, 2).toUpperCase() }}
                  </div>
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">
                      {{ selectedConversation.otherUser.username }}
                    </h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ selectedConversation.otherUser.wallet_address.slice(0, 8) }}...
                    </p>
                  </div>
                </div>
              </div>

              <!-- Messages -->
              <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
                <div v-if="messages.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
                  Start the conversation! 👋
                </div>
                
                <div
                  v-for="message in messages"
                  :key="message.id"
                  :class="[
                    'flex',
                    message.sender_id === authStore.user?.id ? 'justify-end' : 'justify-start'
                  ]"
                >
                  <div
                    :class="[
                      'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                      message.sender_id === authStore.user?.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    ]"
                  >
                    <p class="text-sm">{{ message.content }}</p>
                    <p class="text-xs mt-1 opacity-70">
                      {{ formatTime(message.created_at) }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Message Input -->
              <div class="p-4 border-t border-gray-200 dark:border-gray-700">
                <form @submit.prevent="sendMessage" class="flex gap-3">
                  <input
                    v-model="newMessage"
                    type="text"
                    placeholder="Type a message..."
                    class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    :disabled="sending"
                  />
                  <button
                    type="submit"
                    :disabled="!newMessage.trim() || sending"
                    class="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <span v-if="sending">⏳</span>
                    <span v-else>📤</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Chat Modal -->
    <div 
      v-if="showNewChat"
      class="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50"
      @click.self="showNewChat = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Start New Conversation</h3>
        
        <form @submit.prevent="startNewChat">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              User Address or Username
            </label>
            <input
              v-model="newChatTarget"
              type="text"
              placeholder="Enter wallet address or username..."
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          
          <div class="flex gap-3 justify-end">
            <button
              type="button"
              @click="showNewChat = false"
              class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              :disabled="!newChatTarget.trim()"
            >
              Start Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { SupabaseService } from '@/services/supabase'

interface Message {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  conversation_id: string
  created_at: string
  read: boolean
}

interface Conversation {
  id: string
  otherUser: {
    id: string
    username: string
    wallet_address: string
  }
  lastMessage?: Message
  unreadCount: number
}

// Props
interface Props {
  buttonText?: string
  buttonClass?: string
  recipientAddress?: string // Auto-open DM with specific user
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: 'Message'
})

// Store
const authStore = useAuthStore()

// State
const isOpen = ref(false)
const conversations = ref<Conversation[]>([])
const selectedConversation = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const newMessage = ref('')
const sending = ref(false)
const searchQuery = ref('')
const showNewChat = ref(false)
const newChatTarget = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// Computed
const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value
  
  return conversations.value.filter(conv =>
    conv.otherUser.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    conv.otherUser.wallet_address.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const unreadCount = computed(() => {
  return conversations.value.reduce((total, conv) => total + conv.unreadCount, 0)
})

// Methods
const openDM = async () => {
  if (!authStore.isAuthenticated) {
    // Show connect wallet prompt
    return
  }
  
  isOpen.value = true
  await loadConversations()
  
  // Auto-open conversation with specific recipient if provided
  if (props.recipientAddress && props.recipientAddress.trim()) {
    await findOrCreateConversation(props.recipientAddress)
  }
}

const closeDM = () => {
  isOpen.value = false
  selectedConversation.value = null
  messages.value = []
  searchQuery.value = ''
  showNewChat.value = false
}

const loadConversations = async () => {
  try {
    const result = await SupabaseService.getUserConversations(authStore.user!.id)
    conversations.value = result
  } catch (error) {
    console.error('Failed to load conversations:', error)
  }
}

const selectConversation = async (conversation: Conversation) => {
  selectedConversation.value = conversation
  await loadMessages(conversation.id)
  
  // Mark conversation as read
  conversation.unreadCount = 0
  await SupabaseService.markConversationAsRead(conversation.id, authStore.user!.id)
  
  // Scroll to bottom
  nextTick(() => {
    scrollToBottom()
  })
}

const loadMessages = async (conversationId: string) => {
  try {
    messages.value = await SupabaseService.getConversationMessages(conversationId)
  } catch (error) {
    console.error('Failed to load messages:', error)
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConversation.value || sending.value) return
  
  sending.value = true
  
  try {
    const message = await SupabaseService.sendMessage({
      conversation_id: selectedConversation.value.id,
      sender_id: authStore.user!.id,
      receiver_id: selectedConversation.value.otherUser.id,
      content: newMessage.value.trim()
    })
    
    messages.value.push(message)
    newMessage.value = ''
    
    // Update conversation's last message
    selectedConversation.value.lastMessage = message
    
    // Scroll to bottom
    nextTick(() => {
      scrollToBottom()
    })
    
  } catch (error) {
    console.error('Failed to send message:', error)
  } finally {
    sending.value = false
  }
}

const startNewChat = async () => {
  try {
    const conversation = await findOrCreateConversation(newChatTarget.value.trim())
    if (conversation) {
      showNewChat.value = false
      newChatTarget.value = ''
      await selectConversation(conversation)
    }
  } catch (error) {
    console.error('Failed to start new chat:', error)
  }
}

const findOrCreateConversation = async (target: string): Promise<Conversation | null> => {
  try {
    // First try to find user by username or wallet address
    const user = await SupabaseService.findUserByIdentifier(target)
    if (!user) {
      throw new Error('User not found')
    }
    
    // Check if conversation already exists
    let conversation = conversations.value.find(conv => conv.otherUser.id === user.id)
    
    if (!conversation) {
      // Create new conversation
      const newConversation = await SupabaseService.createConversation(authStore.user!.id, user.id)
      if (newConversation) {
        conversation = newConversation
        conversations.value.unshift(conversation)
      }
    }
    
    return conversation || null
  } catch (error) {
    console.error('Failed to find or create conversation:', error)
    return null
  }
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  if (diffInHours < 1) {
    return 'Just now'
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`
  } else if (diffInHours < 48) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString()
  }
}

// Auto-scroll when new messages arrive
watch(() => messages.value.length, () => {
  nextTick(() => {
    scrollToBottom()
  })
})

// Periodically check for new messages
let messageInterval: NodeJS.Timeout | null = null

watch(isOpen, (open) => {
  if (open) {
    // Check for new messages every 5 seconds
    messageInterval = setInterval(() => {
      if (selectedConversation.value) {
        loadMessages(selectedConversation.value.id)
      }
      loadConversations()
    }, 5000)
  } else {
    if (messageInterval) {
      clearInterval(messageInterval)
      messageInterval = null
    }
  }
})
</script>

<style scoped>
/* Custom scrollbar for messages */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.7);
}
</style> 