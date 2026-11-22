import { defineProject } from '@liveworkspace/vitest-config';

// The package is pure: every line and branch is covered (liveworkspace/docs/specs/003-accounts/blueprints/ai-keys.md
// "Testing"). The fake answers are test support, measured through the tests that use them.
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/testing/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
