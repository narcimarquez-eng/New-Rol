import { defineConfig } from 'vite';

// base relativa para que el build funcione en GitHub Pages (/new-rol/)
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
});
