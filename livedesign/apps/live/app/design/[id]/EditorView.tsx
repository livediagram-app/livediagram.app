'use client';

import { usePublishDesignVisibility } from '@/hooks/editor/design-visibility-store';
import dynamic from 'next/dynamic';
import { CommentBadgesContext } from '@liveworkspace/workbench/components/canvas/CommentBadgesContext';
import { SuppressElementIndicators } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { track } from '@/lib/telemetry';
import { NewVersionPrompt } from '@/components/chrome/NewVersionPrompt';
import { registerUnsavedWork } from '@liveworkspace/workbench/lib/unsaved-work';
import { useRegionCycle } from '@liveworkspace/workbench/hooks/ui/useRegionCycle';
import { useEffect, useMemo } from 'react';
import { canvasSurface } from '@livedesign/design';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { CanvasPatternContext } from '@/components/canvas/canvas-pattern-context';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { CanvasFinishProvider } from '@/components/canvas/CanvasFinishContext';
import { SketchFilterDefs } from '@/components/canvas/SketchFilterDefs';
import { ChangesetRevealContext } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusContext } from '@/components/canvas/AgentFocusOverlay';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { EditorCanvasHost } from '@/components/canvas/EditorCanvasHost';
import { ConnectedTabHost } from '@/components/connect/ConnectedTabHost';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import { API_BASE } from '@/lib/api-client';
import { useAutoCopyParam } from '@liveworkspace/workbench/hooks/canvas/useAutoCopyParam';
import { designIsPublic } from '@/lib/community-public';
import { useCommunityState } from '@/lib/community-state-store';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { WorkbenchReconnectLine } from '@/components/chrome/WorkbenchChrome';

import { LandscapeBarsHandle } from '@/components/chrome/LandscapeBars';
import { useLandscapeBars } from '@/hooks/ui/useLandscapeBars';
import { SplitViewFrame } from '@/components/split/SplitViewFrame';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { CollaboratorsHost } from '@/components/dialogs/CollaboratorsHost';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { EditorTours } from '@/components/tour/EditorTours';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { ModifierHint } from '@/components/chrome/ModifierHintBanner';
import { loadEditorSearchPanel } from '@/lib/editor-deferred-code';
import { useSignInNudge } from '@liveworkspace/workbench/hooks/ui/useSignInNudge';
import { useIsOfflineDesign } from '@/hooks/persistence/useIsOfflineDesign';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from './EditorContext';
import { editorViewFooter, editorViewHeader } from './editor-view-bars';
import { useSelectTab } from './useSelectTab';
import { useRoleIndicator } from './useRoleIndicator';
import { UiScaleProvider } from '@liveworkspace/workbench/components/providers/ui-scale';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { useEditorUiScales } from '@liveworkspace/workbench/hooks/ui/useEditorUiScales';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { QuickStyleHost } from '@/components/canvas/QuickStyleHost';
import { panelEnabled } from '@/lib/user-preferences';
import { EditorStartPanels } from '@/components/start/EditorStartPanels';

// Loaded when first drawn (docs/specs/016-platform/web-performance.md): search while it is open. Its code is
// fetched once the editor is idle (EDITOR_SURFACE_CODE), so opening it does not wait.
const EditorSearchPanel = dynamic(loadEditorSearchPanel, { ssr: false });
// Only a Community link's view draws it, so it stays off every other open's first load.
const CommunityBar = dynamic(
  () => import('@/components/chrome/CommunityBar').then((m) => m.CommunityBar),
  { ssr: false },
);

