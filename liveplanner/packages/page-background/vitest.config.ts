import { defineProject } from '@liveworkspace/vitest-config';

// Pure and small: every line and branch is covered (docs/specs/030-forms/forms.md "The form card, top to bottom").
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
