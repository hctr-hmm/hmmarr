import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../backend/static',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000'
    }
  }
});
