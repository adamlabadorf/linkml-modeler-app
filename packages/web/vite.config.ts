import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isElectron = process.env.VITE_ELECTRON === '1';

export default defineConfig({
  base: isElectron ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@linkml-editor/core': resolve(__dirname, '../core/src/index.ts'),
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
});
