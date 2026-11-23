import { defineProject } from '@liveworkspace/vitest-config';

// The pure part and the route run under node; the tool under jsdom, by each file's `@vitest-environment` line. Every
// line and branch of the pure part, the route and the tool's own logic is covered: every app's Ask AI runs on this.
// The React views are tested for what they do, not held to the same count.
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
        'src/index.ts',
        'src/server/index.ts',
        'src/ui/index.ts',
        'src/ui/host.ts',
        'src/ui/*.tsx',
      ],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
