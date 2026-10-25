import { defineProject } from '@liveworkspace/vitest-config';

// Node stays the DEFAULT environment, as in the editors: a test that renders a hook or component
// opts in per file with a `// @vitest-environment jsdom` docblock
// (docs/specs/003-system-architecture/testing.md in each product).
export default defineProject({
  // The editors compile this package's JSX with the automatic runtime (Next's default, no React
  // import in scope), so a test that renders a component is transformed the same way.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // Unmount rendered trees after each test: a tree left mounted when jsdom is torn down crashes a
    // later file in the same worker. The shared setup file says why in full.
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
  },
});
