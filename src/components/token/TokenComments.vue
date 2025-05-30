<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
        Comments ({{ comments.length }})
      </h3>
      <button 
        @click="refreshComments" 
        class="text-primary-600 hover:text-primary-700 text-sm"
        :disabled="loading"
      >
        🔄 Refresh
      </button>
    </div>

    <!-- Comment Input -->
    <div v-if="isConnected" class="mb-6">
      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
          {{ userInitials }}
        </div>
        <div class="flex-1">
          <textarea
            v-model="newComment"
            @keydown.enter.ctrl="postComment"
            placeholder="Share your thoughts... (Ctrl+Enter to post)"
            class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows="3"
            maxlength="500"
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-gray-500">{{ newComment.length }}/500</span>
            <button 
              @click="postComment"
              :disabled="!newComment.trim() || posting"
              class="btn-primary text-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ posting ? 'Posting...' : 'Post' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Connect Wallet Message -->
    <div v-else class="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-center">
      <p class="text-gray-600 dark:text-gray-400 mb-2">Connect your wallet to join the conversation</p>
      <button @click="$emit('connect-wallet')" class="btn-primary text-sm">
        Connect Wallet
      </button>
    </div>

    <!-- Comments List -->
    <div class="space-y-4 max-h-96 overflow-y-auto">
      <div v-if="loading && comments.length === 0" class="flex justify-center py-8">
        <div class="spinner w-6 h-6"></div>
      </div>

      <div v-else-if="comments.length === 0" class="text-center py-8">
        <div class="text-4xl mb-2">💬</div>
        <p class="text-gray-500 dark:text-gray-400">No comments yet. Be the first to share your thoughts!</p>
      </div>

      <div v-else>
        <div 
          v-for="comment in comments" 
          :key="comment.id"
          class="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <!-- User Avatar -->
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {{ getUserInitials(comment.user) }}
          </div>

          <!-- Comment Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-1">
              <span class="font-medium text-gray-900 dark:text-white text-sm">
                {{ comment.user?.username || formatAddress(comment.user?.wallet_address) }}
              </span>
              <span class="text-xs text-gray-500">
                {{ formatTimeAgo(comment.created_at) }}
              </span>
              <span v-if="comment.user?.wallet_address === tokenCreator" class="px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 text-xs rounded-full">
                Creator
              </span>
            </div>
            <p class="text-gray-700 dark:text-gray-300 text-sm break-words">
              {{ comment.content }}
            </p>
            <div class="flex items-center space-x-4 mt-2">
              <button 
                @click="toggleLike(comment)"
                :class="[
                  'flex items-center space-x-1 text-xs',
                  comment.user_liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                ]"
              >
                <span>{{ comment.user_liked ? '❤️' : '🤍' }}</span>
                <span>{{ comment.likes_count || 0 }}</span>
              </button>
              <button 
                @click="replyTo(comment)"
                class="text-xs text-gray-500 hover:text-primary-500"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Load More Button -->
    <div v-if="hasMore" class="mt-4 text-center">
      <button 
        @click="loadMoreComments"
        :disabled="loading"
        class="text-primary-600 hover:text-primary-700 text-sm"
      >
        {{ loading ? 'Loading...' : 'Load More Comments' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { SupabaseService } from '@/services/supabase'
import { useUIStore } from '@/stores/ui'

interface Comment {
  id: string
  content: string
  created_at: string
  user: {
    id: string
    username?: string
    wallet_address: string
  }
  likes_count: number
  user_liked: boolean
}

// Props
interface Props {
  tokenId: string
  tokenCreator?: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'connect-wallet': []
}>()

// Stores
const walletStore = useWalletStore()
const uiStore = useUIStore()

// State
const comments = ref<Comment[]>([])
const newComment = ref('')
const loading = ref(false)
const posting = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

// Computed
const isConnected = computed(() => walletStore.isConnected)
const userInitials = computed(() => {
  const address = walletStore.walletAddress
  return address ? address.slice(0, 2).toUpperCase() : 'U'
})

// Methods
const loadComments = async (reset = false) => {
  if (loading.value) return
  
  loading.value = true
  
  try {
    if (reset) {
      page.value = 1
      comments.value = []
    }
    
    const result = await SupabaseService.getTokenComments(props.tokenId, page.value, pageSize)
    
    if (reset) {
      comments.value = result.comments
    } else {
      comments.value.push(...result.comments)
    }
    
    hasMore.value = result.hasMore
    
  } catch (error) {
    console.error('Failed to load comments:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Error',
      message: 'Failed to load comments'
    })
  } finally {
    loading.value = false
  }
}

const postComment = async () => {
  if (!newComment.value.trim() || posting.value || !isConnected.value) return
  
  posting.value = true
  
  try {
    const comment = await SupabaseService.createTokenComment(
      props.tokenId,
      newComment.value.trim()
    )
    
    // Add to beginning of comments list
    comments.value.unshift(comment)
    newComment.value = ''
    
    uiStore.showToast({
      type: 'success',
      title: 'Comment Posted',
      message: 'Your comment has been posted successfully'
    })
    
  } catch (error) {
    console.error('Failed to post comment:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Error',
      message: 'Failed to post comment'
    })
  } finally {
    posting.value = false
  }
}

const toggleLike = async (comment: Comment) => {
  if (!isConnected.value) {
    emit('connect-wallet')
    return
  }
  
  try {
    const result = await SupabaseService.toggleCommentLike(comment.id)
    
    // Update local state
    comment.user_liked = result.liked
    comment.likes_count = result.likes_count
    
  } catch (error) {
    console.error('Failed to toggle like:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Error', 
      message: 'Failed to update like'
    })
  }
}

const loadMoreComments = async () => {
  page.value++
  await loadComments(false)
}

const refreshComments = async () => {
  await loadComments(true)
}

const replyTo = (comment: Comment) => {
  const username = comment.user?.username || formatAddress(comment.user?.wallet_address)
  newComment.value = `@${username} `
}

// Utility functions
const formatAddress = (address?: string): string => {
  if (!address) return 'Unknown'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

const getUserInitials = (user?: { username?: string; wallet_address?: string }): string => {
  if (user?.username) {
    return user.username.slice(0, 2).toUpperCase()
  }
  if (user?.wallet_address) {
    return user.wallet_address.slice(0, 2).toUpperCase()
  }
  return 'U'
}

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays}d ago`
}

// Watchers
watch(() => props.tokenId, () => {
  if (props.tokenId) {
    loadComments(true)
  }
})

// Lifecycle
onMounted(() => {
  if (props.tokenId) {
    loadComments(true)
  }
})
</script> 