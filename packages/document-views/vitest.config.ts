import { defineProject } from '@livediagram/vitest-config';

// Views are pure: every line and branch is covered (docs/specs/024-agents/blueprints/document-views.md "Testing").
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
