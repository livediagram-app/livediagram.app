import { defineProject } from '@livediagram/vitest-config';

// Pure and small: every line and branch is covered (docs/specs/007-editor/illustrate-pages.md "Backgrounds").
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
