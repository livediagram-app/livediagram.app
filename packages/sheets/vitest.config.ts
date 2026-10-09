import { defineProject } from '@livediagram/vitest-config';

// The sheets engine is pure and shared by the editor, the api and the MCP worker
// (docs/specs/029-sheets/blueprints/sheets-engine.md), so every rule is covered.
export default defineProject({
  test: {
    coverage: {
      thresholds: { lines: 95, branches: 90, functions: 95, statements: 95 },
    },
  },
});
