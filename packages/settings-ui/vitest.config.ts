import { defineConfig } from 'vitest/config';

// Components render under jsdom with React's automatic JSX runtime, as the apps' Next builds compile them.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: { dedupe: ['react', 'react-dom'] },
});
