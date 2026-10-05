'use client';

import { CommentBadgesContext } from '@/components/canvas/CommentBadgesContext';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { truncateName } from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { NewVersionPrompt } from '@/components/chrome/NewVersionPrompt';
import { registerUnsavedWork } from '@/lib/unsaved-work';
import { useEffect } from 'react';
import { OFFLINE_OWNER_ID } from '@/lib/offline/offline-store';
import { canvasSurface } from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { readDrawPattern } from '@/lib/whiteboard-dock-prefs';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { ChangesetRevealContext } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusContext } from '@/components/canvas/AgentFocusOverlay';
import { SelectionStoreProvider } from '@/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { EditorCanvasHost } from '@/components/canvas/EditorCanvasHost';
import { PresentationHost } from '@/components/canvas/PresentationHost';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { CommunityBar } from '@/components/chrome/CommunityBar';
import { useAutoCopyParam } from '@/hooks/canvas/useAutoCopyParam';
import { useCommunityState } from '@/lib/community-state-store';
import { useCommunityEnabled } from '@livediagram/ui';
import { API_BASE } from '@/lib/api-client';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { TabBar } from '@/components/chrome/TabBar';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { EmptyCanvasBanner } from '@/components/canvas/EmptyCanvasBanner';
import { BoardSceneNotice } from '@/components/canvas/BoardSceneNotice';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { PollPromptSheet } from '@/components/panels/PollPromptSheet';
import { FocusInviteDialog } from '@/components/dialogs/FocusInviteDialog';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { CollaboratorsHost } from '@/components/dialogs/CollaboratorsHost';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { TourHost } from '@/components/tour/TourHost';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { EditorSearchPanel } from '@/components/panels/EditorSearchPanel';
import { ThemeModeBanner } from '@/components/chrome/ThemeModeBanner';
import { ModifierHint } from '@/components/chrome/ModifierHintBanner';
import { PhotoDraftBar } from '@/components/chrome/PhotoDraftBar';
import { PhotoImportProgress } from '@/components/chrome/PhotoImportProgress';
import { PhotoReviewOverlay } from '@/components/chrome/PhotoReviewOverlay';
import { PHOTO_ACCEPT_ATTR } from '@/lib/photo-detect';
import { usePhotoDraftView } from '@/lib/photo-draft-preview';
import { draftNotesOf } from '@livediagram/document';
import { clerkEnabled } from '@/lib/clerk-config';
import { useDismissibleBanner } from '@/hooks/ui/useDismissibleBanner';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useDelayedReveal } from '@/hooks/ui/useDelayedReveal';
import { useEditorAccent } from '@/hooks/ui/useEditorAccent';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useEditorContext } from './EditorContext';
import { useSelectTab } from './useSelectTab';
import { useRoleIndicator } from './useRoleIndicator';
import { RolePill, RoleStatusIcon } from '@/components/chrome/RoleIndicator';
import { MinimalChromeProvider } from '@/components/providers/minimal-chrome';
import { isMinimalChrome, isPowerUserMode } from '@/lib/power-user-mode';
import { UiScaleProvider, useUiScalePreview } from '@/components/providers/ui-scale';
import { resolveUiScales } from '@/lib/ui-scale';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { QuickStyleHost } from '@/components/canvas/QuickStyleHost';
import { panelEnabled, resolvePanelLayout } from '@/lib/user-preferences';

// How long a guest edits before the sign-in nudge appears (docs/specs/014-identity/sign-in-encouragement.md).
// Long enough that it never greets someone the instant they open a
// document; short enough to catch an invested session.
const SIGNIN_BANNER_DELAY_MS = 5 * 60_000;

