import { defineProject } from '@livediagram/vitest-config';

// The preview tooling's logic is pure and fully covered
// (docs/specs/016-platform/blueprints/pr-previews.md "Testing");
// scripts/ is IO, proven by `preview:check` and real preview runs.
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
