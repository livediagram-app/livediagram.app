import { defineProject } from '@liveworkspace/vitest-config';

// The store and routes run under node (node:sqlite behind the D1 surface); the button and dialog under jsdom, by
// their file's `@vitest-environment` line. Every line and branch is covered: every app's snapshots run on this.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.{test,spec}.*',
        '**/*.d.ts',
        'src/test/**',
        'src/index.ts',
        'src/server.ts',
        'src/ui/index.ts',
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
