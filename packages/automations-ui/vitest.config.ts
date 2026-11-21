import { defineProject } from '@liveworkspace/vitest-config';

// Node stays the default environment, as in the editors: a test that renders a hook or component opts in per file
// with a `// @vitest-environment jsdom` docblock.
//
// Held at 100% file by file (per-glob thresholds, as @liveworkspace/workbench holds its own): the files this
// package's own tests cover in full. The rest of the screen is exercised end to end by this package's kit tests (a
// fake kit: kit.test.tsx) and, with a real app's kinds, by liveplanner's editor suite, which mounts it through the
// plan's kit; liveplanner's editor enforced no coverage threshold on these files before they moved. A file joins the
// list on the commit that covers it.
const HELD_AT_100 = [
  'src/ScreenTabs.tsx',
  'src/automations-gate.ts',
  'src/automations-client.ts',
  'src/rule-draft.ts',
  'src/value-groups.ts',
  'src/refusal-words.ts',
  'src/run-words.ts',
  'src/types.ts',
  // The unsubscribe page's call (EmailOptOutPage.test.tsx).
  'src/email-optout.ts',
  // The item kit's logic (blueprint item-ui.md "Tests"): what it reads of a rule and the registry, its words, the
  // read-once lists, the routes, the light plumbing and the outline. Its panels and pictures are drawn end to end by
  // item-kit.test.tsx, item-panels.test.tsx and item-scenes.test.tsx, and count toward the package's floor.
  'src/item/rule-reads.ts',
  'src/item/words.ts',
  'src/item/once-store.ts',
  'src/item/client.ts',
  'src/item/plumbing.ts',
  'src/item/outline.ts',
];

export default defineProject({
  // The editors compile this package's JSX with the automatic runtime (Next's default, no React import in scope), so
  // a test that renders a component is transformed the same way.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // Unmount rendered trees after each test: a tree left mounted when jsdom is torn down crashes a later file in
    // the same worker.
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.{test,spec}.*', '**/*.d.ts', 'src/test/**', 'src/item/test/**'],
      thresholds: {
        // The package as a whole, at what its own tests measure (2026-11-20, with the item kit: 79.9% statements,
        // 72.9% branches, 77.7% functions, 81.2% lines; 65.7, 59.3, 60.3 and 67.2 before it). A floor to hold, never
        // a target: liveplanner's suite covers the shared files again through its kit, and counts for nothing here.
        statements: 79,
        branches: 72,
        functions: 77,
        lines: 81,
        ...Object.fromEntries(
          HELD_AT_100.map((glob) => [
            glob,
            { statements: 100, branches: 100, functions: 100, lines: 100 },
          ]),
        ),
      },
    },
  },
});
