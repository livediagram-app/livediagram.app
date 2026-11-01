import { defineProject } from '@liveworkspace/vitest-config';

// A small contract shared by several Workers and the site: every line and branch is covered.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
