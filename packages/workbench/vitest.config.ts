import { defineProject } from '@liveworkspace/vitest-config';

// Node stays the DEFAULT environment, as in the editors: a test that renders a hook or component
// opts in per file with a `// @vitest-environment jsdom` docblock
// (docs/specs/003-system-architecture/testing.md in each product).
// Held at 100% file by file (per-glob thresholds, so neither is averaged away by the rest of the package, which has
// no gate yet): the shared Contents both livedocuments and livedesign mount, its sidebar and the hook behind it
// (docs/specs/007-editor/pages-mode.md "Contents" in each). The editors' door tests drive them with real pages; these
// gates keep the package's own tests covering every branch. A new file joins the list on the commit that adds it.
const HELD_AT_100 = [
  // Charts linked to a liveplanner sheet, the editors' one copy (each reader app's 009-elements pie-chart.md, Work
  // Tracker 940 and 1133).
  'src/components/sheet-links/sheet-links.ts',
  'src/components/sheet-links/sheet-link-signal.ts',
  'src/components/sheet-links/useSheetLinkedCharts.ts',
  'src/components/sheet-links/SheetLinkedCharts.tsx',
  'src/components/sheet-links/SheetLinkSection.tsx',
  'src/components/sheet-links/LinkSheetDialog.tsx',
  'src/lib/relative-now.ts',
  // Which side a menu flyout opens on (each product's 008-canvas canvas-and-palette.md, Work Tracker 961).
  'src/components/primitives/menu-flyout-side.ts',
  // A live embed's rules (liveworkspace/docs/specs/004-index/live-embeds.md, Work Tracker 930).
  'src/components/live-embed/live-embed-target.ts',
  'src/components/live-embed/live-embed-slots.ts',
  'src/components/live-embed/live-embed-ticket.ts',
  'src/components/live-embed/live-embed-words.ts',
  'src/components/live-embed/live-poster.ts',
  'src/components/live-embed/choose-live-embed.ts',
  'src/components/live-embed/useLiveEmbedFrame.ts',
  'src/components/canvas/PageContentsList.tsx',
  'src/components/canvas/PageContentsSidebar.tsx',
  'src/components/canvas/PageRowMenu.tsx',
  'src/lib/editor-arrival.ts',
  'src/lib/editor-path.ts',
  'src/lib/guard-run.ts',
  'src/lib/room-presence.ts',
  'src/hooks/ui/usePageContents.ts',
  'src/components/canvas/arrow-view-parts.tsx',
  'src/lib/editor-search/build-search-results.ts',
  'src/lib/api/core.ts',
  'src/lib/api/tab-delta-save.ts',
  'src/lib/api/tab-drafts.ts',
  'src/lib/api/tab-draft-store.ts',
  // The last seen copy a cloud item warm-opens from (Work Tracker 890).
  'src/lib/api/last-seen-copies.ts',
  'src/lib/api/last-seen-store.ts',
  'src/lib/api/last-seen-follower.ts',
  'src/hooks/persistence/useLastSeenFollow.ts',
  'src/lib/warm-open.ts',
  // The deferred-auth provider, whose bridge mounts as its code lands (Work Tracker 960).
  'src/components/providers/auth-provider.tsx',
  // The tab title an editor route holds (offline-mode.md "The tab title" in each product).
  'src/hooks/editor/useBrowserTabTitle.ts',
  'src/lib/api/tab-saved.ts',
  'src/hooks/persistence/useTabDrafts.ts',
  'src/lib/api/xhr-fetch.ts',
  'src/components/start/StartPanel.tsx',
  'src/lib/canvas-backgrounds.ts',
  'src/lib/tab-looks.ts',
  'src/lib/editor-viewport-defaults.ts',
  // A lane's gutter strip (docs/specs/009-elements/lane.md), drawn by livediagram's and liveplanner's canvases.
  'src/components/canvas/LaneGutterStrip.tsx',
  'src/components/canvas/upright-title.ts',
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
  // Escape on a start panel with the focus outside it (start-diagramming.md "Search", Work Tracker 1026).
  'src/components/start/useStartEscape.ts',
  // A toolbar moving without resizing, and the menu box's room beside the strip (toolbar-layout.md, Work Tracker
  // 1027 and 1038).
  'src/lib/watch-move.ts',
  'src/components/chrome/useMenuCardRoom.ts',
  // A selection toolbar re-placing as an obstacle arrives (Work Tracker 1032).
  'src/hooks/canvas/toolbar-obstacle.ts',
  // The menu box's uncapped edge (Work Tracker 1038).
  'src/components/canvas/menu-join.tsx',
  'src/components/chrome/menu-card-form.ts',
  // The dot-vote overlay livediagram and liveplanner both mount (docs/specs/012-collaboration/session-tools.md).
  'src/components/canvas/ElementVoteOverlay.tsx',
  'src/components/canvas/VoteStepper.tsx',
  'src/components/canvas/VoteDot.tsx',
  'src/components/canvas/vote-badge.ts',
  // The new version prompt all five editors bind (docs/specs/016-platform/new-version-prompt.md).
  'src/components/chrome/NewVersionPrompt.tsx',
  'src/hooks/ui/useNewerEditorLive.ts',
  'src/lib/live-editor-build.ts',
  // Round 12: editor copies the products held byte for byte, one home each.
  'src/hooks/collab/useFollowMe.ts',
  // The header, its visibility pill and the Settings host every editor carried a copy of.
  'src/components/chrome/EditorHeader.tsx',
  'src/components/chrome/SharedBadge.tsx',
  'src/components/chrome/share-states.tsx',
  'src/components/chrome/VisibilityLegend.tsx',
  'src/components/dialogs/EditorSettingsDialog.tsx',
  'src/lib/preferences-local-only.ts',
  // The account control and the Settings panel host, the last of the header's five copies.
  'src/components/chrome/AuthControls.tsx',
  'src/components/dialogs/settings/settings-panel-host.tsx',
  // The selection lock held until the holder's change lands, and the holds on our saves it reads, in every editor
  // (docs/specs/007-editor/editor-app.md "Held until the holder's change lands", Work Tracker 862).
  'src/lib/own-writes.ts',
  'src/lib/selection-write-hold.ts',
  'src/lib/remote-selection.ts',
  'src/components/comments/CommentMarks.tsx',
  // The palette's Icons category, icons and stickers in one (docs/specs/008-canvas/canvas-and-palette.md "Icons
  // category" in each editor).
  'src/components/palette/IconsCategoryTab.tsx',
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
