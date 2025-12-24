import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Generate a timestamp string to use for cache busting
const timestamp = new Date().getTime();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'services': path.resolve(__dirname, './src/services'),
    },
  },
  build: {
    // Add build timestamp for cache busting
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendors': ['react', 'react-dom'],
          'firebase-vendors': ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  // Define build time for debugging
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    // Add a timestamp to use for cache busting
    'import.meta.env.VITE_CACHE_BUST': JSON.stringify(timestamp),
    // Polyfill global for Pinecone SDK (Node.js compatibility)
    'global': 'window'
  }
});