// The editor's full view (header + canvas + tab bar + all dialogs),
// lifted out of editor-page.tsx. Every value/handler it needs is read
// from EditorContext (provided by the page), so the page no longer
// threads ~150 props through this JSX. The JSX is verbatim; only its
// scope changed from the page's locals to the destructured context.
export function EditorView() {
  const ctx = useEditorContext();
  // Offline Mode (docs/specs/006-document/offline-mode.md): a document saved only in this browser. Drives the
  // "Local only" header badge and hides server-only actions (Share).
  const isOffline = useIsOfflineDocument(ctx.documentId);
  // A full page load the app starts itself (a stale build, a chunk recovery) waits for these edits
  // to be saved (docs/specs/016-platform/stale-builds.md).
  const { hasUnsavedChanges } = ctx;
  useEffect(() => registerUnsavedWork(hasUnsavedChanges), [hasUnsavedChanges]);
  const {
    pasteFromClipboard,
    hasClipboard,
    boardSceneInsert,
    activeId,
    activeTab,
    addTab,
    followMe,
    anyWelcomeOpen,
    embedMode,
    quickStyleDeps,
    autoAlignTab,
    autoLayoutTab,
    previewCleanup,
    endCleanupPreview,
    facilitator,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    extendTimer,
    clearTimer,
    startVote,
    endVote,
    revealVote,
    clearVote,
    livePoll,
    focusInvite,
    livePresence,
    layers,
    activeLayerId,
    canvasTool,
    drag,
    esBoard,
    photoDraft,
    photoImportAvailable,
    onPhotoPicked,
    photoPickerRef,
    clearTabContent,
    clerkUserId,
    closeContextMenu,
    contextMenu,
    copying,
    deleteTab,
    documentId,
    documentList,
    setDocumentList,
    documentName,
    documentShareable,
    documentTeamId,
    duplicateTab,
    templateGridOpen,
    formatSourceId,
    hydrated,
    setImportOpen,
    isOwner,
    isReadOnly,
    isStructureReadOnly,
    isOutOfScope,
    linkActiveTabTo,
    loadAllTabs,
    makeCopy,
    openTemplatePicker,
    participantsByTab,
    pollCollaborators,
    pendingDraw,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    reorderTabs,
    connectSourceId,
    cancelConnect,
    selfParticipant,
    voteSelfId,
    sessionRole,
    sessionShareCode,
    setDocumentName,
    setExportOpen,
    setExportScope,
    setSearchOpen,
    setSettingsOpen,
    openSettingsOn,
    setShareDialogOpen,
    renameDocumentNonce,
    renameTabNonce,
    tabs,
    toggleActiveTabLock,
    zenMode,
    openCollaborators,
    userPreferences,
    sessionCommunity,
  } = ctx;
  // `?copy=1` from the Community's Make a Copy (docs/specs/025-community/community.md).
  // The header badge follows the document's Community post (docs/specs/025-community/community.md).
  const communityState = useCommunityState(documentId);
  // The badge goes too while the Community is switched off (docs/specs/025-community/community.md).
  // Asked only while there is a listed post to badge, and never in an embed, so other opens make no request.
  const communityOn = useCommunityEnabled(API_BASE, communityState === 'listed' && !embedMode);
  useAutoCopyParam({
    hydrated,
    sessionShareCode,
    // The author's own post copies nothing: their bar offers Edit Your Document instead.
    community: sessionCommunity !== null && !sessionCommunity.ownDocumentId,
    makeCopy,
  });
  // Minimal chrome (docs/specs/007-editor/power-user-mode.md): one flag, read by every chrome surface.
  const minimalChrome = isMinimalChrome(userPreferences);
  // UI scale (docs/specs/007-editor/ui-scale.md): desktop only, so a phone resolves to 1.
  // While a Settings slider is dragged its patch wins, so the chrome resizes
  // as you go; the preference is written once, on release.
  const uiScalePreview = useUiScalePreview();
  const uiScales = resolveUiScales(
    uiScalePreview === null ? userPreferences : { ...userPreferences, ...uiScalePreview },
    { mobile: useIsMobileViewport() },
  );
  const role = useRoleIndicator();

  // Who is facilitating, named for the UI, or null when it is nobody or us
  // (docs/specs/012-collaboration/facilitator.md). Resolved from the roster we already hold so a rename reads
  // correctly, and null when we hold it: our own controls are not blocked,
  // so there is nothing to explain.
  const facilitatorName =
    facilitator.sessionToolsBlocked && facilitator.facilitatorId
      ? (livePresence.find((p) => p.id === facilitator.facilitatorId)?.name ?? 'Someone else')
      : null;
  const selectTab = useSelectTab();
  // Contextual command palette for the SearchPanel "Actions" group (docs/specs/008-canvas/canvas-and-palette.md):
  // selection-aware command list + dispatcher, built off the same editor
  // actions the menus use. Empty (undefined items) for view-only sessions.
  // Retarget the brand-* accent (buttons, rings, focus) to the active tab's
  // theme so the editor chrome matches the document (docs/specs/011-theme/canvas-and-theme-dialog.md).
  // One look in both editor modes (docs/specs/007-editor/editor-modes.md "One look"), so the accent
  // follows the tab's theme in Draw mode too.
  const drawMode = ctx.editorMode.mode === 'draw';
  useEditorAccent(activeTab.theme);
  // The viewer's own light / dark chrome (docs/specs/007-editor/live-app.md). Read here because the
  // Default theme resolves through it — see the canvas surface below.
  const { appearance } = useAppearance();
  // Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md): the same banner the Explorer shows,
  // but on the editor it waits ~5 minutes into the session before
  // appearing so it never interrupts someone the moment they open a
  // document. Hidden in embed (read-only iframe) and zen mode. zenMode
  // is deliberately kept OUT of the timer's `enabled` so toggling zen
  // doesn't restart the countdown; it only hides the card at render.
  const { dismissed: signInDismissed, dismiss: dismissSignIn } =
    useDismissibleBanner(SIGNIN_BANNER_DISMISS_KEY);
  const signInTimerEnabled = clerkEnabled && !clerkUserId && !embedMode && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInBanner = signInTimerEnabled && !zenMode && signInDelayElapsed;
  // Empty-canvas hint (docs/specs/007-editor/new-document-route.md): a bottom banner while the active tab has no
  // elements. Not dismissible — it just goes away once there's content. Hidden
  // in zen / embed, while a draw tool is armed, or while Quick Start is open;
  // yields the bottom slot to the sign-in banner.
  const showEmptyCanvasBanner =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !showSignInBanner &&
    !templateGridOpen &&
    !pendingDraw &&
    // Draw mode's dock is its own hint (docs/specs/023-draw-mode/draw-mode.md).
    !drawMode &&
    // An empty infographic page invites a layout in its own title bar
    // (docs/specs/007-editor/illustrate-pages.md).
    ctx.editorMode.mode !== 'illustrate' &&
    activeTab.elements.length === 0;
  // The photo draft awaiting a decision, and the session-local view state
  // that goes with it (docs/specs/021-event-storming/event-storming.md Phase 8).
  const draftNotes = draftNotesOf(activeTab.elements);
  const draftView = usePhotoDraftView();
  const backdrop = resolveViewBackdrop(
    activeTab,
    { mode: ctx.editorMode.mode, drawPattern: readDrawPattern(userPreferences) },
    appearance,
  );

  return (
    // Which paper the canvas is, for every element that carries no colour of
    // its own (docs/specs/007-editor/live-app.md). Read HERE, above both the canvas and the element
    // menus, so a swatch in a menu can't disagree with the shape it describes.
    // Subscribing to the appearance is what re-renders this on a mode switch:
    // a Default tab's paper is the viewer's, not the tab's.
    <SelectionStoreProvider store={ctx.selectionStore}>
      <ViewportStoreProvider store={ctx.viewport}>
        <CanvasSurfaceProvider surface={canvasSurface(backdrop.backgroundColor)}>
          <MinimalChromeProvider value={minimalChrome} powerUser={isPowerUserMode(userPreferences)}>
            <UiScaleProvider value={uiScales}>
              <EditorModeProvider value={ctx.editorMode}>
                <div className="flex h-dvh flex-col">
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
                        <span className="text-brand-500 dark:text-brand-300">Cancel</span>
                      </button>
                    </div>
                  ) : null}
                  {/* Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides the header entirely so the
          canvas gets the full height. Embeds (docs/specs/013-workspace/embeds.md) never show it. */}
                  {zenMode || embedMode ? null : (
                    <AreaErrorBoundary area="Header" fallback="panel">
                      <EditorHeader
                        documentName={documentName}
                        hideTitle={anyWelcomeOpen}
                        showShare={isOwner && hydrated && !anyWelcomeOpen}
                        shareable={documentShareable}
                        community={communityOn && communityState === 'listed'}
                        teamDocument={!!documentTeamId}
                        offline={isOffline}
                        // Visitors see "Make a copy" instead of "Share": same slot,
                        // different action. Hidden during the welcome flow so the
                        // first-paint chrome stays minimal, and during hydration so
                        // we don't render the button before we know whether the user
                        // is the owner. A Community visitor gets it from the Community bar instead.
                        onMakeCopy={
                          !isOwner && hydrated && !anyWelcomeOpen && documentId && !sessionCommunity
                            ? makeCopy
                            : undefined
                        }
                        copying={copying}
                        readOnly={isStructureReadOnly}
                        renameNonce={renameDocumentNonce}
                        // Minimal chrome moves the pill to an icon in the status bar.
                        rolePill={minimalChrome ? undefined : <RolePill {...role} />}
                        brandAccent={getTheme(activeTab.theme).elementStroke ?? undefined}
                        onOpenAccount={() => openSettingsOn('account')}
                        onOpenShare={() => {
                          setShareDialogOpen(true);
                          track('UI', 'Opened', 'Share');
                        }}
                        onRename={(next) => {
                          const prev = documentName.trim();
                          // docs/specs/006-document/name-length.md: capped here so the header rename can't outrun the
                          // limit the auto-namer and the Explorer renames both respect.
                          const nextTrim = truncateName(next);
                          setDocumentName(nextTrim);
                          // Keep the Explorer panel's row for THIS document in sync —
                          // autosave persists the name, but the in-memory list would
                          // otherwise show the old name until a reload re-fetched it.
                          if (nextTrim && documentId)
                            setDocumentList((prev) =>
                              prev.map((d) => (d.id === documentId ? { ...d, name: nextTrim } : d)),
                            );
                          if (nextTrim && nextTrim !== prev) track('Document', 'Renamed');
                        }}
                      />
                    </AreaErrorBoundary>
                  )}
                  {sessionCommunity && !embedMode && hydrated ? (
                    <CommunityBar
                      community={sessionCommunity}
                      onMakeCopy={makeCopy}
                      copying={copying}
                    />
                  ) : null}
                  <AreaErrorBoundary area="TabDialogs">
                    <EditorTabDialogs />
                  </AreaErrorBoundary>
                  <AreaErrorBoundary area="Collaborators">
                    <CollaboratorsHost />
                  </AreaErrorBoundary>
                  <AreaErrorBoundary area="Canvas" fallback="panel" fallbackClassName="flex-1">
                    {/* The outlines relayed changesets draw (docs/specs/024-agents/agent-changesets.md). */}
                    <ChangesetRevealContext.Provider value={ctx.changesetReveals}>
                      {/* The focus rings of the agents present (docs/specs/024-agents/agent-presence.md). */}
                      <AgentFocusContext.Provider value={ctx.agentFocusByElement}>
                        {/* No comment badges for a viewer in an embed (docs/specs/013-workspace/embeds.md). */}
                        <CommentBadgesContext.Provider
                          value={!(embedMode && isReadOnly) && !sessionCommunity}
                        >
                          <EditorCanvasHost />
                        </CommentBadgesContext.Provider>
                      </AgentFocusContext.Provider>
                    </ChangesetRevealContext.Provider>
                  </AreaErrorBoundary>
                  {/* Presenting (docs/specs/012-collaboration/presentation-mode.md) renders over everything and takes the keyboard.
          Nothing at all when no deck is running. */}
                  <AreaErrorBoundary area="Presentation">
                    <PresentationHost />
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
                  {anyWelcomeOpen || zenMode || embedMode ? null : (
                    <AreaErrorBoundary area="TabBar" fallback="panel">
                      <TabBar
                        powerUser={isPowerUserMode(userPreferences)}
                        roleIcon={
                          minimalChrome ? (
                            <RoleStatusIcon role={role.role} onToggle={role.onToggle} />
                          ) : undefined
                        }
                        tabs={tabs}
                        activeId={activeId}
                        // Clicking an avatar in a presence stack opens the Collaborators
                        // modal (docs/specs/012-collaboration/collaborator-enhancements.md), which is where Follow (docs/specs/012-collaboration/follow-me-viewport.md) lives.
                        followingId={followMe.followingId}
                        onOpenCollaborators={openCollaborators}
                        onMoveTabToFolder={moveTabToFolder}
                        onRemoveTabFromFolder={removeTabFromFolder}
                        onRenameFolder={renameTabFolder}
                        activeTabHasContent={activeTab.elements.length > 0}
                        onSelect={selectTab}
                        onAdd={addTab}
                        onRename={renameTab}
                        onDuplicate={duplicateTab}
                        onDelete={deleteTab}
                        onClearContent={clearTabContent}
                        onImportTab={() => setImportOpen(true)}
                        onExportTab={() => {
                          setExportScope('tab');
                          setExportOpen(true);
                        }}
                        timer={activeTab.timer ?? null}
                        vote={activeTab.vote ?? null}
                        // Somebody else is running this session (docs/specs/012-collaboration/facilitator.md), so the Studio
                        // says whose it is and disables its controls.
                        facilitatedBy={facilitatorName}
                        facilitating={facilitator.isFacilitator}
                        onStartTimer={startTimer}
                        onPauseTimer={pauseTimer}
                        onResumeTimer={resumeTimer}
                        onResetTimer={resetTimer}
                        onExtendTimer={extendTimer}
                        onClearTimer={clearTimer}
                        onStartVote={startVote}
                        onEndVote={endVote}
                        onRevealVote={revealVote}
                        onClearVote={clearVote}
                        livePoll={livePoll.poll}
                        // A poll only reaches other people through the realtime room
                        // (docs/specs/012-collaboration/live-poll.md). Unshared and off-team, it still runs, just for you;
                        // the composer says so rather than refusing.
                        pollHasAudience={documentShareable || !!documentTeamId}
                        onStartPoll={livePoll.startPoll}
                        pollCollaborators={pollCollaborators}
                        voteLayers={layers}
                        activeLayerId={activeLayerId}
                        otherDocuments={
                          // Tab linking is a server-side row insert (docs/specs/006-document/tab-document-many-to-many.md), so neither an
                          // offline document's tabs nor an offline destination can take part
                          // (docs/specs/006-document/offline-mode.md) — empty list disables the menu entry.
                          isOffline
                            ? []
                            : documentList.filter(
                                (d) => d.id !== documentId && d.ownerId !== OFFLINE_OWNER_ID,
                              )
                        }
                        onCopyTabTo={linkActiveTabTo}
                        onToggleLockTab={toggleActiveTabLock}
                        opensInFor={ctx.opensInFor}
                        onReorder={reorderTabs}
                        // A tab-scoped visitor edits their tab's content at most, never the
                        // tabs around it (docs/specs/013-workspace/tab-scoped-share-links.md).
                        readOnly={isStructureReadOnly}
                        isOutOfScope={isOutOfScope}
                        renameActiveNonce={renameTabNonce}
                        participantsByTab={participantsByTab}
                        selfId={selfParticipant.id}
                        voteSelfId={voteSelfId}
                        selfRole={sessionRole}
                        onOpenSettings={() => {
                          // Preferences are user-scoped, not document-scoped, so
                          // view-role visitors can still flip them for their own
                          // browser (e.g. opt out of telemetry).
                          setSettingsOpen(true);
                          track('UI', 'Opened', 'Settings');
                        }}
                        onOpenSearch={() => {
                          setSearchOpen(true);
                          // Element search walks local tab state; pull every
                          // not-yet-visited tab's content so matches cover the
                          // whole document (docs/specs/008-canvas/canvas-and-palette.md "Search panel"). Best-effort
                          // and fire-and-forget: results refresh as tabs land.
                          void loadAllTabs();
                        }}
                        // Canvas right-click (desktop) + long-press (touch) open the active
                        // tab's menu with the canvas sections folded in, rendered by the
                        // TabBar so it reuses every tab handler. Element / multi context
                        // menus stay on EditorContextMenu below.
                        canvasMenu={contextMenu?.mode === 'canvas' ? contextMenu : null}
                        onCloseCanvasMenu={closeContextMenu}
                        canvasActions={{
                          onAutoAlign: autoAlignTab,
                          onAutoLayout: autoLayoutTab,
                          onPreviewCleanup: previewCleanup,
                          onEndCleanupPreview: endCleanupPreview,
                          // Paste straight from the empty-canvas right-click (docs/specs/008-canvas/canvas-and-palette.md).
                          onPaste: () =>
                            pasteFromClipboard(
                              undefined,
                              contextMenu?.mode === 'canvas'
                                ? (contextMenu.canvasPoint ?? null)
                                : null,
                            ),
                          canPaste: hasClipboard,
                        }}
                      />
                    </AreaErrorBoundary>
                  )}
                  {/* Quick style panel (docs/specs/008-canvas/quick-style-panel.md): the most-used style choices beside
              a selection. Stands down in zen / embeds / presenting and while an
              element menu is open, which is the complete home of every setting. */}
                  <AreaErrorBoundary area="QuickStyle">
                    <QuickStyleHost
                      deps={quickStyleDeps}
                      hidden={
                        zenMode ||
                        embedMode ||
                        // Off in Settings (docs/specs/007-editor/user-preferences.md); style memory stays.
                        !panelEnabled(userPreferences, 'quickStylePanelEnabled') ||
                        (contextMenu !== null && contextMenu.mode !== 'canvas')
                      }
                      // Phones never show it, so the desktop layout is the one that counts.
                      layout={resolvePanelLayout(userPreferences)}
                      powerUser={isPowerUserMode(userPreferences)}
                    />
                  </AreaErrorBoundary>
                  <AreaErrorBoundary area="Search">
                    <EditorSearchPanel />
                  </AreaErrorBoundary>
                  {/* Live poll (docs/specs/012-collaboration/live-poll.md). The prompt is shown to EVERY participant
          including view-role; the results panel unlocks once you've
          responded (or if you're the host). Both vanish with the poll —
          nothing here is persisted. */}
                  <PollPromptSheet
                    // Keyed on the poll so a second poll starts with a clean free-text
                    // box rather than inheriting the first one's half-typed answer.
                    key={livePoll.poll?.id ?? 'no-poll'}
                    poll={livePoll.poll && !livePoll.myAnswer ? livePoll.poll : null}
                    onAnswer={livePoll.answerPoll}
                  />
                  {/* Bring Focus (docs/specs/012-collaboration/bring-focus.md). A dialog like the poll prompt above, and for
          the same reason: it is a question addressed to you, not a status
          line. Shown to view-role visitors too. */}
                  <FocusInviteDialog
                    from={
                      focusInvite.invite
                        ? (livePresence.find((p) => p.id === focusInvite.invite!.from)?.name ??
                          'Someone')
                        : null
                    }
                    onAccept={focusInvite.acceptFocus}
                    onDismiss={focusInvite.dismissFocus}
                  />
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
                    <TourHost />
                  </AreaErrorBoundary>

                  {/* Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md), delayed ~5 min. Lifted above
          the 48px tab bar (pb-16) and over the canvas chrome (z-[var(--z-overlay)]). */}
                  {showSignInBanner ? (
                    <SignInBanner
                      surface="Editor"
                      onDismiss={dismissSignIn}
                      placementClassName="bottom-0 z-[var(--z-overlay)] pb-16"
                    />
                  ) : null}
                  {/* Empty-canvas hint (docs/specs/007-editor/new-document-route.md) — replaces the old centre-of-canvas card
          with a subdued, dismissible bottom banner so a blank document reads as
          intentionally blank. */}
                  {/* What a pasted board brought across (docs/specs/020-import-export/board-scene.md). */}
                  <BoardSceneNotice
                    notice={boardSceneInsert.notice}
                    onClose={boardSceneInsert.dismissNotice}
                  />
                  {showEmptyCanvasBanner ? (
                    <EmptyCanvasBanner
                      tabName={activeTab.name}
                      readOnly={isReadOnly}
                      onQuickStart={openTemplatePicker}
                    />
                  ) : null}
                  {/* Offer to match the editor chrome to the active tab's theme
          (dark theme -> dark mode, light theme -> light mode). Hidden in
          zen / embed like the other floating prompts, and yields the
          bottom-centre slot to the sign-in / empty-canvas banners. */}
                  {zenMode ||
                  embedMode ||
                  minimalChrome ||
                  drawMode ||
                  showSignInBanner ||
                  showEmptyCanvasBanner ? null : (
                    <ThemeModeBanner themeId={activeTab.theme} />
                  )}
                  {/* Modifier hint (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/021-event-storming/event-storming.md): names what holding Shift does
          right now, and offers the Alt insert-between gesture while a note is
          on the move. Suppressed while a mode banner owns the top slot. */}
                  {minimalChrome ? null : (
                    <ModifierHint
                      drag={drag}
                      esBoard={esBoard}
                      elements={activeTab.elements}
                      hasElements={activeTab.elements.length > 0}
                      suppressed={
                        canvasTool === 'format' || formatSourceId !== null || pendingDraw !== null
                      }
                    />
                  )}

                  {/* What a photo import is doing BEFORE the draft lands: a progress
            strip from the moment the file is picked, with Cancel. */}
                  <PhotoImportProgress
                    state={photoDraft.state}
                    onCancel={photoDraft.cancelReading}
                  />

                  {/* Step 1 + 2 of the wizard (docs/specs/021-event-storming/event-storming.md Phase 9): the photo with every
            box, tickable, and the words editable. Nothing lands until Add. */}
                  {photoDraft.state.stage === 'review' && photoDraft.review ? (
                    <PhotoReviewOverlay
                      review={photoDraft.review}
                      reading={
                        photoDraft.state.readSoFar < photoDraft.state.found &&
                        !photoDraft.review.readError
                      }
                      modelDownload={photoDraft.state.modelDownload}
                      readSoFar={photoDraft.state.readSoFar}
                      readTotal={photoDraft.state.found}
                      readerBackend={photoDraft.state.readerBackend}
                      readerWhy={photoDraft.state.readerWhy}
                      readerFallback={photoDraft.state.readerFallback}
                      rereading={photoDraft.rereading}
                      onReread={photoDraft.reread}
                      onConfirm={photoDraft.confirm}
                      onCancel={photoDraft.cancelReview}
                      // "Try another photo": leave this review and open the picker
                      // again, inside the same click, so the browser allows the dialog.
                      onRetake={() => {
                        photoDraft.cancelReview();
                        photoPickerRef.current?.click();
                      }}
                    />
                  ) : null}

                  {/* A photo import awaiting Add or Discard (docs/specs/021-event-storming/event-storming.md Phase 8). Derived
            from the tab's own draft notes, so a reload mid-import comes back to
            the same decision rather than to a board full of strays. Hidden
            while the words are still being read: that moment belongs to the
            progress strip above. */}
                  {photoDraft.state.stage !== 'detecting' ? (
                    <PhotoDraftBar
                      draftCount={draftNotes.length}
                      read={draftView?.read ?? null}
                      readError={draftView?.readError}
                      matchedCount={draftView ? draftView.matchedIds.size : null}
                      busy={photoDraft.state.stage === 'committing'}
                      onAccept={photoDraft.accept}
                      onDiscard={photoDraft.discard}
                    />
                  ) : null}

                  {/* The one file input behind "Add from photo". Hidden, opened by the
            palette row and the command palette; `capture` makes a phone open
            the camera straight away, because the act is "photograph this wall". */}
                  {photoImportAvailable ? (
                    <input
                      ref={photoPickerRef}
                      type="file"
                      accept={PHOTO_ACCEPT_ATTR}
                      capture="environment"
                      className="hidden"
                      aria-hidden
                      tabIndex={-1}
                      onChange={onPhotoPicked}
                    />
                  ) : null}

                  {/* An editor older than the server's document format offers a reload, once its edits
            are saved (docs/specs/016-platform/new-version-prompt.md). */}
                  <NewVersionPrompt hasUnsavedChanges={ctx.hasUnsavedChanges} />
                </div>
              </EditorModeProvider>
            </UiScaleProvider>
          </MinimalChromeProvider>
        </CanvasSurfaceProvider>
      </ViewportStoreProvider>
    </SelectionStoreProvider>
  );
}
