import { defineProject } from '@liveworkspace/vitest-config';

// Node by default: a test that renders a component opts in with a `// @vitest-environment jsdom` docblock, as
// packages/ui's do. The apps compile this package's JSX with the automatic runtime, so the tests do too, and
// unmount what they render after each test (the shared setup file says why).
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  test: { setupFiles: ['@liveworkspace/vitest-config/react-cleanup'] },
});
