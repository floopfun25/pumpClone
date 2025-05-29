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

      <!-- Token Creation Form -->
      <div class="card">
        <form @submit.prevent="createToken" class="space-y-6">
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
            <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Upload an image for your token (optional)
              </p>
            </div>
          </div>

          <!-- Creation Fee Info -->
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div class="flex items-center">
              <svg class="h-5 w-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div>
                <h3 class="text-sm font-medium text-blue-800 dark:text-blue-200">Creation Fee</h3>
                <p class="text-sm text-blue-700 dark:text-blue-300">0.02 SOL + transaction fees</p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isCreating"
            class="w-full btn-primary py-4 text-lg font-semibold"
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Form state
const tokenForm = ref({
  name: '',
  symbol: '',
  description: '',
  image: null
})

const isCreating = ref(false)

/**
 * Create token function
 * TODO: Integrate with Solana and Supabase
 */
const createToken = async () => {
  try {
    isCreating.value = true
    
    // TODO: Validate form
    // TODO: Upload image to Supabase Storage
    // TODO: Create SPL token on Solana
    // TODO: Save token data to Supabase
    // TODO: Redirect to token page
    
    console.log('Creating token:', tokenForm.value)
    
    // Mock delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Redirect to homepage for now
    router.push('/')
    
  } catch (error) {
    console.error('Failed to create token:', error)
  } finally {
    isCreating.value = false
  }
}
</script> 