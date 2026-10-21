import { defineProject } from '@livediagram/vitest-config';

// The client is small and pure: every line and branch is covered (docs/specs/015-api/blueprints/cli.md).
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
