import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';

  return {
  base: isElectron ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@linkml-editor/core': resolve(__dirname, '../core/src/index.ts'),
      // Provide browser-compatible Buffer polyfill for both web and electron builds
      buffer: resolve(__dirname, 'node_modules/buffer/index.js'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    alias: {
      '@linkml-editor/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  };
});
