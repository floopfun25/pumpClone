<template>
  <div class="min-h-screen bg-gray-50 dark:bg-pump-dark flex items-center justify-center">
    <div class="text-center">
      <div class="text-9xl mb-8">🤔</div>
      <h1 class="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
      <h2 class="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-6">{{ $t('error.pageNotFound') }}</h2>
      <p class="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
        {{ $t('error.pageNotFoundDescription') }}
      </p>
      <div class="space-x-4">
        <router-link to="/" class="btn-primary">
          {{ $t('navigation.home') }}
        </router-link>
        <button @click="$router.go(-1)" class="btn-secondary">
          {{ $t('common.back') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 404 page - no additional logic needed
</script> 