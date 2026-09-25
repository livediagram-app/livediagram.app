import { defineProject } from '@livediagram/vitest-config';

// Next compiles JSX with the automatic runtime (no React import in scope), so
// a test that imports a view's metric list (metric-emitters.test.ts) must
// transform the .tsx it pulls in the same way, or it throws "React is not
// defined" at import time.
export default defineProject({ esbuild: { jsx: 'automatic' } });
