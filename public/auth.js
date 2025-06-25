// Simple htaccess-like protection for GitHub Pages
(function() {
  'use strict';
  
  // Configuration
  const CONFIG = {
    // Set your password here
    password: 'erzurum',
    
    // Authentication expires after (hours)
    expireHours: 24,
    
    // Storage key
    authKey: 'gh-pages-auth',
    
    // Session flag to prevent reload loops
    sessionFlag: 'gh-pages-session-active',
    
    // Allowed paths that don't need authentication (optional)
    allowedPaths: ['/login.html', '/favicon.ico']
  };
  
  // Check if current path is allowed without auth
  function isPathAllowed() {
    const currentPath = window.location.pathname;
    return CONFIG.allowedPaths.some(path => currentPath.includes(path));
  }
  
  // Check if user is authenticated
  function isAuthenticated() {
    const authData = localStorage.getItem(CONFIG.authKey);
    
    if (!authData) return false;
    
    try {
      const { timestamp, authenticated } = JSON.parse(authData);
      const now = Date.now();
      const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
      
      // Check if authentication is still valid
      if (authenticated && hoursDiff < CONFIG.expireHours) {
        return true;
      } else {
        // Clear expired authentication
        localStorage.removeItem(CONFIG.authKey);
        return false;
      }
    } catch (e) {
      localStorage.removeItem(CONFIG.authKey);
      return false;
    }
  }
  
  // Check if this is a fresh session (not a reload from auth)
  function isFreshSession() {
    return !sessionStorage.getItem(CONFIG.sessionFlag);
  }
  
  // Mark session as active
  function markSessionActive() {
    sessionStorage.setItem(CONFIG.sessionFlag, 'true');
  }
  
  // Authenticate user
  function authenticate() {
    const password = prompt('🔐 Access Code Required for FloppFun:\n(Contact owner for access)');
    
    if (password === CONFIG.password) {
      // Store authentication
      const authData = {
        authenticated: true,
        timestamp: Date.now()
      };
      localStorage.setItem(CONFIG.authKey, JSON.stringify(authData));
      
      // Mark session and reload to show full content
      markSessionActive();
      window.location.reload();
      return true;
    } else if (password !== null) {
      // Wrong password (null means cancelled)
      alert('❌ Invalid access code. Please contact the site owner.');
      authenticate(); // Try again
    } else {
      // User cancelled - show access denied message
      showAccessDenied();
    }
    
    return false;
  }
  
  // Show access denied screen
  function showAccessDenied() {
    document.body.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        text-align: center;
      ">
        <div>
          <h1 style="font-size: 3rem; margin-bottom: 1rem;">🔒</h1>
          <h2 style="margin-bottom: 1rem;">FloppFun - Private Access</h2>
          <p style="margin-bottom: 2rem; opacity: 0.8;">This site requires authorization to access.</p>
          <button onclick="location.reload()" style="
            background: rgba(255,255,255,0.2);
            border: 2px solid white;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
          " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
             onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            Try Again
          </button>
        </div>
      </div>
    `;
  }
  
  // Hide content with loading screen
  function hideContentAndAuth() {
    document.body.style.visibility = 'hidden';
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🚀</div>
          <div style="font-size: 1.5rem; margin-bottom: 1rem;">FloppFun</div>
          <div style="opacity: 0.8;">Checking access...</div>
        </div>
      </div>
    `;
    
    // Show auth prompt after a delay
    setTimeout(() => {
      authenticate();
    }, 1000);
  }
  
  // Main authentication check
  function checkAuth() {
    // Skip auth for allowed paths
    if (isPathAllowed()) {
      return;
    }
    
    // If user is authenticated, let the page load normally
    if (isAuthenticated()) {
      // Mark session as active to prevent future interruptions
      markSessionActive();
      document.body.style.visibility = 'visible';
      return;
    }
    
    // If this is a fresh session (not a reload from auth), show auth
    if (isFreshSession()) {
      hideContentAndAuth();
    } else {
      // This shouldn't happen, but fallback to showing content
      document.body.style.visibility = 'visible';
    }
  }
  
  // Prevent right-click context menu and dev tools (only in production)
  const isProduction = !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
  
  if (isProduction) {
    // Prevent right-click context menu (optional security)
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });
    
    // Prevent F12, Ctrl+Shift+I, etc. (optional security)
    document.addEventListener('keydown', function(e) {
      if (e.keyCode === 123 || // F12
          (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
          (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
          (e.ctrlKey && e.keyCode === 85)) { // Ctrl+U
        e.preventDefault();
      }
    });
  }
  
  // Run authentication check when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }
})(); 