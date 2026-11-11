'use client';

import { CanvasFocusProvider } from '@/hooks/canvas/useCanvasFocus';
import dynamic from 'next/dynamic';
import { CommentBadgesContext } from '@liveworkspace/workbench/components/canvas/CommentBadgesContext';
import { SuppressElementIndicators } from '@/components/canvas/ElementIndicatorStyleContext';
import { NewVersionPrompt } from '@/components/chrome/NewVersionPrompt';
import { registerUnsavedWork } from '@liveworkspace/workbench/lib/unsaved-work';
import { useRegionCycle } from '@liveworkspace/workbench/hooks/ui/useRegionCycle';
import { useEffect } from 'react';
import { canvasSurface } from '@liveplanner/project';
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
import { PlanProvider } from '@/components/plan/PlanContext';
import {
  CardThreadsProvider,
  ThreadCountsProvider,
} from '@/components/plan/threads/CardThreadsContext';
import { useCardThreadsValue } from '@/components/plan/threads/useCardThreadsValue';
import { FormBoardContext } from '@/components/forms/form-board-context';
import { useFormBoardValue } from '@/hooks/forms/useFormBoardValue';
import { SheetsProviders } from '@/hooks/sheets/sheet-comments-context';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { WorkbenchReconnectLine } from '@/components/chrome/WorkbenchChrome';

import { LandscapeBarsHandle } from '@/components/chrome/LandscapeBars';
import { useLandscapeBars } from '@/hooks/ui/useLandscapeBars';
import { SplitViewFrame } from '@/components/split/SplitViewFrame';
import { SignInBanner } from '@/components/chrome/SignInBanner';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { CollaboratorsHost } from '@/components/dialogs/CollaboratorsHost';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { EditorTours } from '@/components/tour/EditorTours';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { ModifierHint } from '@/components/chrome/ModifierHintBanner';
import { loadEditorSearchPanel } from '@/lib/editor-deferred-code';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import { AutomationsHost } from '@/components/automations/AutomationsHost';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from './EditorContext';
import { renderEditorHeader, renderEditorTabBar } from './EditorViewBars';
import {
  useCanvasPattern,
  useEditorAutomations,
  useHeaderCommunity,
  useSignInNudge,
} from './editor-view-hooks';
import { useSelectTab } from './useSelectTab';
import { useRoleIndicator } from './useRoleIndicator';
import {
  UiScaleProvider,
  useUiScalePreview,
} from '@liveworkspace/workbench/components/providers/ui-scale';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { CursorsDrawnContext } from '@liveworkspace/workbench/hooks/collab/useHideCursors';
import { planHidesCursors } from '@/lib/plan-cursors';
import { resolveUiScales } from '@liveworkspace/workbench/lib/ui-scale';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { EditorStartPanels } from '@/components/start/EditorStartPanels';

// Loaded when first drawn (docs/specs/016-platform/web-performance.md): search while it is open. Its code is
// fetched once the editor is idle (EDITOR_SURFACE_CODE), so opening it does not wait.
const EditorSearchPanel = dynamic(loadEditorSearchPanel, { ssr: false });
// Only a Community link's view draws it, so it stays off every other open's first load.
const CommunityBar = dynamic(
  () => import('@liveworkspace/community-ui/community-bar').then((m) => m.CommunityBar),
  { ssr: false },
);
// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a project without
// Plan pays nothing for it.
const PlanSheetsHost = dynamic(
  () => import('@/components/plan/PlanSheetsHost').then((m) => m.PlanSheetsHost),
  { ssr: false },
);

