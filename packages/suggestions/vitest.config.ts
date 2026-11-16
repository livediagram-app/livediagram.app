import { defineProject } from '@liveworkspace/vitest-config';

// The suggestion rule every product's api and editor share. The pure core is held to every line and branch; the
// React parts render under jsdom with React's automatic JSX runtime, as the apps' Next builds compile them.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/react/**', 'src/test/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
  resolve: { dedupe: ['react', 'react-dom'] },
});
