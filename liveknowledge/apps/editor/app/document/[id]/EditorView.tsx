'use client';
import { SendToPlanHost } from '@liveworkspace/workbench/components/send-to-plan/SendToPlanHost';
import { canSendToPlan } from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';

import { useAiSourceScope } from '@liveworkspace/workbench/components/ai/ai-source-scope';
import { usePublishDocumentVisibility } from '@/hooks/editor/document-visibility-store';
import dynamic from 'next/dynamic';
import { CommentBadgesContext } from '@liveworkspace/workbench/components/canvas/CommentBadgesContext';
import { SuppressElementIndicators } from '@liveworkspace/workbench/components/canvas/ElementIndicatorStyleContext';
import { track } from '@/lib/telemetry';
import { EditorNewVersionPrompt } from '@/components/chrome/NewVersionPrompt';
import { registerUnsavedWork } from '@liveworkspace/workbench/lib/unsaved-work';
import { useRegionCycle } from '@liveworkspace/workbench/hooks/ui/useRegionCycle';
import { useCallback, useEffect } from 'react';
import { canvasSurface } from '@liveknowledge/document';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { CanvasSurfaceProvider } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { CanvasFinishProvider } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { SketchFilterDefs } from '@/components/canvas/SketchFilterDefs';
import { ChangesetRevealContext } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusContext } from '@/components/canvas/AgentFocusOverlay';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { SheetLinksHost } from '@liveworkspace/workbench/components/sheet-links/SheetLinkedCharts';
import { documentGrant } from '@/lib/api/document-grants';
import type { SheetLinkEvent } from '@liveworkspace/workbench/components/sheet-links/SheetLinkedCharts';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { EditorCanvasHost } from '@/components/canvas/EditorCanvasHost';
import { PresentationHost } from '@/components/canvas/PresentationHost';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import { API_BASE } from '@/lib/api-client';
import { useAutoCopyParam } from '@liveworkspace/workbench/hooks/canvas/useAutoCopyParam';
import { documentIsPublic } from '@/lib/community-public';
import { useCommunityState } from '@/lib/community-state-store';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { WorkbenchReconnectLine } from '@/components/chrome/WorkbenchChrome';

import { LandscapeBarsHandle } from '@/components/chrome/LandscapeBars';
import { useLandscapeBars } from '@/hooks/ui/useLandscapeBars';
import { SplitViewFrame } from '@/components/split/SplitViewFrame';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { CollaboratorsHost } from '@/components/dialogs/CollaboratorsHost';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { EditorTours } from '@/components/tour/EditorTours';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { ModifierHint } from '@liveworkspace/workbench/components/chrome/ModifierHintBanner';
import { loadEditorSearchPanel } from '@/lib/editor-deferred-code';
import { useSignInToast } from '@liveworkspace/workbench/hooks/ui/useSignInToast';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useOfflineConversions } from '@/hooks/persistence/useOfflineConversion';
import { useVisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import { DocumentAutomationsHost } from '@/components/automations/DocumentAutomationsHost';
import { useDocumentAutomations } from '@/components/automations/use-document-automations';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useKnowledgeStyle } from '@/lib/knowledge-style/knowledge-style-store';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from './EditorContext';
import { EditorViewFooter, EditorViewHeader } from './editor-view-bars';
import {
  useEditorWalkthroughs,
  WalkthroughsLayer,
  WalkthroughsTools,
} from '@liveworkspace/walkthrough';
import { useSelectTab } from './useSelectTab';
import { UiScaleProvider } from '@liveworkspace/workbench/components/providers/ui-scale';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { useEditorUiScales } from '@liveworkspace/workbench/hooks/ui/useEditorUiScales';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { QuickStyleHost } from '@/components/canvas/QuickStyleHost';
import { panelEnabled } from '@/lib/user-preferences';
import { EditorStartPanels } from '@/components/start/EditorStartPanels';
import { EditorFindHost } from '@/components/find/FindHost';
import { KnowledgeViewAnchor, KnowledgeViewHost } from '@/components/ask/KnowledgeViewHost';
import { VersionHistoryHost } from '@/components/versions/VersionHistoryHost';
import { SnapshotsDoorProvider, useEditorSnapshotsDoor } from '@liveworkspace/snapshots/ui';
import {
  ApprovalBanner,
  ApprovalDoorProvider,
  useEditorApprovalDoor,
} from '@liveworkspace/explorer/approvals';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { apiTeamMembers } from '@/lib/api/team-people';
import {
  API_BASE as ITEM_API_BASE,
  apiFetch as itemApiFetch,
  apiHeaders as itemApiHeaders,
} from '@/lib/api/core';

