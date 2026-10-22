import { fileURLToPath } from 'node:url';
import { defineProject } from '@livediagram/vitest-config';

// resolve.alias mirrors tsconfig.json's `"@/*": ["./*"]` so test files can
// import lib modules whose own import chain reaches a `@/components/...`
// module (e.g. landing-content -> FeatureArt). Mirrors apps/live's config.
//
// esbuild.jsx 'automatic' lets a lib module that evaluates JSX at load
// time (landing-content's section data embeds feature-art elements) import
// cleanly under the node test runner without a React global in scope.
export default defineProject({
  esbuild: { jsx: 'automatic' },
  // A component test opts into jsdom per file; unmount after each, as packages/ui does.
  test: { setupFiles: ['@livediagram/vitest-config/react-cleanup'] },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