// The editor's full view (header + canvas + tab bar + all dialogs),
// lifted out of editor-page.tsx. Every value/handler it needs is read
// from EditorContext (provided by the page), so the page no longer
// threads ~150 props through this JSX. The JSX is verbatim; only its
// scope changed from the page's locals to the destructured context.
export function EditorView() {
  const ctx = useEditorContext();
  // Offline Mode (docs/specs/006-project/offline-mode.md): a project saved only in this browser. Drives the
  // "This Browser" header badge and hides server-only actions (Share).
  const isOffline = useIsOfflineProject(ctx.projectId);
  // A card's comment threads (docs/specs/026-plan/items.md "Comments"): their own context, so a thread write
  // re-renders the open card panel alone, and the faces' counts through the thread store.
  const cardThreadsValue = useCardThreadsValue({
    threads: ctx.cardThreads,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    ownerId: ctx.selfParticipant.id,
    self: ctx.plan.context.self,
    selfKey: ctx.voteSelfId,
    canComment: ctx.cardThreadsAccess.canComment,
    isEditor: ctx.cardThreadsAccess.isEditor,
    openCard: ctx.plan.context.openItem,
    announce: ctx.plan.context.announce,
  });
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
    drag,
    accountUserId,
    copying,
    projectName,
    hydrated,
    isReadOnly,
    makeCopy,
    sessionShareCode,
    renameProjectNonce,
    renameTabNonce,
    tabs,
    userPreferences,
    sessionCommunity,
  } = ctx;
  // The header's Community state, and a Community link's `?copy=1` (editor-view-hooks).
  const headerCommunity = useHeaderCommunity(ctx);
  // UI scale (docs/specs/007-editor/ui-scale.md): desktop only, so a phone resolves to 1.
  // While a Settings slider is dragged its patch wins, so the chrome resizes
  // as you go; the preference is written once, on release.
  const uiScalePreview = useUiScalePreview();
  const isMobileViewport = useIsMobileViewport();
  const uiScales = resolveUiScales(
    uiScalePreview === null ? userPreferences : { ...userPreferences, ...uiScalePreview },
    { mobile: isMobileViewport },
  );
  const role = useRoleIndicator();

  const selectTab = useSelectTab();
  // A board's Form strip (docs/specs/030-forms/forms.md "On the board"): the forms feeding the open tab.
  const formBoard = useFormBoardValue({
    tabs,
    activeTabId: activeTab.id,
    projectId: ctx.projectId,
    ownerId: ctx.selfParticipant.id,
    share: ctx.sessionShareCode,
    online: !isOffline,
    canShare: ctx.can.level === 'edit',
    openTab: selectTab,
  });
  // Contextual command palette for the SearchPanel "Actions" group (docs/specs/008-canvas/canvas-and-palette.md):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the project (docs/specs/011-theme/canvas-and-theme-dialog.md).
  // One look in both editor modes (docs/specs/007-editor/editor-modes.md "One look"), so the accent
  // follows the tab's theme in Draw mode too.
  useEditorAccent(activeTab.theme);
  // The viewer's own light / dark chrome (docs/specs/007-editor/editor-app.md). Read here because the
  // Default theme resolves through it — see the canvas surface below.
  const { appearance } = useAppearance();
  // The guest sign-in nudge, delayed into the session (editor-view-hooks).
  const { showSignInBanner, dismissSignIn } = useSignInNudge(ctx);
  const backdrop = resolveViewBackdrop(activeTab, appearance);
  const cursorsDrawn = !planHidesCursors(activeTab);
  // One value while the style holds, so the covers reading it stay quiet as the editor re-renders.
  const canvasPattern = useCanvasPattern(activeTab, backdrop);

  // A phone held sideways folds the header and the tab bar (docs/specs/007-editor/editor-app.md "A phone
  // held sideways"); a rename asked for elsewhere shows them first, so its field can take the focus.
  const landscapeBars = useLandscapeBars([renameProjectNonce, renameTabNonce]);

  // The site header and the tab bar, its footer (EditorViewBars), or null where they are hidden.
  const header = renderEditorHeader(ctx, {
    isOffline,
    headerCommunity,
    role,
    barsShown: landscapeBars.shown,
  });
  const footer = renderEditorTabBar(ctx, { isOffline, selectTab, barsShown: landscapeBars.shown });
  // The bars handle, at the canvas's top-right corner: only on a phone held sideways (CSS), and only
  // where there are bars to fold (not in zen, an embed, the workbench frame or the welcome flow).
  const landscapeBarsHandle =
    header && footer ? (
      <LandscapeBarsHandle shown={landscapeBars.shown} onToggle={landscapeBars.toggle} />
    ) : null;

  // Automations' scope and gate (editor-view-hooks).
  const { automationsScope, automationsGate } = useEditorAutomations(ctx, isOffline);

  return (
    // Which paper the canvas is, for every element that carries no colour of
    // its own (docs/specs/007-editor/editor-app.md). Read HERE, above both the canvas and the element
    // menus, so a swatch in a menu can't disagree with the shape it describes.
    // Subscribing to the appearance is what re-renders this on a mode switch:
    // a Default tab's paper is the viewer's, not the tab's.
    // Only a Dashboard draws participant cursors (plan-cursors.ts), so only there do Settings, the Collaborators
    // modal and search offer Hide Participant Cursors (docs/specs/012-collaboration/collaborator-enhancements.md).
    <AutomationsHost
      scope={automationsScope}
      plan={ctx.plan.context}
      gate={automationsGate}
      planName={projectName}
      signedIn={!!accountUserId}
    >
      <CursorsDrawnContext.Provider value={cursorsDrawn}>
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
                  {/* Plan boards and cards, and the dialogs that draw them (exports), read the items and
              their actions here (docs/specs/026-plan/plan-board.md). */}
                  <PlanProvider value={ctx.plan.context}>
                    <ThreadCountsProvider value={ctx.cardThreads.store}>
                      <CardThreadsProvider value={cardThreadsValue}>
                        <FormBoardContext.Provider value={formBoard}>
                          {/* The sheets bridge, and cell comments (docs/specs/029-sheets/sheet.md "Cell comments"): every Sheet
                opens its cells' threads through the editor's one comment popover. */}
                          <SheetsProviders
                            bridge={ctx.sheetsBridge}
                            openComments={ctx.openComments}
                            openId={ctx.commentThreadOpenId}
                            openCell={ctx.commentThreadOpenCell}
                            canComment={ctx.can.takePart}
                          >
                            <CanvasFocusProvider value={ctx.focusBounds}>
                              <UiScaleProvider value={uiScales}>
                                <DockNamesProvider
                                  value={userPreferences?.dockButtonNames !== false}
                                >
                                  {/* Side by side tabs (docs/specs/007-editor/split-view.md): the editor, and another
                      tab of the project live beside it when one has been dragged to the right. */}
                                  <SplitViewFrame header={header} footer={footer}>
                                    {(headerInColumn, footerInColumn) => (
                                      <div className="flex h-dvh flex-col">
                                        {headerInColumn}
                                        {sessionCommunity && appChrome && hydrated ? (
                                          <CommunityBar
                                            community={sessionCommunity}
                                            own={
                                              sessionCommunity.ownProjectId
                                                ? {
                                                    href: `/project/${encodeURIComponent(sessionCommunity.ownProjectId)}`,
                                                    label: 'Edit Your Plan',
                                                  }
                                                : null
                                            }
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
                                          <ChangesetRevealContext.Provider
                                            value={ctx.changesetReveals}
                                          >
                                            {/* The focus rings of the agents present (docs/specs/024-agents/agent-presence.md). */}
                                            <AgentFocusContext.Provider
                                              value={ctx.agentFocusByElement}
                                            >
                                              {/* No comment badges for a viewer in an embed (docs/specs/013-workspace/embeds.md),
                                                nor for a Community visitor (docs/specs/025-community/community.md). */}
                                              <CommentBadgesContext.Provider
                                                value={
                                                  !(embedMode && isReadOnly) && !sessionCommunity
                                                }
                                              >
                                                {/* Indicators are editor chrome: an embed never draws them (docs/specs/008-canvas/element-indicators.md). */}
                                                {/* A connected tab's page stands in the board's place (connected-tabs.md), once a visitor's name prompt (drawn by the canvas host) is answered. */}
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
                                          {ctx.plan.openItemId ||
                                          ctx.plan.editingType ||
                                          ctx.plan.requiredFields ? (
                                            // Its own boundary: a card opened offline before this code came
                                            // must not take the board with it (load-recovery.md "Offline").
                                            <AreaErrorBoundary area="Modals">
                                              <PlanSheetsHost plan={ctx.plan} />
                                            </AreaErrorBoundary>
                                          ) : null}
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
                                          // The workbench's Reconnect line; its Open in liveplanner sits in the tab bar.
                                          <WorkbenchReconnectLine
                                            workbenchName={workbench.workbenchName}
                                            ended={workbench.ended}
                                          />
                                        ) : null}
                                        {footerInColumn}
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
                                        {/* Interactive editor tour (docs/specs/007-editor/editor-tour.md): renders nothing unless the /new
          wizard's "Show me around" handoff flag is pending. */}
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
                                        />

                                        {/* An editor older than the server's project format offers a reload, once its edits
            are saved (docs/specs/016-platform/new-version-prompt.md). */}
                                        <NewVersionPrompt
                                          hasUnsavedChanges={ctx.hasUnsavedChanges}
                                        />
                                      </div>
                                    )}
                                  </SplitViewFrame>
                                </DockNamesProvider>
                              </UiScaleProvider>
                            </CanvasFocusProvider>
                          </SheetsProviders>
                        </FormBoardContext.Provider>
                      </CardThreadsProvider>
                    </ThreadCountsProvider>
                  </PlanProvider>
                </CanvasFinishProvider>
              </CanvasPatternContext.Provider>
            </CanvasSurfaceProvider>
          </ViewportStoreProvider>
        </SelectionStoreProvider>
      </CursorsDrawnContext.Provider>
    </AutomationsHost>
  );
}
