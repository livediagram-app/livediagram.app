import { defineProject } from '@liveworkspace/vitest-config';

// The PDF writer and the outliner are shared by every editor's export: their logic is covered line by line, the
// browser's own layout (text positions, getBBox, drawing a picture) stood in for, as jsdom lays nothing out. The floor
// is what that reaches: the rest are browser-only paths (a canvas colour read, a face Chromium substitutes).
export default defineProject({
  test: {
    coverage: {
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/test-dom.ts', 'src/test-pdf.ts'],
      thresholds: { lines: 99, branches: 90, functions: 98, statements: 97 },
    },
  },
});
