import { defineProject } from '@liveworkspace/vitest-config';

// Node stays the DEFAULT environment, as in the editors: a test that renders a hook or component
// opts in per file with a `// @vitest-environment jsdom` docblock
// (docs/specs/003-system-architecture/testing.md in each product).
// Held at 100% file by file (per-glob thresholds, so neither is averaged away by the rest of the package, which has
// no gate yet): the shared Contents both livedocuments and livedesign mount, its sidebar and the hook behind it
// (docs/specs/007-editor/pages-mode.md "Contents" in each). The editors' door tests drive them with real pages; these
// gates keep the package's own tests covering every branch. A new file joins the list on the commit that adds it.
const HELD_AT_100 = [
  'src/components/canvas/PageContentsSidebar.tsx',
  'src/lib/editor-arrival.ts',
  'src/lib/guard-run.ts',
  'src/lib/room-presence.ts',
  'src/hooks/ui/usePageContents.ts',
  'src/components/canvas/arrow-view-parts.tsx',
  'src/lib/editor-search/build-search-results.ts',
  'src/lib/api/core.ts',
  'src/components/start/StartPanel.tsx',
  'src/lib/canvas-backgrounds.ts',
  'src/lib/tab-looks.ts',
  'src/lib/editor-viewport-defaults.ts',
  'src/components/canvas/label-align.ts',
];

export default defineProject({
  // The editors compile this package's JSX with the automatic runtime (Next's default, no React
  // import in scope), so a test that renders a component is transformed the same way.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // Unmount rendered trees after each test: a tree left mounted when jsdom is torn down crashes a
    // later file in the same worker. The shared setup file says why in full.
    setupFiles: ['@liveworkspace/vitest-config/react-cleanup'],
    coverage: {
      thresholds: Object.fromEntries(
        HELD_AT_100.map((glob) => [
          glob,
          { statements: 100, branches: 100, functions: 100, lines: 100 },
        ]),
      ),
    },
  },
});
