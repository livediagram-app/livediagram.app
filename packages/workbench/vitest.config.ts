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
  'src/lib/api/tab-delta-save.ts',
  'src/lib/api/xhr-fetch.ts',
  'src/components/start/StartPanel.tsx',
  'src/lib/canvas-backgrounds.ts',
  'src/lib/tab-looks.ts',
  'src/lib/editor-viewport-defaults.ts',
  'src/components/canvas/label-align.ts',
  'src/components/dialogs/export-tab-dialog.tsx',
  'src/lib/tab-export-name.ts',
  'src/hooks/ui/useEditorUiScales.ts',
  'src/hooks/ui/useSignInNudge.ts',
  'src/hooks/ui/useBackOutOnRestore.ts',
  'src/hooks/persistence/useResolveSelf.ts',
  'src/hooks/canvas/useCanvasSurfaceGestures.ts',
  'src/hooks/canvas/useFocusCanvasOnMount.ts',
  // The selection toolbar's placement every editor's FloatingToolbar and SelectionPopover share
  // (docs/specs/008-canvas/canvas-performance.md "A gesture frame never reads layout after writing it").
  'src/hooks/canvas/useEdgeAwarePlacement.ts',
  // The dot-vote overlay livediagram and liveplanner both mount (docs/specs/012-collaboration/session-tools.md).
  'src/components/canvas/ElementVoteOverlay.tsx',
  'src/components/canvas/VoteStepper.tsx',
  'src/components/canvas/VoteDot.tsx',
  'src/components/canvas/vote-badge.ts',
  // The new version prompt all five editors bind (docs/specs/016-platform/new-version-prompt.md).
  'src/components/chrome/NewVersionPrompt.tsx',
  'src/hooks/ui/useNewerEditorLive.ts',
  'src/lib/live-editor-build.ts',
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
