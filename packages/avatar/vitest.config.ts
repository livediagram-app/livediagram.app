import { defineProject } from '@liveworkspace/vitest-config';

// Every pure module of Avatar mode (the geometry, the collision, the pads, the costume, the reactions, the speech
// limits, the bindings) is held at 100%, as the other shared packages are. The hooks, the views and the bubble store
// are exercised here and through each product's own tests, as they were in the editor, with no threshold.
const FULL = { statements: 100, branches: 100, functions: 100, lines: 100 };
const PURE = [
  'action-keys',
  'bindings',
  'chair-sitters',
  'collision',
  'config',
  'fence',
  'office-geometry',
  'pad',
  'pad-art',
  'palette',
  'reaction-bursts',
  'reactions',
  'scene',
  'speech',
  'status',
  'walk',
];

// Node stays the DEFAULT environment, as in the editors: a test that renders a hook or component opts in per file
// with a `// @vitest-environment jsdom` docblock (docs/specs/003-system-architecture/testing.md in each product).
export default defineProject({
  // The editors compile this package's JSX with the automatic runtime (Next's default, no React import in scope),
  // so a test that renders a component is transformed the same way.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // Unmount rendered trees after each test: a tree left mounted when jsdom is torn down crashes a later file in
    // the same worker. The shared setup file says why in full.
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
    coverage: {
      thresholds: Object.fromEntries(PURE.map((name) => [`src/${name}.ts`, FULL])),
    },
  },
});
