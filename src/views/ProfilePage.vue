<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4 max-w-4xl">
      <!-- Profile Header -->
      <div class="card mb-8">
        <div class="flex items-center space-x-6">
          <div class="w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <span class="text-white text-2xl font-bold">{{ walletInitials }}</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ username || 'Anonymous User' }}</h1>
            <p class="text-gray-600 dark:text-gray-400 font-mono">{{ shortWalletAddress }}</p>
            <div class="flex space-x-4 mt-2 text-sm">
              <span class="text-gray-600 dark:text-gray-400">🎭 {{ tokensCreated }} tokens created</span>
              <span class="text-gray-600 dark:text-gray-400">💰 {{ totalVolume }} SOL volume</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Created Tokens -->
      <div class="card">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Created Tokens</h2>
        <div class="text-center py-12">
          <div class="text-6xl mb-4">🎭</div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No tokens created yet</h3>
          <p class="text-gray-600 dark:text-gray-400">Start creating your first meme token!</p>
          <router-link to="/create" class="btn-primary mt-4 inline-block">Create Token</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const username = ref('')
const walletAddress = ref('ABC123def456ghi789jkl0123456789')
const tokensCreated = ref(0)
const totalVolume = ref(0)

const walletInitials = computed(() => 
  walletAddress.value ? walletAddress.value.slice(0, 2).toUpperCase() : 'W'
)

const shortWalletAddress = computed(() => 
  walletAddress.value ? `${walletAddress.value.slice(0, 4)}...${walletAddress.value.slice(-4)}` : ''
)
</script> 