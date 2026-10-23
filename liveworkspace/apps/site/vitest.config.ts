import { fileURLToPath } from 'node:url';
import { defineProject } from '@livediagram/vitest-config';

// Next compiles JSX with the automatic runtime, so tests that render a component do too. `@/` is the
// site's root, as in tsconfig.json, so a test can render a component that imports through it.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