// The editor's full view (header + canvas + tab bar + all dialogs),
// lifted out of editor-page.tsx. Every value/handler it needs is read
// from EditorContext (provided by the page), so the page no longer
// threads ~150 props through this JSX. The JSX is verbatim; only its
// scope changed from the page's locals to the destructured context.
export function EditorView() {
  const ctx = useEditorContext();
  // Offline Mode (docs/specs/006-design/offline-mode.md): a design saved only in this browser. Drives the
  // "This Browser" header badge and hides server-only actions (Share).
  const isOffline = useIsOfflineDesign(ctx.designId);
  // A full page load the app starts itself (a stale build, a chunk recovery) waits for these edits
  // to be saved (docs/specs/016-platform/stale-builds.md).
  const { hasUnsavedChanges } = ctx;
  useEffect(() => registerUnsavedWork(hasUnsavedChanges), [hasUnsavedChanges]);
  // F6 moves between the header, palette, canvas, controls and tab bar (canvas-accessibility.md).
  useRegionCycle();
  const {
    activeId,
    activeTab,
    anyWelcomeOpen,
    embedMode,
    // The app's surroundings, and the workbench session (docs/specs/013-workspace/blueprints/
    // workbench-embeds.md, Surface table).
    appChrome,
    workbench,
    quickStyleDeps,
    canvasTool,
    drag,
    accountUserId,
    contextMenu,
    copying,
    designId,
    designShareable,
    designTeamId,
    formatSourceId,
    hydrated,
    canShareDesign,
    isReadOnly,
    makeCopy,
    pendingDraw,
    connectSourceId,
    cancelConnect,
    sessionShareCode,
    setShareDialogOpen,
    renameDesignNonce,
    renameTabNonce,
    tabs,
    zenMode,
    userPreferences,
    sessionCommunity,
  } = ctx;
  // The header badge follows the design's Community post (docs/specs/025-community/community.md "Publishing").
  const communityState = useCommunityState(designId);
  // The badge goes too while the Community is switched off. Asked only while there is a listed post to badge, and
  // never in an embed, so other opens make no request.
  const communityOn = useCommunityEnabled(API_BASE, communityState === 'listed' && appChrome);
  // `?copy=1` from the Community's Make a Copy (docs/specs/025-community/community.md "Viewing a post's design").
  useAutoCopyParam({
    hydrated,
    sessionShareCode,
    // The author's own post copies nothing: their bar offers Edit Your Design instead.
    community: sessionCommunity !== null && !sessionCommunity.ownDesignId,
    makeCopy,
  });
  // Whether the design shows as public on the Community, for the header's share state.
  const headerCommunity = designIsPublic({
    communityOn,
    ownPostState: communityState,
    communitySession: sessionCommunity !== null,
  });
  // UI scale (docs/specs/007-editor/ui-scale.md): desktop only, and a dragged Settings slider's patch wins.
  const { uiScales } = useEditorUiScales(userPreferences);
  const role = useRoleIndicator();

  const selectTab = useSelectTab();
  // Contextual command palette for the SearchPanel "Actions" group (docs/specs/008-canvas/canvas-and-palette.md):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the design (docs/specs/011-theme/canvas-and-theme-dialog.md).
  useEditorAccent(activeTab.theme);
  // The viewer's own light / dark chrome (docs/specs/007-editor/live-app.md). Read here because the
  // Default theme resolves through it — see the canvas surface below.
  const { appearance } = useAppearance();
  // Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md), delayed into the session.
  const { showSignInBanner, dismissSignIn } = useSignInNudge({
    dismissKey: SIGNIN_BANNER_DISMISS_KEY,
    accountUserId,
    appChrome,
    hidden: zenMode,
  });
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  // One value while the style holds, so the covers reading it stay quiet as the editor re-renders.
  const patternScale = activeTab.backgroundPatternScale ?? 1;
  const patternSpeed = activeTab.backgroundAnimationSpeed ?? 1;
  const canvasPattern = useMemo(
    () => ({
      pattern: backdrop.backgroundPattern ?? 'grid',
      color: backdrop.patternColor,
      scale: patternScale,
      speed: patternSpeed,
      opacity: backdrop.backgroundOpacity ?? 1,
    }),
    [
      backdrop.backgroundPattern,
      backdrop.patternColor,
      backdrop.backgroundOpacity,
      patternScale,
      patternSpeed,
    ],
  );

  // The same visibility for the Explorer panel's Current Design card (design-visibility-store).
  usePublishDesignVisibility(
    designShareable,
    !!designTeamId,
    isOffline,
    canShareDesign && hydrated
      ? () => {
          setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }
      : undefined,
  );

  // A phone held sideways folds the header and the tab bar (docs/specs/007-editor/live-app.md "A phone
  // held sideways"); a rename asked for elsewhere shows them first, so its field can take the focus.
  const landscapeBars = useLandscapeBars([renameDesignNonce, renameTabNonce]);

  // The site header and the tab bar (editor-view-bars.tsx). Side by side (docs/specs/007-editor/split-view.md)
  // lays them across both panes.
  const header = editorViewHeader(ctx, {
    isOffline,
    headerCommunity,
    role,
    landscapeShown: landscapeBars.shown,
  });
  const footer = editorViewFooter(ctx, {
    isOffline,
    selectTab,
    landscapeShown: landscapeBars.shown,
  });

  // The bars handle, at the canvas's top-right corner: only on a phone held sideways (CSS), and only
  // where there are bars to fold (not in zen, an embed, the workbench frame or the welcome flow).
  const landscapeBarsHandle =
    header && footer ? (
      <LandscapeBarsHandle shown={landscapeBars.shown} onToggle={landscapeBars.toggle} />
    ) : null;

  return (
    // Which paper the canvas is, for every element that carries no colour of
    // its own (docs/specs/007-editor/live-app.md). Read HERE, above both the canvas and the element
    // menus, so a swatch in a menu can't disagree with the shape it describes.
    // Subscribing to the appearance is what re-renders this on a mode switch:
    // a Default tab's paper is the viewer's, not the tab's.
    <SelectionStoreProvider store={ctx.selectionStore}>
      <ViewportStoreProvider store={ctx.viewport}>
        <CanvasSurfaceProvider surface={canvasSurface(backdrop.backgroundColor)}>
          {/* The canvas style, for the pages that cover the canvas and must draw its motion themselves. */}
          <CanvasPatternContext.Provider value={canvasPattern}>
            {/* The active tab's finish (docs/specs/008-canvas/finish.md), for the menus and panels; each
              canvas provides its own tab's again. */}
            <CanvasFinishProvider finish={activeTab.finish}>
              {/* The wobble Sketch palette tiles are drawn through (palette-tile-finish.ts). */}
              <SketchFilterDefs />
              <UiScaleProvider value={uiScales}>
                <DockNamesProvider value={userPreferences?.dockButtonNames !== false}>
                  <EditorModeProvider value={ctx.editorMode}>
                    {/* Side by side tabs (docs/specs/007-editor/split-view.md): the editor, and another
                      tab of the design live beside it when one has been dragged to the right. */}
                    <SplitViewFrame header={header} footer={footer}>
                      {(headerInColumn, footerInColumn, splitShowing) => (
                        <div
                          // The open tab's editor mode, for the e2e helpers (e2e/fixtures.ts).
                          data-editor-mode={ctx.editorMode.mode}
                          className="flex h-dvh flex-col"
                        >
                          {/* Arrow click-to-connect hint (docs/specs/008-canvas/canvas-and-palette.md): shown while the gesture
          is armed so the user knows the next shape click connects, and
          gives a click target to cancel (clicking empty canvas also
          cancels). */}
                          {connectSourceId !== null ? (
                            <div className="pointer-events-none fixed inset-x-0 top-16 z-[var(--z-modal)] flex justify-center">
                              <button
                                type="button"
                                onClick={cancelConnect}
                                className="pointer-events-auto flex items-center gap-2 rounded-full border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200"
                              >
                                Click a shape to connect the arrow
                                <span className="text-brand-300" aria-hidden>
                                  |
                                </span>
                                <span className="text-brand-700 dark:text-brand-300">Cancel</span>
                              </button>
                            </div>
                          ) : null}
                          {headerInColumn}
                          {sessionCommunity && appChrome && hydrated ? (
                            <CommunityBar
                              community={sessionCommunity}
                              onMakeCopy={() => void makeCopy()}
                              copying={copying}
                            />
                          ) : null}
                          <AreaErrorBoundary area="TabDialogs">
                            <EditorTabDialogs />
                          </AreaErrorBoundary>
                          <AreaErrorBoundary area="Collaborators">
                            <CollaboratorsHost />
                          </AreaErrorBoundary>
                          {/* At the canvas's top edge, under the header and any Community bar. */}
                          {landscapeBarsHandle}
                          <AreaErrorBoundary
                            area="Canvas"
                            fallback="panel"
                            fallbackClassName="flex-1"
                          >
                            {/* The outlines relayed changesets draw (docs/specs/024-agents/agent-changesets.md). */}
                            <ChangesetRevealContext.Provider value={ctx.changesetReveals}>
                              {/* The focus rings of the agents present (docs/specs/024-agents/agent-presence.md). */}
                              <AgentFocusContext.Provider value={ctx.agentFocusByElement}>
                                {/* No comment badges for a viewer in an embed (docs/specs/013-workspace/embeds.md). */}
                                {/* Nor for a Community visitor (docs/specs/025-community/community.md). */}
                                <CommentBadgesContext.Provider
                                  value={!(embedMode && isReadOnly) && !sessionCommunity}
                                >
                                  {/* Indicators are editor chrome: an embed never draws them (docs/specs/008-canvas/element-indicators.md). */}
                                  {/* A connected tab's page stands in the canvas's place (connected-tabs.md), once a visitor's name prompt (drawn by the canvas host) is answered. */}
                                  {ctx.activeTabConnected && !anyWelcomeOpen ? (
                                    <ConnectedTabHost />
                                  ) : (
                                    <SuppressElementIndicators when={embedMode}>
                                      <EditorCanvasHost />
                                    </SuppressElementIndicators>
                                  )}
                                </CommentBadgesContext.Provider>
                              </AgentFocusContext.Provider>
                            </ChangesetRevealContext.Provider>
                          </AreaErrorBoundary>
                          {embedMode ? (
                            // Embed chrome (docs/specs/013-workspace/embeds.md): the link-out badge + a minimal tab
                            // switcher replace the full TabBar. Same selection clears as
                            // the TabBar's onSelect so element state never leaks across a
                            // tab switch.
                            <EmbedChrome
                              tabs={tabs}
                              activeId={activeId}
                              shareCode={sessionShareCode}
                              onSelectTab={selectTab}
                            />
                          ) : null}
                          {workbench ? (
                            // The workbench's Reconnect line; its Open in livedesign sits in the tab bar.
                            <WorkbenchReconnectLine
                              workbenchName={workbench.workbenchName}
                              ended={workbench.ended}
                            />
                          ) : null}
                          {footerInColumn}
                          {/* Quick Style bar (docs/specs/008-canvas/quick-style-panel.md): the most-used style choices beside
              the selection's page title bar. Stands down in zen / embeds and while an
              element menu is open, which is the complete home of every setting. */}
                          <AreaErrorBoundary area="QuickStyle">
                            <QuickStyleHost
                              deps={quickStyleDeps}
                              hidden={
                                // Not beside another tab (docs/specs/007-editor/split-view.md): half a window has
                                // no room for it beside a page's title bar.
                                splitShowing ||
                                zenMode ||
                                embedMode ||
                                // Off in Settings (docs/specs/007-editor/user-preferences.md); style memory stays.
                                !panelEnabled(userPreferences, 'quickStylePanelEnabled') ||
                                (contextMenu !== null && contextMenu.mode !== 'canvas')
                              }
                            />
                          </AreaErrorBoundary>
                          {ctx.searchOpen ? (
                            <AreaErrorBoundary area="Search">
                              <EditorSearchPanel />
                            </AreaErrorBoundary>
                          ) : null}
                          <AreaErrorBoundary area="Modals">
                            <EditorModals />
                          </AreaErrorBoundary>
                          <AreaErrorBoundary area="Popovers">
                            <EditorAnchoredPopovers />
                          </AreaErrorBoundary>
                          <AreaErrorBoundary area="ContextMenu">
                            <EditorContextMenuHost />
                          </AreaErrorBoundary>
                          <AreaErrorBoundary area="ElementDialogs">
                            <EditorElementDialogs />
                          </AreaErrorBoundary>
                          {/* The editor's tours, the Pages tour and the element tours (docs/specs/007-editor/pages-tour.md,
          element-tours.md): each renders nothing until its offer is due. */}
                          <AreaErrorBoundary area="Tour">
                            <EditorTours />
                          </AreaErrorBoundary>

                          {/* Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md), delayed ~5 min. Stands on
          the bottom chrome (the tab bar, the Undo / session cluster, the dock) rather than over it, above the canvas
          (z-[var(--z-overlay)]). */}
                          {showSignInBanner ? (
                            <SignInBanner
                              surface="Editor"
                              onDismiss={dismissSignIn}
                              placementClassName="z-[var(--z-overlay)]"
                              standOnChrome
                            />
                          ) : null}
                          <EditorStartPanels />

                          {/* Modifier hint (docs/specs/008-canvas/canvas-and-palette.md): names what holding Shift does
          right now. Suppressed while a mode banner owns the top slot. */}
                          <ModifierHint
                            readOnly={isReadOnly}
                            drag={drag}
                            elements={activeTab.elements}
                            hasElements={activeTab.elements.length > 0}
                            suppressed={
                              canvasTool === 'format' ||
                              formatSourceId !== null ||
                              pendingDraw !== null
                            }
                          />

                          {/* An editor older than the server's design format offers a reload, once its edits
            are saved (docs/specs/016-platform/new-version-prompt.md). */}
                          <NewVersionPrompt hasUnsavedChanges={ctx.hasUnsavedChanges} />
                        </div>
                      )}
                    </SplitViewFrame>
                  </EditorModeProvider>
                </DockNamesProvider>
              </UiScaleProvider>
            </CanvasFinishProvider>
          </CanvasPatternContext.Provider>
        </CanvasSurfaceProvider>
      </ViewportStoreProvider>
    </SelectionStoreProvider>
  );
}
