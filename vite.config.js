import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendors': ['react', 'react-dom'],
          'firebase-vendors': ['firebase/app', 'firebase/auth', 'firebase/firestore']
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Adjust the chunk size warning limit if needed
  }
});
