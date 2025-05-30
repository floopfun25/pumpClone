<template>
  <span class="icon" :class="iconClass">
    {{ getIconText(name) }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  class: ''
})

const iconClass = computed(() => props.class)

// Simple text-based icons for demo purposes
// In production, you'd use a proper icon library like Heroicons, Lucide, etc.
const getIconText = (name: string): string => {
  const icons: Record<string, string> = {
    // Wallet & Finance
    'wallet': '💼',
    'coins': '🪙',
    'sol': '◉',
    'dollar-sign': '$',
    
    // Navigation
    'home': '🏠',
    'search': '🔍',
    'menu': '☰',
    'close': '✕',
    'x': '✕',
    'plus': '+',
    'minus': '−',
    
    // Actions
    'refresh': '⟲',
    'edit': '✏️',
    'delete': '🗑️',
    'save': '💾',
    'send': '→',
    'upload': '⬆️',
    'download': '⬇️',
    
    // Status
    'check': '✓',
    'check-double': '✓✓',
    'clock': '🕐',
    'spinner': '⟳',
    'loading': '⟳',
    'exclamation-triangle': '⚠️',
    'info': 'ℹ️',
    
    // Social
    'message-circle': '💬',
    'user': '👤',
    'users': '👥',
    'heart': '❤️',
    'star': '⭐',
    
    // Charts & Data
    'trending-up': '📈',
    'trending-down': '📉',
    'bar-chart': '📊',
    'pie-chart': '🥧',
    'activity': '📊',
    
    // Settings
    'settings': '⚙️',
    'lock': '🔒',
    'unlock': '🔓',
    'eye': '👁️',
    'eye-off': '🙈',
    
    // Media
    'image': '🖼️',
    'video': '📹',
    'file': '📄',
    'link': '🔗',
    
    // Default
    'default': '●'
  }
  
  return icons[name] || icons['default']
}
</script>

<style scoped>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
</style> 