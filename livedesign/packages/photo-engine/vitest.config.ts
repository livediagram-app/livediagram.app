import { defineProject } from '@livedesign/vitest-config';

// The photo engine is pure and shared by the editor, its workers and the api
// (docs/specs/031-photo/blueprints/photo-engine.md), so every rule is covered.
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
    },
  },
});
