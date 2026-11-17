import { defineProject } from '@liveworkspace/vitest-config';

// The timeline, the event log, the recorder, the DOM bridge and the api client are held to every line and branch:
// four canvas apps record and play through them. The React surfaces run under jsdom by their file's
// `@vitest-environment` line and are driven by their own tests; a browser check covers how they look.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
    coverage: {
      // The hooks and the React surfaces are driven by their own tests and checked in a browser; the threshold holds
      // the logic under them.
      exclude: ['**/*.{test,spec}.*', 'src/index.ts', 'src/host.ts', 'src/use*.ts', 'src/ui/**'],
      thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
    },
  },
});
