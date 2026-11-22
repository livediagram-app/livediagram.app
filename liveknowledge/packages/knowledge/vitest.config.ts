import { defineProject } from '@liveworkspace/vitest-config';

// The package is pure: every line and branch is covered
// (docs/specs/030-knowledgebase/blueprints/knowledge-package.md "Testing"). The fixtures are test support,
// measured through the tests that use them.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/__fixtures__/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
