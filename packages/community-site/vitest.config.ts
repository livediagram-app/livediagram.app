import { defineProject } from '@liveworkspace/vitest-config';

// Node by default: the lib suites, the Worker and the style guards are pure. A component suite opts into jsdom with a
// `@vitest-environment jsdom` docblock. Next compiles JSX with the automatic runtime, so these do too.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { dedupe: ['react', 'react-dom'] },
});
