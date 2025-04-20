// This file manages version information to prevent caching issues
// The timestamp will be included in the query string of assets to bust caches

// Generate a version based on timestamp - change this when deploying new versions
export const APP_VERSION = '1.0.0';
// Use the build timestamp from Vite if available, otherwise generate a new one
export const BUILD_TIMESTAMP = import.meta.env.VITE_CACHE_BUST || Date.now();

// Function to add version param to URLs to prevent caching of stale assets
export const addVersionToUrl = (url) => {
  if (!url) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${APP_VERSION}-${BUILD_TIMESTAMP}`;
};

// Insert a script into the document to define a global version
export const injectVersionInfo = () => {
  if (typeof window !== 'undefined') {
    window.__APP_VERSION__ = APP_VERSION;
    window.__BUILD_TIMESTAMP__ = BUILD_TIMESTAMP;
    
    console.log('App version information:', {
      version: APP_VERSION,
      timestamp: BUILD_TIMESTAMP,
      buildTime: import.meta.env.VITE_BUILD_TIME || 'not set'
    });
    
    // Add listener to detect chunk loading failures
    window.addEventListener('error', (event) => {
      // Check if this is a chunk loading error
      if (
        event.target && 
        event.target.tagName === 'SCRIPT' && 
        event.target.src
      ) {
        console.error('Detected JavaScript loading error:', event.target.src);
        
        // If the error includes "ChunkLoadError" or similar, it's likely a stale chunk
        if (event.message && (
          event.message.includes('ChunkLoadError') || 
          event.message.includes('Loading chunk') ||
          event.message.includes('Failed to fetch dynamically imported module')
        )) {
          console.warn('Detected chunk loading error, forcing page reload with cache busting');
          
          // Reload the page with cache busting
          window.location.href = addVersionToUrl(window.location.href);
        }
      }
    }, true); // Use capture to get the event before it reaches other handlers
    
    // Additional fix for mobile-specific issues where errors aren't properly caught
    const detectMobileStuckLoading = () => {
      const MAX_LOADING_TIME = 8000; // 8 seconds should be enough for initial loading
      
      setTimeout(() => {
        // If we're still showing loading after timeout, we'll force a clean reload
        if (document.body.textContent.includes('Loading')) {
          console.warn('Application appears stuck on loading. Attempting to force reload with cache clearing.');
          // Add cache busting parameters and reload
          window.location.href = addVersionToUrl(window.location.href);
        }
      }, MAX_LOADING_TIME);
    };
    
    // Execute the stuck loading detection
    detectMobileStuckLoading();
  }
};

// Helper function to detect mobile devices
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export default {
  APP_VERSION,
  BUILD_TIMESTAMP,
  addVersionToUrl,
  isMobileDevice,
  injectVersionInfo
};