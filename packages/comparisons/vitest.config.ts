import { defineConfig } from 'vitest/config';

// The components are server components with no state: the tests render them to static markup, as
// the apps' static exports do, and read it back under jsdom.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'jsdom' },
  resolve: { dedupe: ['react', 'react-dom'] },
});
