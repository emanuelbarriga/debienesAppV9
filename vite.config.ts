import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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
