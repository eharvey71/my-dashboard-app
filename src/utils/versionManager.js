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
    
    // Recover from a boot that never mounts (typically a stale cached chunk on
    // mobile). The previous version of this checked whether the page text
    // contained the word "Loading", which matches any note, task or document
    // with that word in it - and reloaded, forever. Two guards now:
    //   1. Look at whether React actually mounted, not at page text.
    //   2. Reload at most once per session, tracked in sessionStorage, so a
    //      genuinely broken build shows an error instead of looping.
    const RELOAD_MARKER = '__cognify_boot_reload__';
    const MAX_BOOT_TIME = 8000;

    const alreadyRetried = () => {
      try {
        return sessionStorage.getItem(RELOAD_MARKER) === '1';
      } catch {
        // Private mode / blocked storage: assume retried, i.e. never reload.
        return true;
      }
    };

    const markRetried = () => {
      try {
        sessionStorage.setItem(RELOAD_MARKER, '1');
      } catch {
        // Ignore - the reload below is then best-effort and one-shot anyway.
      }
    };

    const detectStuckBoot = () => {
      setTimeout(() => {
        const root = document.getElementById('root');
        const mounted = root && root.childElementCount > 0;

        if (mounted || alreadyRetried()) return;

        console.warn('App did not mount within %dms; reloading once with cache busting.', MAX_BOOT_TIME);
        markRetried();
        window.location.href = addVersionToUrl(window.location.href);
      }, MAX_BOOT_TIME);
    };

    // Once the app mounts, clear the marker so a later session can retry again.
    window.addEventListener('load', () => {
      const root = document.getElementById('root');
      if (root && root.childElementCount > 0) {
        try {
          sessionStorage.removeItem(RELOAD_MARKER);
        } catch {
          // Ignore.
        }
      }
    });

    detectStuckBoot();
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