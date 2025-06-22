<template>
  <!-- Token Creation Page -->
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-12">
    <div class="container mx-auto px-4 max-w-2xl">
      <!-- Page Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {{ t('token.createYourMemeToken') }}
        </h1>
        <p class="text-lg text-gray-600 dark:text-gray-400">
          {{ t('token.createTokenDescription') }}
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
          {{ t('token.walletRequired') }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          {{ t('messages.info.connectWalletFirst') }}
        </p>
        <button @click="connectWallet" class="btn-primary">
          {{ t('wallet.connect') }}
        </button>
      </div>

      <!-- Token Creation Form -->
      <div v-else class="card">
        <form @submit.prevent="createToken" class="space-y-6">
          <!-- Validation Errors -->
          <div v-if="validationErrors.length > 0" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 class="text-sm font-medium text-red-800 dark:text-red-200 mb-2">{{ t('forms.pleaseFixErrors') }}:</h3>
            <ul class="text-sm text-red-700 dark:text-red-300 space-y-1">
              <li v-for="error in validationErrors" :key="error">• {{ error }}</li>
            </ul>
          </div>

          <!-- Token Basic Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('token.name') }} *
              </label>
              <input
                v-model="tokenForm.name"
                type="text"
                :placeholder="t('token.namePlaceholder')"
                class="input-field"
                required
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('token.symbol') }} *
              </label>
              <input
                v-model="tokenForm.symbol"
                type="text"
                :placeholder="t('token.symbolPlaceholder')"
                class="input-field"
                maxlength="8"
                required
              />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('token.description') }}
            </label>
            <textarea
              v-model="tokenForm.description"
              :placeholder="t('token.descriptionPlaceholder')"
              rows="4"
              class="input-field resize-none"
            ></textarea>
          </div>

          <!-- Image Upload -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('token.image') }}
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
                  {{ t('forms.clickUploadOrDrag') }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500">
                  {{ t('forms.imageFormats') }}
                </p>
              </div>
              
              <div v-else class="flex items-center justify-center">
                <div class="text-green-600 dark:text-green-400">
                  <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <p class="text-sm">{{ tokenForm.imageFile.name }}</p>
                  <button type="button" @click.stop="removeImage" class="text-xs text-red-500 hover:text-red-700 mt-1">
                    {{ t('forms.remove') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Social Links (Optional) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('token.website') }}
              </label>
              <input
                v-model="tokenForm.website"
                type="url"
                :placeholder="t('token.websitePlaceholder')"
                class="input-field"
              />
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('token.twitter') }}
              </label>
              <input
                v-model="tokenForm.twitter"
                type="url"
                :placeholder="t('token.twitterPlaceholder')"
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
                  <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">{{ t('token.creationCost') }}</h3>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    {{ creationCost.total.toFixed(4) }} SOL
                  </p>
                </div>
              </div>
              <div class="text-right text-xs text-blue-600 dark:text-blue-400">
                <div>{{ t('token.platform') }}: {{ creationCost.creationFee }} SOL</div>
                <div>{{ t('token.rent') }}: {{ creationCost.rentExempt.toFixed(4) }} SOL</div>
                <div>{{ t('token.gas') }}: {{ creationCost.transaction }} SOL</div>
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
              {{ t('token.creatingToken') }}...
            </span>
            <span v-else>🚀 {{ t('token.create') }}</span>
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
import { useTypedI18n } from '@/i18n'
import { useWalletStore } from '@/stores/wallet'
import { useUIStore } from '@/stores/ui'
import { tokenService } from '@/services/tokenService'
import type { TokenCreationData } from '@/services/tokenService'
import WalletModal from '@/components/common/WalletModal.vue'

interface TokenForm extends TokenCreationData {
  imageFile?: File
}

const { t } = useTypedI18n()
const router = useRouter()
const walletStore = useWalletStore()
const uiStore = useUIStore()

// Form state
const tokenForm = ref<TokenForm>({
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

const handleWalletConnected = () => {
  showWalletModal.value = false
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    tokenForm.value.imageFile = target.files[0]
  }
}

const handleFileDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    tokenForm.value.imageFile = files[0]
  }
}

const removeImage = () => {
  tokenForm.value.imageFile = undefined
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const createToken = async () => {
  try {
    isCreating.value = true
    validationErrors.value = []

    // Validate form
    if (!tokenForm.value.name || !tokenForm.value.symbol) {
      validationErrors.value.push(t('forms.errors.requiredFields'))
      return
    }

    // Create token
    const result = await tokenService.createToken(tokenForm.value)
    
    // Show success notification
    uiStore.showToast({
      type: 'success',
      message: t('token.creationSuccess'),
      title: t('token.success')
    })

    // Redirect to token page
    await router.push(`/token/${result.mintAddress}`)
  } catch (error: any) {
    console.error('Token creation error:', error)
    validationErrors.value.push(error.message || t('forms.errors.unknown'))
    
    uiStore.showToast({
      type: 'error',
      message: error.message || t('forms.errors.unknown'),
      title: t('token.error')
    })
  } finally {
    isCreating.value = false
  }
}

// Lifecycle
onMounted(() => {
  fileInput.value = document.querySelector<HTMLInputElement>('input[type="file"]') || undefined
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