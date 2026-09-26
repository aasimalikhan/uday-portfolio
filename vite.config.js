import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // three.js is the bulk of the bundle (~185 KB gzipped total); that's expected
    chunkSizeWarningLimit: 800,
  },
});
