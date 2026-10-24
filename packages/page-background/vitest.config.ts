import { defineProject } from '@liveworkspace/vitest-config';

// Pure and small: every line and branch is covered.
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
