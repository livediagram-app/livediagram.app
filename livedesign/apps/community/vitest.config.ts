import { fileURLToPath } from 'node:url';
import { defineProject } from '@liveworkspace/vitest-config';

// Node is the default environment (the lib suites are pure); a component test opts into jsdom with a
// `@vitest-environment jsdom` docblock. Next compiles JSX with the automatic runtime, so tests that
// render .tsx transform it the same way. The alias mirrors tsconfig's `"@/*": ["./*"]`.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    coverage: { include: ['{app,components,lib,worker}/**/*.{ts,tsx}'] },
  },
});
