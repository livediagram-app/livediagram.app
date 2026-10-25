import { fileURLToPath } from 'node:url';
import { defineProject } from '@liveworkspace/vitest-config';

// Next compiles JSX with the automatic runtime, so tests that render a component do too. `@/` is the
// site's root, as in tsconfig.json, so a test can render a component that imports through it.
// e2e/*.spec.ts are Playwright's (playwright.config.ts), run against the built export.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  test: { exclude: ['**/node_modules/**', 'e2e/**'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
