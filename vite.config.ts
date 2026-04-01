import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-app': ['firebase/app'],
          'firebase-auth': ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            'date-fns',
            'lucide-react'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
