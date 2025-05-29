<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Portfolio</h1>
      
      <!-- Portfolio Summary -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="card text-center">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Total Value</h3>
          <p class="text-2xl font-bold text-pump-green">$0.00</p>
        </div>
        <div class="card text-center">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Total Tokens</h3>
          <p class="text-2xl font-bold text-gray-900 dark:text-white">0</p>
        </div>
        <div class="card text-center">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">24h Change</h3>
          <p class="text-2xl font-bold text-gray-500">-</p>
        </div>
      </div>

      <!-- Holdings -->
      <div class="card">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">Your Holdings</h2>
        <div class="text-center py-12">
          <div class="text-6xl mb-4">💼</div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No tokens in portfolio</h3>
          <p class="text-gray-600 dark:text-gray-400">Start trading to build your portfolio!</p>
          <router-link to="/" class="btn-primary mt-4 inline-block">Browse Tokens</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Portfolio logic will be implemented later
</script> 