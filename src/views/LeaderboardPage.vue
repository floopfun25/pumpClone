<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">Leaderboard</h1>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Top Traders -->
        <div class="card">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">🏆 Top Traders</h2>
          <div class="text-center py-12">
            <div class="text-6xl mb-4">🎯</div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No trading data yet</h3>
            <p class="text-gray-600 dark:text-gray-400">Start trading to appear on the leaderboard!</p>
          </div>
        </div>

        <!-- Top Tokens -->
        <div class="card">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">💎 Top Tokens</h2>
          <div class="text-center py-12">
            <div class="text-6xl mb-4">🚀</div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No tokens yet</h3>
            <p class="text-gray-600 dark:text-gray-400">Create the first token to get started!</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Leaderboard logic will be implemented later
</script> 