import { defineProject } from '@liveworkspace/vitest-config';

// The subscription contract every Worker and page reads its limits from: every line and branch is covered.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.test-kit.ts', '**/*.d.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
