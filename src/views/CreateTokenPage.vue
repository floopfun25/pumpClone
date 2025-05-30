<template>
  <!-- Token Creation Page -->
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-12">
    <div class="container mx-auto px-4 max-w-2xl">
      <!-- Page Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Create Your Meme Token
        </h1>
        <p class="text-lg text-gray-600 dark:text-gray-400">
          Launch your token with fair launch bonding curves. No presales, no team allocations.
        </p>
      </div>

      <!-- Wallet Connection Required -->
      <div v-if="!isConnected" class="card text-center py-8">
        <div class="text-gray-400 mb-4">
          <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Wallet Required
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Please connect your wallet to create a token
        </p>
        <button @click="connectWallet" class="btn-primary">
          Connect Wallet
        </button>
      </div>

      <!-- Token Creation Form -->
      <div v-else class="card">
        <form @submit.prevent="createToken" class="space-y-6">
          <!-- Validation Errors -->
          <div v-if="validationErrors.length > 0" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Please fix the following errors:</h3>
            <ul class="text-sm text-red-700 dark:text-red-300 space-y-1">
              <li v-for="error in validationErrors" :key="error">• {{ error }}</li>
            </ul>
          </div>

          <!-- Token Basic Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Name *
              </label>
              <input
                v-model="tokenForm.name"
                type="text"
                placeholder="e.g., Doge Coin"
                class="input-field"
                required
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Token Symbol *
              </label>
              <input
                v-model="tokenForm.symbol"
                type="text"
                placeholder="e.g., DOGE"
                class="input-field"
                maxlength="8"
                required
              />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              v-model="tokenForm.description"
              placeholder="Tell everyone about your token..."
              rows="4"
              class="input-field resize-none"
            ></textarea>
          </div>

          <!-- Image Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token Image
            </label>
            <div 
              class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
              @click="triggerFileUpload"
              @dragover.prevent
              @drop.prevent="handleFileDrop"
            >
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                @change="handleFileSelect"
                class="hidden"
              />
              
              <div v-if="!tokenForm.imageFile">
                <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Click to upload or drag and drop an image
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500">
                  PNG, JPG, GIF up to 5MB
                </p>
              </div>
              
              <div v-else class="flex items-center justify-center">
                <div class="text-green-600 dark:text-green-400">
                  <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <p class="text-sm">{{ tokenForm.imageFile.name }}</p>
                  <button type="button" @click.stop="removeImage" class="text-xs text-red-500 hover:text-red-700 mt-1">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Social Links (Optional) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Website
              </label>
              <input
                v-model="tokenForm.website"
                type="url"
                placeholder="https://yourtoken.com"
                class="input-field"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Twitter
              </label>
              <input
                v-model="tokenForm.twitter"
                type="url"
                placeholder="https://twitter.com/yourtoken"
                class="input-field"
              />
            </div>
          </div>

          <!-- Creation Cost -->
          <div v-if="creationCost" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <svg class="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <div>
                  <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">Creation Cost</h3>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    {{ creationCost.total.toFixed(4) }} SOL
                  </p>
                </div>
              </div>
              <div class="text-right text-xs text-blue-600 dark:text-blue-400">
                <div>Platform: {{ creationCost.creationFee }} SOL</div>
                <div>Rent: {{ creationCost.rentExempt.toFixed(4) }} SOL</div>
                <div>Gas: {{ creationCost.transaction }} SOL</div>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isCreating || !canCreate"
            class="w-full btn-primary py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isCreating" class="flex items-center justify-center">
              <div class="spinner w-5 h-5 mr-2"></div>
              Creating Token...
            </span>
            <span v-else>🚀 Create Token</span>
          </button>
        </form>
      </div>
    </div>
  </div>

  <!-- Wallet Modal -->
  <WalletModal
    :is-open="showWalletModal"
    @close="showWalletModal = false"
    @connected="handleWalletConnected"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { tokenService } from '@/services/tokenService'
import type { TokenCreationData } from '@/services/tokenService'
import WalletModal from '@/components/common/WalletModal.vue'

const router = useRouter()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// Form state
const tokenForm = ref<TokenCreationData>({
  name: '',
  symbol: '',
  description: '',
  website: '',
  twitter: '',
  telegram: '',
  discord: ''
})

const fileInput = ref<HTMLInputElement>()
const isCreating = ref(false)
const validationErrors = ref<string[]>([])
const creationCost = ref<any>(null)

// Wallet modal state
const showWalletModal = ref(false)

// Computed properties
const isConnected = computed(() => walletStore.isConnected)
const canCreate = computed(() => 
  tokenForm.value.name && 
  tokenForm.value.symbol && 
  validationErrors.value.length === 0
)

// Methods
const connectWallet = () => {
  showWalletModal.value = true
}

/**
 * Handle wallet connection success
 */
const handleWalletConnected = (walletName: string) => {
  showWalletModal.value = false
  uiStore.showToast({
    type: 'success',
    title: '🔗 Wallet Connected Successfully',
    message: `Connected to ${walletName} wallet`
  })
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    tokenForm.value.imageFile = file
    validateForm()
  }
}

const handleFileDrop = (event: DragEvent) => {
  const file = event.dataTransfer?.files[0]
  if (file) {
    tokenForm.value.imageFile = file
    validateForm()
  }
}

const removeImage = () => {
  tokenForm.value.imageFile = undefined
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  validateForm()
}

const validateForm = () => {
  validationErrors.value = tokenService.validateTokenData(tokenForm.value)
}

const loadCreationCost = async () => {
  try {
    creationCost.value = await tokenService.estimateCreationCost()
  } catch (error) {
    console.error('Failed to load creation cost:', error)
  }
}

const createToken = async () => {
  try {
    isCreating.value = true
    validationErrors.value = []

    // Validate form
    const errors = tokenService.validateTokenData(tokenForm.value)
    if (errors.length > 0) {
      validationErrors.value = errors
      return
    }

    // Create the token
    const result = await tokenService.createToken(tokenForm.value)
    
    uiStore.showToast({
      type: 'success',
      title: 'Token Created Successfully!',
      message: `${tokenForm.value.name} (${tokenForm.value.symbol}) has been created`
    })

    // Redirect to token detail page
    router.push(`/token/${result.mintAddress}`)
    
  } catch (error) {
    console.error('Failed to create token:', error)
    uiStore.showToast({
      type: 'error',
      title: 'Token Creation Failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    })
  } finally {
    isCreating.value = false
  }
}

// Watch for form changes to validate
const unwatchForm = () => {
  // You can add watchers here for real-time validation
}

// Lifecycle
onMounted(() => {
  loadCreationCost()
})
</script>

<style scoped>
.spinner {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style> 