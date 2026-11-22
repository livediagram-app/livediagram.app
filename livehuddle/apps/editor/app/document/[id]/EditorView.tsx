'use client';

import { useAiSourceScope } from '@liveworkspace/workbench/components/ai/ai-source-scope';
import dynamic from 'next/dynamic';
import { openSearchWithPrefetch } from '@liveworkspace/workbench/lib/open-search';
import { track } from '@/lib/telemetry';
import { NewVersionPrompt } from '@/components/chrome/NewVersionPrompt';
import { registerUnsavedWork } from '@liveworkspace/workbench/lib/unsaved-work';
import { useRegionCycle } from '@liveworkspace/workbench/hooks/ui/useRegionCycle';
import { useEffect, useState } from 'react';
import { addToDocumentTargets } from '@/lib/add-to-document-targets';
import { canvasSurface } from '@livehuddle/document';
import { resolveTabBackdrop } from '@/lib/themes';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { CanvasFinishProvider } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { SketchFilterDefs } from '@/components/canvas/SketchFilterDefs';
import { ChangesetRevealContext } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusContext } from '@/components/canvas/AgentFocusOverlay';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { EditorCanvasHost } from '@/components/canvas/EditorCanvasHost';
import { ConnectedTabHost } from '@/components/connect/ConnectedTabHost';
import { EditorCornerActions } from '@liveworkspace/workbench/components/chrome/EditorCornerActions';
import { CommunityBar } from '@/components/chrome/CommunityBar';
import { useAutoCopyParam } from '@liveworkspace/workbench/hooks/canvas/useAutoCopyParam';
import { documentIsPublic } from '@/lib/community-public';
import { useCommunityState } from '@/lib/community-state-store';
import { useCommunityEnabled } from '@livehuddle/ui';
import { API_BASE } from '@/lib/api-client';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { TabBar } from '@/components/chrome/TabBar';
import { LandscapeBarFold, LandscapeBarsHandle } from '@/components/chrome/LandscapeBars';
import { useLandscapeBars } from '@/hooks/ui/useLandscapeBars';
import { SplitViewFrame } from '@/components/split/SplitViewFrame';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { FocusInviteDialog } from '@/components/dialogs/FocusInviteDialog';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { CollaboratorsHost } from '@/components/dialogs/CollaboratorsHost';
import { TabAttendanceHost } from '@/components/dialogs/TabAttendanceHost';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { EditorTours } from '@/components/tour/EditorTours';
import { ModifierHintBanner } from '@liveworkspace/workbench/components/chrome/ModifierHintBanner';
import { loadEditorSearchPanel } from '@/lib/editor-deferred-code';
import { useSignInToast } from '@liveworkspace/workbench/hooks/ui/useSignInToast';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useOfflineConversions } from '@/hooks/persistence/useOfflineConversion';
import { useVisibilityActions } from '@liveworkspace/workbench/components/chrome/useVisibilityActions';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from './EditorContext';
import { useSelectTab } from './useSelectTab';
import { UiScaleProvider } from '@liveworkspace/workbench/components/providers/ui-scale';
import { DockNamesProvider } from '@liveworkspace/workbench/hooks/ui/useDockNames';
import { useEditorUiScales } from '@liveworkspace/workbench/hooks/ui/useEditorUiScales';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { ClearStylesHost } from '@/components/canvas/ClearStylesHost';
import { SpaceQuickStylePanel } from '@/components/canvas/SpaceQuickStylePanel';
import { EditorStartPanels } from '@/components/start/EditorStartPanels';
import { SnapshotsDoorProvider, useEditorSnapshotsDoor } from '@liveworkspace/snapshots/ui';
import {
  API_BASE as SNAPSHOTS_API_BASE,
  apiFetch as snapshotsFetch,
  apiHeaders as snapshotsHeaders,
} from '@/lib/api/core';
import { SpaceAutomationsHost } from '@/components/automations/SpaceAutomationsHost';
import { useSpaceAutomations } from '@/components/automations/use-space-automations';