// Loaded when first drawn (docs/specs/016-platform/web-performance.md): search while it is open. Its code is
// fetched once the editor is idle (EDITOR_SURFACE_CODE), so opening it does not wait.
const EditorSearchPanel = dynamic(loadEditorSearchPanel, { ssr: false });

// Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md): what this editor hands the shared host,
// stable so its context is too. The document's grant asks the plan to say when a Sheet changes; each event is its own
// literal telemetry call.
const sheetLinkGrantOf = async (itemId: string): Promise<string | null> =>
  (await documentGrant(itemId))?.grant ?? null;
const trackSheetLink = (event: SheetLinkEvent): void =>
  event === 'ChartSheetLink'
    ? track('Element', 'Changed', 'ChartSheetLink')
    : track('Element', 'Changed', 'ChartSheetUnlink');
// Only a Community link's view draws it, so it stays off every other open's first load.
const CommunityBar = dynamic(
  () => import('@/components/chrome/CommunityBar').then((m) => m.CommunityBar),
  { ssr: false },
);

// The editor's hosts that read no document (docs/specs/007-editor/blueprints/typing.md "Performance and
// limits"): made once, so the view's render (each typing commit) passes them over. Each renders only when what it
// reads changes: whether its dialog is open (the chrome store), or its own context.
const TAB_DIALOGS = (
  <AreaErrorBoundary area="TabDialogs">
    <EditorTabDialogs />
  </AreaErrorBoundary>
);
const COLLABORATORS = (
  <AreaErrorBoundary area="Collaborators">
    <CollaboratorsHost />
  </AreaErrorBoundary>
);
// Presenting (docs/specs/012-collaboration/presentation-mode.md) renders over everything and takes the keyboard.
// Nothing at all when no deck is running.
const PRESENTATION = (
  <AreaErrorBoundary area="Presentation">
    <PresentationHost />
  </AreaErrorBoundary>
);
const MODALS = (
  <>
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
  </>
);
// The editor's Get Started tours (docs/specs/007-editor/knowledge-tours.md): nothing on screen until one is picked.
const TOURS = (
  <AreaErrorBoundary area="Tour">
    <EditorTours />
  </AreaErrorBoundary>
);
const START_PANELS = <EditorStartPanels />;
// Ask and AI Knowledge (docs/specs/030-knowledgebase/search-and-ask.md "The three views"): the mark a view starts
// under, and the view drawn over the editor while the address names one.
const KNOWLEDGE_VIEW_ANCHOR = <KnowledgeViewAnchor />;
const KNOWLEDGE_VIEW = <KnowledgeViewHost />;
// An editor older than the server's document format offers a reload, once its edits are saved
// (docs/specs/016-platform/new-version-prompt.md). It reads the unsaved state from the chrome store, so the view's
// renders never reach it.
const NEW_VERSION_PROMPT = <EditorNewVersionPrompt />;

// A knowledgebase's walkthrough moves through its pages, not round a canvas.
const WALKTHROUGH_WORDS = { item: 'knowledgebase', moving: 'move through its pages' };

// The editor's full view (header + canvas + tab bar + all dialogs),
// lifted out of editor-page.tsx. Every value/handler it needs is read
// from EditorContext (provided by the page), so the page no longer
// threads ~150 props through this JSX. The JSX is verbatim; only its
// scope changed from the page's locals to the destructured context.

