import { defineProject } from '@livediagram/vitest-config';

// The lens is pure and small: every line and branch is covered (docs/specs/013-workspace/blueprints/explorer-filters.md).
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
