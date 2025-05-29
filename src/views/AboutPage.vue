<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4 max-w-4xl">
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">About FloppFun</h1>
      
      <div class="space-y-8">
        <!-- What is it -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">What is FloppFun?</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
            FloppFun is a decentralized meme token launchpad built on the Solana blockchain. 
            It enables anyone to create and trade meme tokens with fair launch mechanics using bonding curves. 
            No presales, no team allocations - just pure community-driven tokens.
          </p>
        </div>

        <!-- How it works -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">How It Works</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="text-center">
              <div class="text-4xl mb-3">🚀</div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Create</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Launch your meme token with just a few clicks</p>
            </div>
            <div class="text-center">
              <div class="text-4xl mb-3">📈</div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Trade</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Buy and sell tokens using bonding curves</p>
            </div>
            <div class="text-center">
              <div class="text-4xl mb-3">💎</div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Graduate</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">Successful tokens get liquidity on DEX</p>
            </div>
          </div>
        </div>

        <!-- Features -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Features</h2>
          <ul class="space-y-3 text-gray-700 dark:text-gray-300">
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              Fair launch bonding curves
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              No presales or team allocations
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              Built on Solana for low fees
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              Real-time trading and charts
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              Community-driven tokens
            </li>
          </ul>
        </div>

        <!-- Tech Stack -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Technology</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div class="text-2xl mb-2">⚡</div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">Vue.js 3</p>
            </div>
            <div>
              <div class="text-2xl mb-2">🎨</div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">Tailwind CSS</p>
            </div>
            <div>
              <div class="text-2xl mb-2">🌐</div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">Solana</p>
            </div>
            <div>
              <div class="text-2xl mb-2">🗄️</div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">Supabase</p>
            </div>
          </div>
        </div>

        <!-- Disclaimer -->
        <div class="card border-l-4 border-yellow-500">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">⚠️ Disclaimer</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            This is an educational project for learning purposes. FloppFun is an independent platform inspired by decentralized token launchpads.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// About page - no additional logic needed
</script> 