import { defineProject } from '@liveworkspace/vitest-config';

// The capture rules run under node; the picker and the device hook under jsdom, by their file's
// `@vitest-environment` line. Every line and branch is covered: livehuddle's calls and every canvas app's
// walkthroughs capture through this.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/index.ts'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
