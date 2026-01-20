// Backend Configuration Switcher
// Allows switching between Firebase and AWS backends via environment variable

const backendType = import.meta.env.VITE_BACKEND || 'firebase';

export const config = {
  backend: backendType,
  isFirebase: backendType === 'firebase',
  isAWS: backendType === 'aws',
};

// Log current backend on load (only in development)
if (import.meta.env.DEV) {
  console.log(`🔧 Backend configured: ${backendType.toUpperCase()}`);
}

export default config;
