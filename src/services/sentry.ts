/**
 * Sentry Error Tracking Service
 * Free tier: 5,000 errors/month
 * Sign up at https://sentry.io
 */

import * as Sentry from '@sentry/vue';
import type { App } from 'vue';
import type { Router } from 'vue-router';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';

export function initSentry(app: App, router: Router) {
  // Only initialize Sentry if DSN is configured
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error tracking disabled.');
    return;
  }

  Sentry.init({
    app,
    dsn: SENTRY_DSN,
    environment: APP_ENV,

    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Performance Monitoring (10% sample rate to stay within free tier)
    tracesSampleRate: APP_ENV === 'production' ? 0.1 : 0.0,

    // Session Replay (10% sample rate)
    replaysSessionSampleRate: APP_ENV === 'production' ? 0.1 : 0.0,

    // Capture 100% of sessions with errors
    replaysOnErrorSampleRate: 1.0,

    // Ignore common non-critical errors
    ignoreErrors: [
      // Browser extension errors
      'Non-Error promise rejection captured',
      'ResizeObserver loop limit exceeded',
      // Wallet errors (user rejected, etc)
      'User rejected',
      'User canceled',
      'User declined',
      // Network errors that don't require tracking
      'NetworkError',
      'Failed to fetch',
    ],

    // Filter out transactions we don't care about
    beforeSend(event, hint) {
      // Don't send errors in development
      if (APP_ENV === 'development') {
        console.error('Sentry would send:', event, hint);
        return null;
      }

      return event;
    },
  });
}

/**
 * Manually capture an error
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (SENTRY_DSN && APP_ENV === 'production') {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('Error:', error, context);
  }
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (SENTRY_DSN && APP_ENV === 'production') {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[${level}] ${message}`);
  }
}

/**
 * Set user context
 */
export function setUser(walletAddress: string | null) {
  if (SENTRY_DSN) {
    if (walletAddress) {
      Sentry.setUser({ id: walletAddress });
    } else {
      Sentry.setUser(null);
    }
  }
}
