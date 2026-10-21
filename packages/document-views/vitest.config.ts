import { defineProject } from '@livediagram/vitest-config';

// Views are pure: every line and branch is covered (docs/specs/024-agents/blueprints/document-views.md "Testing").
// The fixtures are test support, measured through the tests that use them.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/__fixtures__/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
