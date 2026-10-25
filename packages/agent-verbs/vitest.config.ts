import { defineProject } from '@liveworkspace/vitest-config';

// The verbs are pure over the api: every line and branch is covered, the suites' fakes aside
// (docs/specs/015-api/blueprints/cli.md in each product), as in each product's agent-verbs.
export default defineProject({
  test: {
    coverage: {
      exclude: ['src/testing/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
