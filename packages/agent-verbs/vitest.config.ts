import { defineProject } from '@livediagram/vitest-config';

// The verb catalogue is pure: every line and branch is covered, the suites' fakes aside
// (docs/specs/015-api/blueprints/cli.md).
export default defineProject({
  test: {
    coverage: {
      exclude: ['src/testing/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
