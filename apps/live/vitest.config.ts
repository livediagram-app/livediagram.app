import { fileURLToPath } from 'node:url';
import { configDefaults } from 'vitest/config';
import { defineProject } from '@livediagram/vitest-config';

// Node stays the DEFAULT environment: the ~1,645 tests here are pure logic
// (canvas geometry, parsers, config tables) and run faster without a DOM.
// The few that render a hook or component opt in per file with a
// `// @vitest-environment jsdom` docblock — see useTimelineFeed.test.tsx and
// specs/18-testing.md. Flipping the whole workspace would tax every other
// suite to serve a handful of files.
//
// resolve.alias mirrors tsconfig.json's `"@/*": ["./*"]` so test files
// that import a helper from a component file (e.g.
// commentRowsFromElements out of CommentsPanel.tsx, which itself
// imports `@/lib/relative-time` for hooks the helper never reaches)
// can resolve the module-load chain. Without this the test runner
// fails at import time on any component-co-located pure helper whose
// host module touches the alias.
export default defineProject({
  // Next compiles JSX with the automatic runtime (no React import in
  // scope), so any .tsx module a test touches (e.g. the template
  // preview switches) must be transformed the same way here or it
  // throws "React is not defined" at render time.
  esbuild: { jsx: 'automatic' },
  // The e2e/ Playwright smoke suite (spec/72) uses the same `.spec.ts`
  // extension but runs under Playwright, not Vitest — keep it out of
  // the unit run (it has its own `test:e2e` script).
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
  resolve: {
    // One React, shared with the workspace packages. `packages/ui` peers
    // react (correctly) but carries its own copy for its own tests, so a
    // hook test here that renders a `@livediagram/ui` hook resolved TWO
    // Reacts — the renderer's and the package's — and every useState threw
    // "Cannot read properties of null". Next's bundler dedupes for real
    // builds; the test resolver has to be told.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
});
