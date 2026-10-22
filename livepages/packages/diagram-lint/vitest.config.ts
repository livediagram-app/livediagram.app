import { defineProject } from '@livediagram/vitest-config';

// The lint is pure: every line and branch is covered (docs/specs/024-agents/blueprints/diagram-lint.md).
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
