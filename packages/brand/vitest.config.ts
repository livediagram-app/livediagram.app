import { defineConfig } from 'vitest/config';

// The logo renders under jsdom with React's automatic JSX runtime, as the apps' Next builds compile it.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: { environment: 'jsdom' },
  resolve: { dedupe: ['react', 'react-dom'] },
});
