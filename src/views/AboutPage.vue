<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark py-8">
    <div class="container mx-auto px-4 max-w-4xl">
      <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-8 text-center">{{ $t('about.title') }}</h1>
      
      <div class="space-y-8">
        <!-- What is it -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('about.whatIsFloppFun') }}</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed">
            {{ $t('about.description') }}
          </p>
        </div>

        <!-- How it works -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('about.howItWorks') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="text-center">
              <div class="text-4xl mb-3">🚀</div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ $t('about.create') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('about.createDescription') }}</p>
            </div>
            <div class="text-center">
              <div class="text-4xl mb-3">📈</div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ $t('about.trade') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('about.tradeDescription') }}</p>
            </div>
            <div class="text-center">
              <div class="text-4xl mb-3">💎</div>
              <h3 class="font-semibold text-gray-900 dark:text-white mb-2">{{ $t('about.graduate') }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('about.graduateDescription') }}</p>
            </div>
          </div>
        </div>

        <!-- Features -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('about.features') }}</h2>
          <ul class="space-y-3 text-gray-700 dark:text-gray-300">
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              {{ $t('about.fairLaunchBondingCurves') }}
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              {{ $t('about.noPresalesOrTeamAllocations') }}
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              {{ $t('about.builtOnSolana') }}
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              {{ $t('about.realTimeTradingCharts') }}
            </li>
            <li class="flex items-center">
              <span class="text-pump-green mr-3">✓</span>
              {{ $t('about.communityDrivenTokens') }}
            </li>
          </ul>
        </div>

        <!-- Tech Stack -->
        <div class="card">
          <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-4">{{ $t('about.technology') }}</h2>
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
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">⚠️ {{ $t('about.disclaimer') }}</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('about.disclaimerText') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// About page - no additional logic needed
</script> 