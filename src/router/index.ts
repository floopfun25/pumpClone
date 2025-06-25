import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Define route types for better type safety
export interface RouteParams {
  mintAddress?: string
  userId?: string
}

// Create router instance with route definitions
const router = createRouter({
  // Use HTML5 history mode for clean URLs
  history: createWebHistory(import.meta.env.BASE_URL),
  
  routes: [
    {
      path: '/',
      name: 'home',
      // Lazy load components for better performance
      component: () => import('@/views/HomePage.vue'),
      meta: {
        title: 'FloppFun - Meme Token Launchpad',
        description: 'Create, trade, and discover meme tokens on Solana'
      }
    },
    {
      path: '/create',
      name: 'create-token',
      component: () => import('@/views/CreateTokenPage.vue'),
      meta: {
        title: 'Create Token - FloppFun',
        description: 'Launch your own meme token with fair launch mechanics'
      }
    },
    {
      path: '/token/:mintAddress',
      name: 'token-detail',
      component: () => import('@/views/TokenDetailPage.vue'),
      meta: {
        title: 'Token Details - FloppFun',
        description: 'View token information, charts, and trade'
      },
      props: true // Pass route params as props
    },
    {
      path: '/profile/:address',
      name: 'profile',
      component: () => import('@/views/ProfilePage.vue'),
      meta: {
        title: 'User Profile - FloppFun',
        description: 'View user profile, created tokens, and trading history',
        requiresAuth: true
      },
      props: true
    },
    {
      path: '/portfolio',
      name: 'portfolio',
      component: () => import('@/views/PortfolioPage.vue'),
      meta: {
        title: 'Portfolio - FloppFun',
        description: 'Manage your token holdings and track performance',
        requiresAuth: true
      }
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchPage.vue'),
      meta: {
        title: 'Search Tokens - FloppFun',
        description: 'Find tokens by name, symbol, or creator'
      }
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutPage.vue'),
      meta: {
        title: 'About - FloppFun',
        description: 'Learn about our platform and how it works'
      }
    },
    {
      // 404 catch-all route
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundPage.vue'),
      meta: {
        title: 'Page Not Found - FloppFun',
        description: 'The page you are looking for does not exist'
      }
    }
  ],
  
  // Scroll behavior for better UX
  scrollBehavior(to, from, savedPosition) {
    // If user used browser back/forward buttons, restore position
    if (savedPosition) {
      return savedPosition
    }
    
    // If navigating to an anchor, scroll to it
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth'
      }
    }
    
    // Otherwise, scroll to top
    return { top: 0 }
  }
})

// Navigation guards for authentication and metadata
router.beforeEach(async (to, from, next) => {
  try {
    const authStore = useAuthStore()
    
    // Check if route requires authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      // Redirect to home with a message to connect wallet
      return next({
        name: 'home',
        query: { 
          redirect: to.fullPath,
          message: 'Please connect your wallet to access this page'
        }
      })
    }
    
    // Update document title and meta description
    if (to.meta.title) {
      document.title = to.meta.title as string
    }
    
    if (to.meta.description) {
      const descriptionMeta = document.querySelector('meta[name="description"]')
      if (descriptionMeta) {
        descriptionMeta.setAttribute('content', to.meta.description as string)
      }
    }
    
    next()
  } catch (error) {
    console.error('Navigation guard error:', error)
    next()
  }
})

// Global after hook for analytics and cleanup
router.afterEach((to, from) => {
  // Close mobile menu if open (can be implemented later)
  // uiStore.closeMobileMenu()
})

export default router 