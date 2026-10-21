import { defineProject } from '@liveplanner/vitest-config';

// Pure and small: every line and branch is covered (docs/specs/007-editor/pages-mode.md "Backgrounds").
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
