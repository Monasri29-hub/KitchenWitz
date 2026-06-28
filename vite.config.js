import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist'
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://kitchen-witz-ubv8.vercel.app',
        changeOrigin: true
      }
    }
  }
});
