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
        // Global floor for files not in per-glob rules (canvas/auth/ui/platform); raise in v1.1/v1.2
        functions: 30,
        // Per-module floors enforced by Vitest per-glob threshold syntax
        'src/io/**': { lines: 90, branches: 85 },
        'src/model/**': { lines: 90, branches: 85 },
        'src/store/**': { lines: 80, branches: 75 },
        // Editor coverage is lower today (lines ~57%, functions ~18%); raise in v1.1/v1.2
        'src/editor/**': { lines: 50, functions: 15 },
        // Validation is fully exercised today (lines ~100%, branches ~98%)
        'src/validation/**': { lines: 95, branches: 90 },
      },
    },
  },
});