// Loaded when first drawn (docs/specs/016-platform/web-performance.md): search while it is open. Its code is
// fetched once the editor is idle (EDITOR_SURFACE_CODE), so opening it does not wait.
const EditorSearchPanel = dynamic(loadEditorSearchPanel, { ssr: false });

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
    workbench: null,
    isStructureReadOnly: ctx.isStructureReadOnly,
    level: ctx.can.level,
    itemId: ctx.documentId,
    selfId: ctx.selfParticipant?.id ?? null,
    shareCode: ctx.sessionShareCode,
    apiBase: SNAPSHOTS_API_BASE,
    collection: 'documents',
    noun: 'Space',
    apiFetch: snapshotsFetch,
    apiHeaders: snapshotsHeaders,
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
    pasteFromClipboard,
    hasClipboard,
    activeId,
    activeTab,
    addTab,
    followMe,
    anyWelcomeOpen,
    embedMode,
    // The app's surroundings.
    appChrome,
    quickStyleDeps,
    focusInvite,
    livePresence,
    canvasTool,
    drag,
    clearTabContent,
    accountUserId,
    closeContextMenu,
    contextMenu,
    copying,
    deleteTab,
    documentId,
    documentList,
    documentShareable,
    documentTeamId,
    duplicateTab,
    formatSourceId,
    hydrated,
    setImportOpen,
    canShareDocument,
    isOwner,
    isStructureReadOnly,
    isOutOfScope,
    linkActiveTabTo,
    loadAllTabs,
    makeCopy,
    participantsByTab,
    pendingDraw,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    setFolderColour,
    reorderTabs,
    selfParticipant,
    sessionRole,
    sessionShareCode,
    setExportOpen,
    setExportScope,
    setSearchOpen,
    setSettingsOpen,
    openSettingsOn,
    setShareDialogOpen,
    renameTabNonce,
    tabs,
    openCollaborators,
    userPreferences,
    sessionCommunity,
  } = ctx;
  // `?copy=1` from the Community's Make a Copy (docs/specs/025-community/community.md).
  useAutoCopyParam({
    hydrated,
    sessionShareCode,
    // The author's own post copies nothing: their bar offers Edit Your Document instead.
    community: sessionCommunity !== null && !sessionCommunity.ownDocumentId,
    makeCopy,
  });
  // The Share button's Public colour follows the document's Community post (docs/specs/025-community/community.md);
  // the Community's switch is asked only while there is a listed post, and never in an embed.
  const communityState = useCommunityState(documentId);
  const communityOn = useCommunityEnabled(API_BASE, communityState === 'listed' && appChrome);
  const headerCommunity = documentIsPublic({
    communityOn,
    ownPostState: communityState,
    communitySession: sessionCommunity !== null,
  });
  // UI scale (docs/specs/007-editor/ui-scale.md): desktop only, and a dragged Settings slider's patch wins.
  const { uiScales } = useEditorUiScales(userPreferences);
  // A tab's Attendance (docs/specs/012-collaboration/tab-attendance.md "Where it shows"): the tab whose dialog is open.
  // An Editor's and a Participant's, on a document with a room (not one saved only Offline).
  const [attendanceTabId, setAttendanceTabId] = useState<string | null>(null);
  const openAttendance =
    ctx.can.seeAttendance && !isOffline
      ? (tabId: string) => {
          setAttendanceTabId(tabId);
          track('UI', 'Opened', 'Attendance');
        }
      : undefined;

  const selectTab = useSelectTab();
  // Automations (docs/specs/013-workspace/automations.md): the footer's Tools row and the screen, for an Editor of the
  // whole Space; the gate for one who must sign in or sync first.
  const automations = useSpaceAutomations(ctx, isOffline, selectTab);
  // Contextual command palette for the SearchPanel "Actions" group (docs/specs/008-canvas/canvas-and-palette.md):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the document (docs/specs/011-theme/canvas-and-theme-dialog.md).
  useEditorAccent(activeTab.theme);
  // The viewer's own light / dark chrome (docs/specs/007-editor/editor-app.md). Read here because the
  // Default theme resolves through it — see the canvas surface below.
  const { appearance } = useAppearance();
  // The guest sign-in toast (docs/specs/014-identity/sign-in-encouragement.md), delayed into the session. Its dismiss
  // key is the banner's it replaced, so whoever closed that stays rid of it.
  useSignInToast({
    dismissKey: 'livehuddle:signin-banner-dismissed:v1',
    accountUserId,
    appChrome,
    // This view has no zen mode to hide it in.
    hidden: false,
  });
  const backdrop = resolveTabBackdrop(activeTab, appearance);

  // A phone held sideways folds the header and the tab bar (docs/specs/007-editor/editor-app.md "A phone
  // held sideways"); a rename asked for elsewhere shows them first, so its field can take the focus.
  const landscapeBars = useLandscapeBars([renameTabNonce]);

  // The Share legend's Offline stop takes the Space offline, after Take Offline's confirm, for the person whose
  // Explorer menu would offer it: one who may share it (owner or joined team member), not through a link or the
  // Community, and not already offline (hooks/persistence/useOfflineItemMenu.tsx).
  const offlineOwnerId = selfParticipant.id === 'self' ? null : selfParticipant.id;
  const { takeOffline, syncToCloud } = useOfflineConversions(offlineOwnerId);
  const onTakeOffline =
    canShareDocument &&
    !isOffline &&
    !sessionShareCode &&
    !sessionCommunity &&
    offlineOwnerId &&
    documentId
      ? () =>
          void takeOffline({ id: documentId, name: ctx.documentName?.trim() || 'Untitled Space' })
      : undefined;
  // Its other stops (useVisibilityActions), for the same person: Private syncs an offline Space, Team opens the
  // Explorer panel's Change Folder on it, Everyone opens Share on the Community tab (Passes where the Community is off).
  const spaceName = ctx.documentName?.trim() || 'Untitled Space';
  const visibilityActions = useVisibilityActions({
    manage: Boolean(
      canShareDocument && !sessionShareCode && !sessionCommunity && offlineOwnerId && documentId,
    ),
    offline: isOffline,
    team: !!documentTeamId,
    community: !!headerCommunity,
    sync: documentId ? () => void syncToCloud({ id: documentId, name: spaceName }) : undefined,
    openShare: () => setShareDialogOpen(true),
    openCommunity: () => ctx.openShareOn('app'),
  });

  // The site header. Embeds (docs/specs/013-workspace/embeds.md) never show it. Side by
  // side (docs/specs/007-editor/split-view.md) lays it across both panes.
  // Experiment: no header bar. The name and its visibility badge are gone; Copy, Share and the account float in a
  // card at the top right.
  const header = !appChrome ? null : (
    <AreaErrorBoundary area="Header" fallback="panel">
      <EditorCornerActions
        showShare={canShareDocument && hydrated && !anyWelcomeOpen}
        shareable={documentShareable}
        // The Share button's colour reads the document's visibility, as the header's badge did.
        visibility={{ team: !!documentTeamId, offline: isOffline, community: headerCommunity }}
        // Visitors see "Make a copy" instead of "Share" (a joined team member is no visitor). Hidden during the
        // welcome flow and hydration; a Community visitor gets it from the Community bar instead.
        onMakeCopy={
          !canShareDocument && hydrated && !anyWelcomeOpen && documentId && !sessionCommunity
            ? () => void makeCopy()
            : undefined
        }
        onTakeOffline={onTakeOffline}
        visibilityActions={visibilityActions}
        copying={copying}
        copyDescription="Duplicate this space into your own files."
        onOpenAccount={() => openSettingsOn('account')}
        onOpenShare={() => {
          setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }}
      />
    </AreaErrorBoundary>
  );

  // The tab bar, the editor's footer. Hidden through the welcome flow and in embeds.
  // Side by side (docs/specs/007-editor/split-view.md) lays it across both panes, like the header.
  const footer =
    anyWelcomeOpen || embedMode ? null : (
      <LandscapeBarFold shown={landscapeBars.shown}>
        <AreaErrorBoundary area="TabBar" fallback="panel">
          <TabBar
            tabs={tabs}
            activeId={activeId}
            // Clicking an avatar in a presence stack opens the Collaborators
            // modal (docs/specs/012-collaboration/collaborator-enhancements.md), which is where Follow (docs/specs/012-collaboration/follow-me-viewport.md) lives.
            followingId={followMe.followingId}
            followerCount={followMe.followerCount}
            onOpenCollaborators={openCollaborators}
            onOpenAttendance={openAttendance}
            onMoveTabToFolder={moveTabToFolder}
            onRemoveTabFromFolder={removeTabFromFolder}
            onSetFolderColour={setFolderColour}
            onRenameFolder={renameTabFolder}
            activeTabHasContent={activeTab.elements.length > 0}
            onSelect={selectTab}
            onAdd={() => addTab()}
            onRename={renameTab}
            onDuplicate={duplicateTab}
            onDelete={deleteTab}
            onConnectAgain={(id) => void ctx.connectedTabs.connectAgainTab(id)}
            onClearContent={() => void clearTabContent()}
            onImportTab={() => setImportOpen(true)}
            onExportTab={() => {
              setExportScope('tab');
              setExportOpen(true);
            }}
            otherDocuments={addToDocumentTargets({
              documentId,
              documentList,
              isOffline,
              isOwner,
            })}
            onCopyTabTo={linkActiveTabTo}
            onReorder={reorderTabs}
            // A tab-scoped visitor edits their tab's content at most, never the
            // tabs around it (docs/specs/013-workspace/tab-scoped-share-links.md).
            readOnly={isStructureReadOnly}
            isOutOfScope={isOutOfScope}
            renameActiveNonce={renameTabNonce}
            participantsByTab={participantsByTab}
            selfId={selfParticipant.id}
            selfRole={sessionRole}
            onOpenSettings={() => {
              // Preferences are user-scoped, not document-scoped, so
              // view-role visitors can still flip them for their own
              // browser (e.g. opt out of telemetry).
              setSettingsOpen(true);
              track('UI', 'Opened', 'Settings');
            }}
            onOpenSearch={() => openSearchWithPrefetch(setSearchOpen, loadAllTabs)}
            // Canvas right-click (desktop) + long-press (touch) open the active
            // tab's menu with the canvas sections folded in, rendered by the
            // TabBar so it reuses every tab handler. Element / multi context
            // menus stay on EditorContextMenu below.
            canvasMenu={contextMenu?.mode === 'canvas' ? contextMenu : null}
            onCloseCanvasMenu={closeContextMenu}
            canvasActions={{
              // Paste straight from the empty-canvas right-click (docs/specs/008-canvas/canvas-and-palette.md).
              onPaste: () => pasteFromClipboard(),
              canPaste: hasClipboard,
            }}
          />
        </AreaErrorBoundary>
      </LandscapeBarFold>
    );

  // The bars handle, at the canvas's top-right corner: only on a phone held sideways (CSS), and only
  // where there are bars to fold (not in an embed or the welcome flow).
  const landscapeBarsHandle =
    header && footer ? (
      <LandscapeBarsHandle shown={landscapeBars.shown} onToggle={landscapeBars.toggle} />
    ) : null;

  return (
    // Which paper the canvas is, for every element that carries no colour of
    // its own (docs/specs/007-editor/editor-app.md). Read HERE, above both the canvas and the element
    // menus, so a swatch in a menu can't disagree with the shape it describes.
    // Subscribing to the appearance is what re-renders this on a mode switch:
    // a Default tab's paper is the viewer's, not the tab's.
    <SpaceAutomationsHost {...automations}>
      <SnapshotsDoorProvider door={snapshotsDoor}>
        <SelectionStoreProvider store={ctx.selectionStore}>
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
                      {(headerInColumn, footerInColumn) => (
                        <div
                          // The open tab's editor mode, for the e2e helpers (e2e/fixtures.ts).
                          className="flex h-dvh flex-col"
                        >
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
                            <TabAttendanceHost
                              tabId={attendanceTabId}
                              onClose={() => setAttendanceTabId(null)}
                            />
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
                                {/* A connected tab's page stands in the canvas's place (connected-tabs.md), once a visitor's name prompt (drawn by the canvas host) is answered. */}
                                {ctx.activeTabConnected && !anyWelcomeOpen ? (
                                  <ConnectedTabHost />
                                ) : (
                                  <EditorCanvasHost />
                                )}
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
                          {footerInColumn}
                          {/* What the element menu's Clear Styles resets (docs/specs/008-canvas/element-menu-quick-bar.md),
            and the Quick Style panel: a room's walls and floor, a piece's type (docs/specs/008-canvas/space-quick-style.md). */}
                          <AreaErrorBoundary area="QuickStyle">
                            <ClearStylesHost deps={quickStyleDeps} />
                            <SpaceQuickStylePanel editing={canvasTool !== 'avatar' && !drag} />
                          </AreaErrorBoundary>
                          {ctx.searchOpen ? (
                            <AreaErrorBoundary area="Search">
                              <EditorSearchPanel />
                            </AreaErrorBoundary>
                          ) : null}
                          {/* Bring Focus (docs/specs/012-collaboration/bring-focus.md). A dialog: it is a question addressed to
        you, not a status line. Shown to view-role visitors too. */}
                          <FocusInviteDialog
                            from={
                              focusInvite.invite
                                ? (livePresence.find((p) => p.id === focusInvite.invite!.from)
                                    ?.name ?? 'Someone')
                                : null
                            }
                            onAccept={focusInvite.acceptFocus}
                            onDismiss={focusInvite.dismissFocus}
                          />
                          <AreaErrorBoundary area="Modals">
                            <EditorModals />
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

                          <EditorStartPanels />

                          {/* Modifier hint (docs/specs/008-canvas/canvas-and-palette.md): names what holding Shift does
        right now. Suppressed while a mode banner owns the top slot. */}
                          <ModifierHintBanner
                            drag={drag}
                            hasElements={activeTab.elements.length > 0}
                            shiftMessage={canvasTool === 'avatar' ? 'Running' : null}
                            suppressed={
                              canvasTool === 'format' ||
                              formatSourceId !== null ||
                              pendingDraw !== null
                            }
                          />

                          {/* An editor older than the server's document format offers a reload, once its edits
          are saved (docs/specs/016-platform/new-version-prompt.md). */}
                          <NewVersionPrompt hasUnsavedChanges={ctx.hasUnsavedChanges} />
                        </div>
                      )}
                    </SplitViewFrame>
                  </DockNamesProvider>
                </UiScaleProvider>
              </CanvasFinishProvider>
            </CanvasSurfaceProvider>
          </ViewportStoreProvider>
        </SelectionStoreProvider>
      </SnapshotsDoorProvider>
    </SpaceAutomationsHost>
  );
}
