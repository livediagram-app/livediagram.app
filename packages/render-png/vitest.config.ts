import { defineProject } from '@livediagram/vitest-config';

// The rasteriser is small and shared by two front doors: every line and branch is covered.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