export function EditorView() {
  const ctx = useEditorContext();
  // Offline Mode (docs/specs/006-document/offline-mode.md): a document saved only in this browser. Drives the
  // "Offline" header badge and hides server-only actions (Share).
  const isOffline = useIsOfflineDocument(ctx.documentId);
  // Snapshots (docs/specs/013-workspace/snapshots.md): the footer's button and dialog, for an Editor of the whole item.
  const snapshotsDoor = useEditorSnapshotsDoor({
    hydrated: ctx.hydrated,
    isOffline,
    embedMode: ctx.embedMode,
    workbench: ctx.workbench,
    isStructureReadOnly: ctx.isStructureReadOnly,
    level: ctx.can.level,
    itemId: ctx.documentId,
    selfId: ctx.selfParticipant?.id ?? null,
    shareCode: ctx.sessionShareCode,
    apiBase: ITEM_API_BASE,
    collection: 'documents',
    noun: 'knowledgebase',
    apiFetch: itemApiFetch,
    apiHeaders: itemApiHeaders,
  });
  // Approvals (docs/specs/013-workspace/approvals.md): the header's badge, the approver's banner and the Share dialog's
  // Approval tab, for a signed-in account; asking and cancelling for an Editor of the whole document.
  const approvalDoor = useEditorApprovalDoor({
    hydrated: ctx.hydrated,
    isOffline,
    embedMode: ctx.embedMode,
    workbench: ctx.workbench,
    accountId: ctx.accountUserId ?? null,
    itemId: ctx.documentId,
    teamId: ctx.documentTeamId ?? null,
    level: ctx.can.level,
    isStructureReadOnly: ctx.isStructureReadOnly,
    shareCode: ctx.sessionShareCode,
    client: indexClient,
    noun: 'knowledgebase',
    teamMembers: apiTeamMembers,
    snapshots: snapshotsDoor?.api ?? null,
    setShareOpen: ctx.setShareDialogOpen,
  });
  // A full page load the app starts itself (a stale build, a chunk recovery) waits for these edits
  // to be saved (docs/specs/016-platform/stale-builds.md).
  const { hasUnsavedChanges } = ctx;
  useEffect(() => registerUnsavedWork(hasUnsavedChanges), [hasUnsavedChanges]);
  // F6 moves between the header, palette, canvas, controls and tab bar (canvas-accessibility.md).
  useRegionCycle();
  // Which team the item is in, for every AI feature's source line (ai-keys.md "The source line").
  useAiSourceScope(ctx.documentTeamId ?? null, !!ctx.accountUserId);
  const {
    slideDeck,
    activeId,
    activeTab,
    anyWelcomeOpen,
    embedMode,
    // The app's surroundings, and the workbench session (docs/specs/013-workspace/blueprints/
    // workbench-embeds.md, Surface table).
    appChrome,
    workbench,
    canvasTool,
    drag,
    accountUserId,
    contextMenu,
    copying,
    documentId,
    documentShareable,
    documentTeamId,
    formatSourceId,
    hydrated,
    canShareDocument,
    isReadOnly,
    makeCopy,
    pendingDraw,
    connectSourceId,
    cancelConnect,
    sessionShareCode,
    setShareDialogOpen,
    renameTabNonce,
    tabs,
    zenMode,
    userPreferences,
    sessionCommunity,
  } = ctx;
  // `?copy=1` from the Community's Make a Copy (docs/specs/025-community/blueprints/community.md "Make a Copy").
  useAutoCopyParam({
    hydrated,
    sessionShareCode,
    // The author's own post copies nothing: their bar offers Edit Your Document instead.
    community: sessionCommunity !== null && !sessionCommunity.ownDocumentId,
    makeCopy,
  });
  // The Share button's Public colour follows the document's Community post (docs/specs/025-community/blueprints/
  // community.md); the Community's switch is asked only while there is a listed post, and never in an embed.
  const communityState = useCommunityState(documentId);
  const communityOn = useCommunityEnabled(API_BASE, communityState === 'listed' && appChrome);
  const headerCommunity = documentIsPublic({
    communityOn,
    ownPostState: communityState,
    communitySession: sessionCommunity !== null,
  });
  // UI scale (docs/specs/007-editor/ui-scale.md): desktop only, and a dragged Settings slider's patch wins.
  const { uiScales, isMobileViewport } = useEditorUiScales(userPreferences);

  const selectTab = useSelectTab();
  // Automations (docs/specs/013-workspace/automations.md): the footer's Tools row and the screen, for an Editor of the
  // whole document; the gate for one who must sign in or sync first.
  const automations = useDocumentAutomations(ctx, isOffline, selectTab);
  // Contextual command palette for the SearchPanel "Actions" group (docs/specs/008-canvas/canvas-and-palette.md):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the document (docs/specs/011-theme/canvas-and-theme-dialog.md).
  useEditorAccent(useKnowledgeStyle(documentId).theme);
  // The viewer's own light / dark chrome (docs/specs/007-editor/editor-app.md). Read here because the
  // Default theme resolves through it — see the canvas surface below.
  const { appearance } = useAppearance();
  // The guest sign-in toast (docs/specs/014-identity/sign-in-encouragement.md), delayed into the session. Its dismiss
  // key is the banner's it replaced, so whoever closed that stays rid of it.
  useSignInToast({
    dismissKey: 'liveknowledge:signin-banner-dismissed:v1',
    accountUserId,
    appChrome,
    hidden: zenMode,
  });
  const backdrop = resolveViewBackdrop(activeTab, appearance);

  // The same visibility for the Explorer panel's Current Document card (document-visibility-store).
  usePublishDocumentVisibility(
    documentShareable,
    !!documentTeamId,
    isOffline,
    canShareDocument && hydrated
      ? () => {
          setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }
      : undefined,
  );

  // A phone held sideways folds the header and the tab bar (docs/specs/007-editor/editor-app.md "A phone
  // held sideways"); a rename asked for elsewhere shows them first, so its field can take the focus.
  const landscapeBars = useLandscapeBars([renameTabNonce]);

  // The site header and the tab bar (editor-view-bars.tsx). Side by side (docs/specs/007-editor/split-view.md)
  // lays them across both panes.
  // Each is its own memoised component over the chrome store (editor-view-bars.tsx), so a typing commit renders
  // neither; null where its bar is hidden.
  // Walkthroughs (docs/specs/012-collaboration/walkthroughs.md): their row in the footer's Tools and the layer over the canvas.
  const walkthroughs = useEditorWalkthroughs({
    itemId: ctx.documentId,
    hydrated: ctx.hydrated,
    embedMode: ctx.embedMode,
    workbench: ctx.workbench,
    offline: isOffline,
    phone: isMobileViewport,
    tabScope: ctx.sessionTabScope,
    apiBase: ITEM_API_BASE,
    apiFetch: itemApiFetch,
    apiHeaders: itemApiHeaders,
    self: ctx.selfParticipant,
    shareCode: ctx.sessionShareCode,
    viewport: ctx.viewport,
    tabs: ctx.tabs,
    activeTab: ctx.activeId,
    selectTab,
    selectionStore: ctx.selectionStore,
    deck: ctx.slideDeck,
  });
  // The Share legend's Offline stop takes the document offline, after Take Offline's confirm, for the person whose
  // Explorer menu would offer it: one who may share it (owner or joined team member), not through a link or the
  // Community, and not already offline (hooks/persistence/useOfflineItemMenu.tsx). One callback for the editor's
  // life, reading the newest name when pressed, so the memoised header doesn't render for it.
  const offlineOwnerId =
    ctx.selfParticipant?.id === 'self' ? null : (ctx.selfParticipant?.id ?? null);
  const { takeOffline, syncToCloud } = useOfflineConversions(offlineOwnerId);
  const takeOfflineNow = useLatest(() => {
    if (documentId)
      void takeOffline({
        id: documentId,
        name: ctx.documentName?.trim() || 'Untitled Knowledgebase',
      });
  });
  const takeThisOffline = useCallback(() => takeOfflineNow.current(), [takeOfflineNow]);
  const mayTakeOffline =
    canShareDocument &&
    !isOffline &&
    !sessionShareCode &&
    !sessionCommunity &&
    !!offlineOwnerId &&
    !!documentId;
  // Its other stops (useVisibilityActions), for the same person: Private syncs an offline document, Team opens the
  // Explorer panel's Change Folder on it, Everyone opens Share on the Community tab (Passes where the Community is off).
  // Stable while the gate holds (the hook reads the newest handlers when pressed), so the memoised header keeps its skip.
  const visibilityActions = useVisibilityActions({
    manage:
      canShareDocument &&
      !sessionShareCode &&
      !sessionCommunity &&
      !!offlineOwnerId &&
      !!documentId,
    offline: isOffline,
    team: !!documentTeamId,
    community: !!headerCommunity,
    sync: documentId
      ? () =>
          void syncToCloud({
            id: documentId,
            name: ctx.documentName?.trim() || 'Untitled Knowledgebase',
          })
      : undefined,
    openShare: () => ctx.setShareDialogOpen(true),
    openCommunity: () => ctx.openShareOn('app'),
  });
  const header =
    zenMode || !appChrome ? null : (
      <EditorViewHeader
        isOffline={isOffline}
        onTakeOffline={mayTakeOffline ? takeThisOffline : undefined}
        visibilityActions={visibilityActions}
        headerCommunity={headerCommunity}
        landscapeShown={landscapeBars.shown}
      />
    );
  const footer =
    anyWelcomeOpen || zenMode || embedMode ? null : (
      <EditorViewFooter
        isOffline={isOffline}
        landscapeShown={landscapeBars.shown}
        phone={isMobileViewport}
      />
    );

  // The bars handle, at the canvas's top-right corner: only on a phone held sideways (CSS), and only
  // where there are bars to fold (not in zen, an embed, the workbench frame, the welcome flow or a
  // running presentation).
  const landscapeBarsHandle =
    header && footer && slideDeck.presentingAt === null ? (
      <LandscapeBarsHandle shown={landscapeBars.shown} onToggle={landscapeBars.toggle} />
    ) : null;

  return (
    // Which paper the canvas is, for every element that carries no colour of
    // its own (docs/specs/007-editor/editor-app.md). Read HERE, above both the canvas and the element
    // menus, so a swatch in a menu can't disagree with the shape it describes.
    // Subscribing to the appearance is what re-renders this on a mode switch:
    // a Default tab's paper is the viewer's, not the tab's.
    <DocumentAutomationsHost {...automations}>
      <SnapshotsDoorProvider door={snapshotsDoor}>
        <ApprovalDoorProvider door={approvalDoor}>
          <SelectionStoreProvider store={ctx.selectionStore}>
            {/* Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md): read for the canvas and the
            element menu, which both sit inside. */}
            <SheetLinksHost
              elements={activeTab.elements}
              itemId={documentId}
              canEdit={ctx.can.level === 'edit' && !isReadOnly}
              commit={ctx.commitElements}
              tick={ctx.tickElements}
              grantOf={sheetLinkGrantOf}
              ready={ctx.authLoaded && ctx.hydrated}
              onTrack={trackSheetLink}
              noun="document"
            >
              {/* Send to Plan (liveworkspace/docs/specs/004-index/send-to-plan.md): the chips' sends and the picker. */}
              <SendToPlanHost
                app="liveknowledge"
                itemId={ctx.authLoaded && hydrated ? documentId : null}
                tabId={activeId}
                title={ctx.documentName?.trim() || 'Untitled Knowledgebase'}
                share={sessionShareCode ? { code: sessionShareCode } : null}
                enabled={canSendToPlan({
                  signedIn: !!accountUserId,
                  offline: isOffline,
                  embed: !appChrome,
                  community: sessionCommunity !== null,
                })}
              />
              <ViewportStoreProvider store={ctx.viewport}>
                <CanvasSurfaceProvider surface={canvasSurface(backdrop.backgroundColor)}>
                  {/* The active tab's finish (docs/specs/008-canvas/finish.md), for the menus and panels; each
              canvas provides its own tab's again. */}
                  <CanvasFinishProvider finish={activeTab.finish}>
                    {/* The wobble Sketch palette tiles are drawn through (palette-tile-finish.ts). */}
                    <SketchFilterDefs />
                    <UiScaleProvider value={uiScales}>
                      <DockNamesProvider value={userPreferences?.dockButtonNames !== false}>
                        {/* Side by side tabs (docs/specs/007-editor/split-view.md): the editor, and another
                      tab of the document live beside it when one has been dragged to the right. */}
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
                                    <span className="text-brand-700 dark:text-brand-300">
                                      Cancel
                                    </span>
                                  </button>
                                </div>
                              ) : null}
                              {/* The approver's banner, above the canvas and its top row (approvals.md "Where it sits"). */}
                              <ApprovalBanner />
                              {KNOWLEDGE_VIEW_ANCHOR}
                              {headerInColumn}
                              {sessionCommunity && appChrome && hydrated ? (
                                <CommunityBar
                                  community={sessionCommunity}
                                  onMakeCopy={() => void makeCopy()}
                                  copying={copying}
                                />
                              ) : null}
                              {TAB_DIALOGS}
                              {COLLABORATORS}
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
                                    {/* Nor for a Community visitor (docs/specs/025-community/blueprints/community.md). */}
                                    <CommentBadgesContext.Provider
                                      value={!(embedMode && isReadOnly) && !sessionCommunity}
                                    >
                                      {/* Indicators are editor chrome: an embed never draws them (docs/specs/008-canvas/element-indicators.md). */}
                                      {/* A connected file is never the open page (links-and-embeds.md): for the moment a load lands on one, before the editor moves to the nearest page, nothing is drawn or edited. */}
                                      {ctx.activeTabConnected && !anyWelcomeOpen ? (
                                        <div className="min-h-0 flex-1 bg-slate-50 dark:bg-slate-950" />
                                      ) : (
                                        <SuppressElementIndicators when={embedMode}>
                                          <EditorCanvasHost />
                                        </SuppressElementIndicators>
                                      )}
                                    </CommentBadgesContext.Provider>
                                  </AgentFocusContext.Provider>
                                </ChangesetRevealContext.Provider>
                              </AreaErrorBoundary>
                              {PRESENTATION}
                              {/* Version History (docs/specs/006-document/version-history.md): over the editor while open. */}
                              <AreaErrorBoundary area="VersionHistory">
                                <VersionHistoryHost onSelectTab={selectTab} />
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
                                // The workbench's Reconnect line; its Open in liveknowledge sits in the tab bar.
                                <WorkbenchReconnectLine
                                  workbenchName={workbench.workbenchName}
                                  ended={workbench.ended}
                                />
                              ) : null}
                              {footerInColumn}
                              {/* Quick style panel (docs/specs/008-canvas/quick-style-panel.md): the most-used style choices beside
              a selection. Stands down in zen / embeds / presenting and while an
              element menu is open, which is the complete home of every setting. */}
                              <AreaErrorBoundary area="QuickStyle">
                                <QuickStyleHost
                                  hidden={
                                    // Not beside another tab (docs/specs/007-editor/split-view.md): half a window has
                                    // no room for it next to the selection.
                                    splitShowing ||
                                    zenMode ||
                                    embedMode ||
                                    // Off in Settings (docs/specs/007-editor/user-preferences.md); style memory stays.
                                    !panelEnabled(userPreferences, 'quickStylePanelEnabled') ||
                                    (contextMenu !== null && contextMenu.mode !== 'canvas')
                                  }
                                />
                              </AreaErrorBoundary>
                              {/* Find and replace over the canvas (docs/specs/007-editor/find-and-replace.md). */}
                              <AreaErrorBoundary area="Search">
                                <EditorFindHost
                                  openerRef={ctx.findOpenRef}
                                  canvasMainRef={ctx.canvasMainRef}
                                />
                              </AreaErrorBoundary>
                              {ctx.searchOpen ? (
                                <AreaErrorBoundary area="Search">
                                  <EditorSearchPanel />
                                </AreaErrorBoundary>
                              ) : null}
                              {MODALS}
                              {TOURS}

                              {START_PANELS}

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

                              {KNOWLEDGE_VIEW}

                              {NEW_VERSION_PROMPT}
                            </div>
                          )}
                        </SplitViewFrame>
                      </DockNamesProvider>
                    </UiScaleProvider>
                  </CanvasFinishProvider>
                </CanvasSurfaceProvider>
                <WalkthroughsLayer walkthroughs={walkthroughs} />
                <WalkthroughsTools walkthroughs={walkthroughs} words={WALKTHROUGH_WORDS} />
              </ViewportStoreProvider>
            </SheetLinksHost>
          </SelectionStoreProvider>
        </ApprovalDoorProvider>
      </SnapshotsDoorProvider>
    </DocumentAutomationsHost>
  );
}
