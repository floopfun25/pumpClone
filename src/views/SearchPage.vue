<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Search Tokens</h1>
      
      <!-- Search Input -->
      <div class="card mb-8">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by token name, symbol, or creator..."
            class="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center">
            <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Search Results -->
      <div class="card">
        <div class="text-center py-12">
          <div class="text-6xl mb-4">🔍</div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {{ searchQuery ? 'No results found' : 'Start searching for tokens' }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            {{ searchQuery ? 'Try a different search term' : 'Enter a token name, symbol, or creator address' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')
</script> 