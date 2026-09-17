import { defineProject } from '@livediagram/vitest-config';

// Node stays the DEFAULT environment: most tests here are pure logic (tone
// mapping, month cells, stacking, newness). A test that renders a hook or
// component opts in per file with a `// @vitest-environment jsdom` docblock,
// the same convention apps/live uses — see specs/18-testing.md.
//
// No `resolve.dedupe` needed, unlike apps/live: a test in this package
// resolves the one React that this package's own devDependency provides,
// so there is no second copy to collide with.
export default defineProject({
  // Consumers compile this package's JSX with the automatic runtime (Next's
  // default, no React import in scope), so a test that renders a component
  // has to be transformed the same way or it throws "React is not defined".
  esbuild: { jsx: 'automatic' },
  // Unmounts React roots between tests — see vitest.setup.ts for what a root
  // left mounted does to the run.
  test: { setupFiles: ['./vitest.setup.ts'] },
});
