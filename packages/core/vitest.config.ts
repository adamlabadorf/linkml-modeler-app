import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      // Pure-function io/yaml tests run in node for accurate fs semantics
      ['src/io/**/*.test.ts', 'node'],
    ],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        'src/io/**': { lines: 90, branches: 85 },
        'src/model/**': { lines: 90, branches: 85 },
        'src/store/**': { lines: 80, branches: 75 },
        'src/editor/**': { lines: 99 },
      },
    },
  },
});
