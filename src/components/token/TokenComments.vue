<template>
  <div class="token-comments bg-binance-card rounded-xl border border-binance-border p-6">
    <!-- Header -->
    <div class="comments-header flex items-center justify-between mb-6">
      <h3 class="text-xl font-semibold text-white flex items-center gap-2">
        <svg class="h-6 w-6 text-binance-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Comments
      </h3>
      <span class="text-sm text-binance-gray">{{ totalComments }} {{ totalComments === 1 ? 'comment' : 'comments' }}</span>
    </div>

    <!-- Comment Input (Only visible when authenticated) -->
    <div v-if="walletStore.isConnected" class="comment-input-section mb-6">
      <div class="flex gap-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-binance-yellow to-yellow-600 flex items-center justify-center text-white font-bold">
            {{ walletStore.publicKey?.toString().slice(0, 2).toUpperCase() }}
          </div>
        </div>
        <div class="flex-1">
          <textarea
            v-model="newCommentContent"
            placeholder="Share your thoughts..."
            class="w-full bg-trading-elevated text-white border border-binance-border rounded-lg p-3 focus:outline-none focus:border-binance-yellow resize-none"
            rows="3"
            maxlength="1000"
            :disabled="submitting"
          ></textarea>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-binance-gray">{{ newCommentContent.length }}/1000</span>
            <button
              @click="submitComment"
              :disabled="!canSubmitComment"
              class="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="submitting">Posting...</span>
              <span v-else>Post Comment</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Connect Wallet Message (for non-authenticated users) -->
    <div v-else class="comment-input-section mb-6 bg-trading-elevated rounded-lg p-4 border border-binance-border">
      <div class="flex items-center justify-between">
        <span class="text-binance-gray">Connect your wallet to join the discussion</span>
        <button @click="$emit('connect-wallet')" class="btn-primary px-4 py-2 text-sm">
          Connect Wallet
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="spinner w-8 h-8"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8">
      <div class="text-red-500 mb-2">❌ Failed to load comments</div>
      <p class="text-sm text-binance-gray mb-4">{{ error }}</p>
      <button @click="() => loadComments(true)" class="btn-secondary px-4 py-2 text-sm">
        Try Again
      </button>
    </div>

    <!-- Comments List -->
    <div v-else-if="comments.length > 0" class="comments-list space-y-4">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item bg-trading-elevated rounded-lg p-4 border border-binance-border hover:border-binance-border-hover transition-colors"
      >
        <!-- Comment Header -->
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-binance-yellow to-yellow-600 flex items-center justify-center text-white font-bold">
              {{ comment.userWalletAddress?.slice(0, 2).toUpperCase() || '??' }}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <!-- User info and timestamp -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <router-link
                  :to="`/profile/${comment.userWalletAddress}`"
                  class="text-binance-blue hover:text-blue-300 font-medium transition-colors"
                >
                  {{ comment.userName || formatWalletAddress(comment.userWalletAddress) }}
                </router-link>
                <span class="text-xs text-binance-gray">•</span>
                <span class="text-xs text-binance-gray">{{ formatTimeAgo(comment.createdAt) }}</span>
                <span v-if="comment.updatedAt && comment.updatedAt !== comment.createdAt" class="text-xs text-binance-gray">(edited)</span>
              </div>

              <!-- Comment Actions (for comment owner) -->
              <div v-if="canModifyComment(comment)" class="flex items-center gap-2">
                <button
                  @click="startEditComment(comment)"
                  class="text-binance-gray hover:text-white text-xs transition-colors"
                >
                  Edit
                </button>
                <button
                  @click="confirmDeleteComment(comment.id)"
                  class="text-binance-gray hover:text-red-500 text-xs transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            <!-- Comment Content -->
            <div v-if="editingCommentId === comment.id" class="edit-section">
              <textarea
                v-model="editContent"
                class="w-full bg-binance-card text-white border border-binance-border rounded-lg p-2 focus:outline-none focus:border-binance-yellow resize-none"
                rows="3"
                maxlength="1000"
              ></textarea>
              <div class="flex gap-2 mt-2">
                <button @click="saveEditComment(comment.id)" class="btn-primary px-3 py-1 text-sm">
                  Save
                </button>
                <button @click="cancelEdit" class="btn-secondary px-3 py-1 text-sm">
                  Cancel
                </button>
              </div>
            </div>
            <p v-else class="text-white whitespace-pre-wrap break-words">{{ comment.content }}</p>

            <!-- Like Button -->
            <div class="flex items-center gap-4 mt-3">
              <button
                @click="toggleLike(comment)"
                :disabled="!walletStore.isConnected"
                class="flex items-center gap-1 text-sm transition-colors"
                :class="comment.isLikedByCurrentUser ? 'text-binance-yellow' : 'text-binance-gray hover:text-binance-yellow'"
              >
                <svg class="h-4 w-4" :fill="comment.isLikedByCurrentUser ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span>{{ comment.likesCount || 0 }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="hasMoreComments" class="text-center pt-4">
        <button
          @click="loadMoreComments"
          :disabled="loadingMore"
          class="btn-secondary px-6 py-2 text-sm"
        >
          <span v-if="loadingMore">Loading...</span>
          <span v-else>Load More Comments</span>
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state text-center py-8">
      <div class="w-16 h-16 bg-trading-elevated rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="h-8 w-8 text-binance-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </div>
      <p class="text-white font-medium mb-2">No comments yet</p>
      <p class="text-sm text-binance-gray">Be the first to share your thoughts!</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useWalletStore } from '@/stores/wallet';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import {
  getTokenComments,
  createTokenComment,
  updateComment,
  deleteComment,
  likeComment,
  unlikeComment
} from '@/services/backendApi';

// Define Comment interface based on backend DTO
interface Comment {
  id: number;
  tokenId: number;
  userId: number;
  userWalletAddress: string;
  userName: string | null;
  content: string;
  likesCount: number;
  isLikedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommentsResponse {
  content: Comment[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}

// Props
const props = defineProps<{
  tokenId: number;
  tokenCreator?: string;
}>();

// Emits
const emit = defineEmits<{
  (e: 'connect-wallet'): void;
}>();

// Stores
const walletStore = useWalletStore();
const authStore = useAuthStore();
const uiStore = useUIStore();

// State
const comments = ref<Comment[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref<string | null>(null);
const submitting = ref(false);

const newCommentContent = ref('');
const editingCommentId = ref<number | null>(null);
const editContent = ref('');

const currentPage = ref(0);
const totalPages = ref(0);
const totalComments = ref(0);

// Computed
const canSubmitComment = computed(() => {
  return newCommentContent.value.trim().length > 0 && !submitting.value;
});

const hasMoreComments = computed(() => {
  return currentPage.value < totalPages.value - 1;
});

// Methods
async function loadComments(reset = false) {
  if (reset) {
    currentPage.value = 0;
    comments.value = [];
  }

  loading.value = reset;
  loadingMore.value = !reset;
  error.value = null;

  try {
    const response: CommentsResponse = await getTokenComments(
      props.tokenId.toString(),
      currentPage.value,
      20
    );

    if (reset) {
      comments.value = response.content;
    } else {
      comments.value.push(...response.content);
    }

    totalPages.value = response.totalPages;
    totalComments.value = response.totalElements;
  } catch (err) {
    console.error('Failed to load comments:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load comments';
    uiStore.showToast({
      type: 'error',
      title: '❌ Error',
      message: 'Failed to load comments'
    });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadMoreComments() {
  if (!hasMoreComments.value || loadingMore.value) return;
  currentPage.value++;
  await loadComments(false);
}

async function submitComment() {
  if (!canSubmitComment.value) return;

  if (!walletStore.isConnected) {
    emit('connect-wallet');
    return;
  }

  submitting.value = true;

  try {
    const newComment = await createTokenComment(
      props.tokenId.toString(),
      newCommentContent.value.trim()
    );

    // Add new comment to the beginning of the list
    comments.value.unshift(newComment);
    totalComments.value++;
    newCommentContent.value = '';

    uiStore.showToast({
      type: 'success',
      title: '✅ Comment Posted',
      message: 'Your comment has been posted successfully'
    });
  } catch (err) {
    console.error('Failed to post comment:', err);
    uiStore.showToast({
      type: 'error',
      title: '❌ Error',
      message: err instanceof Error ? err.message : 'Failed to post comment'
    });
  } finally {
    submitting.value = false;
  }
}

function canModifyComment(comment: Comment): boolean {
  if (!authStore.isAuthenticated || !authStore.user) return false;
  return comment.userWalletAddress === authStore.user.wallet_address;
}

function startEditComment(comment: Comment) {
  editingCommentId.value = comment.id;
  editContent.value = comment.content;
}

function cancelEdit() {
  editingCommentId.value = null;
  editContent.value = '';
}

async function saveEditComment(commentId: number) {
  if (!editContent.value.trim()) return;

  try {
    const updatedComment = await updateComment(
      props.tokenId.toString(),
      commentId.toString(),
      editContent.value.trim()
    );

    // Update comment in the list
    const index = comments.value.findIndex(c => c.id === commentId);
    if (index !== -1) {
      comments.value[index] = updatedComment;
    }

    cancelEdit();

    uiStore.showToast({
      type: 'success',
      title: '✅ Comment Updated',
      message: 'Your comment has been updated successfully'
    });
  } catch (err) {
    console.error('Failed to update comment:', err);
    uiStore.showToast({
      type: 'error',
      title: '❌ Error',
      message: 'Failed to update comment'
    });
  }
}

async function confirmDeleteComment(commentId: number) {
  if (!confirm('Are you sure you want to delete this comment?')) return;

  try {
    await deleteComment(props.tokenId.toString(), commentId.toString());

    // Remove comment from the list
    comments.value = comments.value.filter(c => c.id !== commentId);
    totalComments.value--;

    uiStore.showToast({
      type: 'success',
      title: '✅ Comment Deleted',
      message: 'Your comment has been deleted'
    });
  } catch (err) {
    console.error('Failed to delete comment:', err);
    uiStore.showToast({
      type: 'error',
      title: '❌ Error',
      message: 'Failed to delete comment'
    });
  }
}

async function toggleLike(comment: Comment) {
  if (!walletStore.isConnected) {
    emit('connect-wallet');
    return;
  }

  const wasLiked = comment.isLikedByCurrentUser;

  // Optimistic update
  comment.isLikedByCurrentUser = !wasLiked;
  comment.likesCount += wasLiked ? -1 : 1;

  try {
    if (wasLiked) {
      await unlikeComment(props.tokenId.toString(), comment.id.toString());
    } else {
      await likeComment(props.tokenId.toString(), comment.id.toString());
    }
  } catch (err) {
    // Revert on error
    comment.isLikedByCurrentUser = wasLiked;
    comment.likesCount += wasLiked ? 1 : -1;

    console.error('Failed to toggle like:', err);
    uiStore.showToast({
      type: 'error',
      title: '❌ Error',
      message: 'Failed to update like'
    });
  }
}

function formatWalletAddress(address: string): string {
  if (!address) return 'Unknown';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return date.toLocaleDateString();
}

// Lifecycle
onMounted(() => {
  loadComments(true);
});

// Watch for token changes
watch(() => props.tokenId, () => {
  loadComments(true);
});
</script>

<style scoped>
.spinner {
  border: 3px solid rgba(241, 185, 11, 0.3);
  border-top-color: #f1b90b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
