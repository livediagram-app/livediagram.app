'use client';

import { usePublishDocumentVisibility } from '@/hooks/editor/document-visibility-store';
import { CanvasFocusProvider } from '@/hooks/canvas/useCanvasFocus';
import dynamic from 'next/dynamic';
import { CommentBadgesContext } from '@/components/canvas/CommentBadgesContext';
import { SuppressElementIndicators } from '@/components/canvas/ElementIndicatorStyleContext';
import { EditorModeProvider } from '@/components/chrome/editor-mode/editor-mode-context';
import { truncateName } from '@livediagram/document';
import { openSearchWithPrefetch } from '@/lib/open-search';
import { track } from '@/lib/telemetry';
import { NewVersionPrompt } from '@/components/chrome/NewVersionPrompt';
import { registerUnsavedWork } from '@/lib/unsaved-work';
import { useEffect } from 'react';
import { addToDocumentTargets } from '@/lib/add-to-document-targets';
import { canvasSurface } from '@livediagram/document';
import { getTheme } from '@/lib/themes';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { readDrawPattern } from '@/lib/whiteboard-dock-prefs';
import { CanvasSurfaceProvider } from '@/components/canvas/CanvasSurfaceContext';
import { CanvasFinishProvider } from '@/components/canvas/CanvasFinishContext';
import { SketchFilterDefs } from '@/components/canvas/SketchFilterDefs';
import { ChangesetRevealContext } from '@/components/canvas/ChangesetRevealOverlay';
import { AgentFocusContext } from '@/components/canvas/AgentFocusOverlay';
import { SelectionStoreProvider } from '@/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { EditorCanvasHost } from '@/components/canvas/EditorCanvasHost';
import { PlanProvider } from '@/components/plan/PlanContext';
import { FormBoardContext } from '@/components/forms/form-board-context';
import { useFormBoardValue } from '@/hooks/forms/useFormBoardValue';
import { SheetsProviders } from '@/hooks/sheets/sheet-comments-context';
import { PresentationHost } from '@/components/canvas/PresentationHost';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { CommunityBar } from '@/components/chrome/CommunityBar';
import { useAutoCopyParam } from '@/hooks/canvas/useAutoCopyParam';
import { documentIsPublic } from '@/lib/community-public';
import { useCommunityState } from '@/lib/community-state-store';
import { useCommunityEnabled } from '@livediagram/ui';
import { API_BASE } from '@/lib/api-client';
import { EmbedChrome } from '@/components/chrome/EmbedChrome';
import { WorkbenchOpenLink, WorkbenchReconnectLine } from '@/components/chrome/WorkbenchChrome';
import { TabBar } from '@/components/chrome/TabBar';
import { SplitViewFrame } from '@/components/split/SplitViewFrame';
import { SignInBanner, SIGNIN_BANNER_DISMISS_KEY } from '@/components/chrome/SignInBanner';
import { EmptyCanvasBanner } from '@/components/canvas/EmptyCanvasBanner';
import { StartAgainTray } from '@/components/start/StartAgainTray';
import { StartViewTransition } from '@/components/start/StartViewTransition';
import { showsEmptyCanvasCard } from '@/components/canvas/empty-canvas-card';
import { BoardSceneNotice } from '@/components/canvas/BoardSceneNotice';
import { EditorModals } from '@/components/dialogs/EditorModals';
import { PollPromptSheet } from '@/components/panels/PollPromptSheet';
import { FocusInviteDialog } from '@/components/dialogs/FocusInviteDialog';
import { EditorTabDialogs } from '@/components/dialogs/EditorTabDialogs';
import { CollaboratorsHost } from '@/components/dialogs/CollaboratorsHost';
import { EditorElementDialogs } from '@/components/dialogs/EditorElementDialogs';
import { EditorContextMenuHost } from '@/components/palette/EditorContextMenuHost';
import { TourHost } from '@/components/tour/TourHost';
import { useEverTrue } from '@/hooks/ui/useEverTrue';
import { EditorAnchoredPopovers } from '@/components/panels/EditorAnchoredPopovers';
import { ModifierHint } from '@/components/chrome/ModifierHintBanner';
import { PhotoDraftBar } from '@/components/chrome/PhotoDraftBar';
import { PhotoImportProgress } from '@/components/chrome/PhotoImportProgress';
import { PHOTO_ACCEPT_ATTR } from '@/lib/photo-accept';
import { loadEditorSearchPanel } from '@/lib/editor-deferred-code';
import { usePhotoDraftView } from '@/lib/photo-draft-preview';
import { draftNotesOf, illustratePagesOf, readDashboard } from '@livediagram/document';
import { templateStartMode } from '@/components/start/template-start-mode';
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
import { DockNamesProvider } from '@/hooks/ui/useDockNames';
import { resolveUiScales } from '@/lib/ui-scale';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
// Each major area fails on its own and reports which one it was (docs/specs/017-telemetry/telemetry.md).
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import { QuickStyleHost } from '@/components/canvas/QuickStyleHost';
import { panelEnabled } from '@/lib/user-preferences';
import { BLANK_SHEET_CHOICE } from '@/lib/sheet-seeds';
import { useTemplatePickMove } from '@/components/start/useTemplatePickMove';
import { PendingFormStart } from '@/components/forms/PendingFormStart';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a document without
// Plan pays nothing for it.
// The template starts (docs/specs/007-editor/start-diagramming.md) carry every template's preview: loaded the first time
// an empty tab offers one, never on the editor's first load.
// Loaded when first drawn (docs/specs/016-platform/web-performance.md): search while it is open, the photo
// review once a wall photo is picked. The search panel's code is fetched once the editor is idle
// (EDITOR_SURFACE_CODE), so opening it does not wait.
const EditorSearchPanel = dynamic(loadEditorSearchPanel, { ssr: false });
const PhotoReviewOverlay = dynamic(
  () => import('@/components/chrome/PhotoReviewOverlay').then((m) => m.PhotoReviewOverlay),
  { ssr: false },
);
const StartFromTemplates = dynamic(
  () => import('@/components/start/StartFromTemplates').then((m) => m.StartFromTemplates),
  { ssr: false },
);
const PlanBoardPicker = dynamic(
  () => import('@/components/plan/PlanBoardPicker').then((m) => m.PlanBoardPicker),
  { ssr: false },
);
// A Form tab's page (docs/specs/030-forms/forms.md), fetched only when one is opened.
const FormPage = dynamic(() => import('@/components/forms/FormPage').then((m) => m.FormPage), {
  ssr: false,
});
// A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): only a Dashboard tab draws it.
const DashboardPage = dynamic(
  () => import('@/components/plan/dashboard/DashboardPage').then((m) => m.DashboardPage),
  { ssr: false },
);
const PlanSheetsHost = dynamic(
  () => import('@/components/plan/PlanSheetsHost').then((m) => m.PlanSheetsHost),
  { ssr: false },
);
// The Plan tour (docs/specs/026-plan/plan-tour.md) loads the first time the person enters Plan, and stays
// mounted after, so leaving Plan mid-tour still runs its clean-up.
const PlanTourHost = dynamic(
  () => import('@/components/tour/PlanTourHost').then((m) => m.PlanTourHost),
  { ssr: false },
);
// The Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md) loads the first time the person
// enters Facilitate, and stays mounted after, as the Plan tour does.
const FacilitateTourHost = dynamic(
  () => import('@/components/tour/FacilitateTourHost').then((m) => m.FacilitateTourHost),
  { ssr: false },
);
// The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab.
const FormTourHost = dynamic(
  () => import('@/components/tour/FormTourHost').then((m) => m.FormTourHost),
  { ssr: false },
);
// The Draw tour (docs/specs/023-draw-mode/draw-tour.md): the same, the first time the person enters Draw.
const DrawTourHost = dynamic(
  () => import('@/components/tour/DrawTourHost').then((m) => m.DrawTourHost),
  { ssr: false },
);
// Element tours (docs/specs/007-editor/element-tours.md): offered beside the selection toolbar of a toured element
// kind, so mounted with the editor; its chunk stays out of the first load.
const ElementTourHost = dynamic(
  () => import('@/components/tour/ElementTourHost').then((m) => m.ElementTourHost),
  { ssr: false },
);
// The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the same, the first time the person walks as an avatar.
const AvatarTourHost = dynamic(
  () => import('@/components/tour/AvatarTourHost').then((m) => m.AvatarTourHost),
  { ssr: false },
);
// The Illustrate tour (docs/specs/007-editor/illustrate-tour.md): the same, the first time the person enters
// Illustrate.
const IllustrateTourHost = dynamic(
  () => import('@/components/tour/IllustrateTourHost').then((m) => m.IllustrateTourHost),
  { ssr: false },
);

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
    slideDeck,
    hasClipboard,
    boardSceneInsert,
    activeId,
    activeTab,
    addTab,
    followMe,
    anyWelcomeOpen,
    embedMode,
    // The app's surroundings, and the workbench session (docs/specs/013-workspace/blueprints/
    // workbench-embeds.md, Surface table).
    appChrome,
    workbench,
    quickStyleDeps,
    livePoll,
    focusInvite,
    livePresence,
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
    canShareDocument,
    isOwner,
    isReadOnly,
    isStructureReadOnly,
    isOutOfScope,
    linkActiveTabTo,
    loadAllTabs,
    makeCopy,
    openTemplatePicker,
    participantsByTab,
    pendingDraw,
    renameTab,
    renameTabFolder,
    moveTabToFolder,
    removeTabFromFolder,
    reorderTabs,
    connectSourceId,
    cancelConnect,
    selfParticipant,
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
  // The header badge follows the document's Community post (docs/specs/025-community/community.md).
  const communityState = useCommunityState(documentId);
  // The badge goes too while the Community is switched off (docs/specs/025-community/community.md).
  // Asked only while there is a listed post to badge, and never in an embed, so other opens make no request.
  const communityOn = useCommunityEnabled(API_BASE, communityState === 'listed' && appChrome);
  // `?copy=1` from the Community's Make a Copy (docs/specs/025-community/community.md).
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
    documentId: ctx.documentId,
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
  // theme so the editor chrome matches the document (docs/specs/011-theme/canvas-and-theme-dialog.md).
  // One look in both editor modes (docs/specs/007-editor/editor-modes.md "One look"), so the accent
  // follows the tab's theme in Draw mode too.
  const mountPlanTour = useEverTrue(ctx.editorMode.mode === 'plan');
  const mountFacilitateTour = useEverTrue(ctx.editorMode.mode === 'facilitate');
  const mountDrawTour = useEverTrue(ctx.editorMode.mode === 'draw');
  const mountFormTour = useEverTrue(activeTab.kind === 'form');
  const mountAvatarTour = useEverTrue(canvasTool === 'avatar');
  const mountIllustrateTour = useEverTrue(ctx.editorMode.mode === 'illustrate');
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
  const signInTimerEnabled = clerkEnabled && !clerkUserId && appChrome && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInBanner = signInTimerEnabled && !zenMode && signInDelayElapsed;
  // Empty-canvas hint (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): a card in the middle of
  // the canvas while the active tab has no elements. Not dismissible: it goes once there's content. The sign-in nudge
  // sits at the bottom, clear of it, so the two show together.
  const showEmptyCanvasBanner = showsEmptyCanvasCard({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    quickStartOpen: templateGridOpen,
    drawToolArmed: !!pendingDraw,
    mode: ctx.editorMode.mode,
    elementCount: activeTab.elements.length,
  });
  // An editor's empty Diagram, Facilitate or Illustrate tab: its template start (docs/specs/007-editor/start-diagramming.md).
  // A template picked from a start screen on a document /new just made goes to its default folder
  // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
  const moveOnTemplatePick = useTemplatePickMove({
    ownerId: ctx.selfParticipant.id,
    documentId: ctx.documentId,
    tabId: activeTab.id,
    signedIn: !!clerkUserId,
    tabHasContent: activeTab.elements.length > 0,
  });
  const templateStart = templateStartMode({
    hydrated,
    zen: zenMode,
    embed: embedMode,
    readOnly: isReadOnly,
    quickStartOpen: templateGridOpen,
    drawToolArmed: !!pendingDraw,
    mode: ctx.editorMode.mode,
    elementCount: activeTab.elements.length,
    // Read only for an empty Illustrate tab: EditorView renders often, and a tab with content shows no start.
    pages:
      ctx.editorMode.mode === 'illustrate' && activeTab.elements.length === 0
        ? illustratePagesOf(activeTab)
        : [],
  });
  // An empty Plan tab: the board types, in the middle of the canvas. Anything already drawn (a board, a shape, a
  // view) hides it; the palette's Boards still add one.
  const dashboardHasRows = (readDashboard(activeTab.dashboard)?.rows.length ?? 0) > 0;
  const showPlanBoardPicker =
    hydrated &&
    !zenMode &&
    !embedMode &&
    !isReadOnly &&
    !templateGridOpen &&
    ctx.editorMode.mode === 'plan' &&
    (activeTab.kind === 'dashboard'
      ? !dashboardHasRows
      : activeTab.kind === 'form'
        ? !activeTab.form
        : activeTab.elements.length === 0);
  // A Dashboard tab's page (docs/specs/026-plan/plan-tabs.md), for everyone who opens it; one with no rows left shows
  // Start Planning again, a new choice replacing it.
  const showDashboard = hydrated && activeTab.kind === 'dashboard' && dashboardHasRows;
  // A Form tab's page (docs/specs/030-forms/forms.md), for everyone who opens it.
  const showForm = hydrated && activeTab.kind === 'form' && !!activeTab.form;
  // The photo draft awaiting a decision, and the session-local view state
  // that goes with it (docs/specs/021-event-storming/event-storming.md Phase 8).
  const draftNotes = draftNotesOf(activeTab.elements);
  const draftView = usePhotoDraftView();
  const backdrop = resolveViewBackdrop(
    activeTab,
    { mode: ctx.editorMode.mode, drawPattern: readDrawPattern(userPreferences) },
    appearance,
  );

  // The same visibility for the Explorer panel's Current Document card (document-visibility-store).
  const headerCommunity = documentIsPublic({
    communityOn,
    ownPostState: communityState,
    communitySession: sessionCommunity !== null,
  });
  usePublishDocumentVisibility(
    documentShareable,
    !!documentTeamId,
    isOffline,
    headerCommunity,
    canShareDocument && hydrated
      ? () => {
          setShareDialogOpen(true);
          track('UI', 'Opened', 'Share');
        }
      : undefined,
  );

  // The site header. Zen / focus mode (docs/specs/007-editor/zen-mode.md) hides it entirely so the
  // canvas gets the full height; embeds (docs/specs/013-workspace/embeds.md) never show it. Side by
  // side (docs/specs/007-editor/split-view.md) lays it across both panes.
  const header =
    zenMode || !appChrome ? null : (
      <AreaErrorBoundary area="Header" fallback="panel">
        <EditorHeader
          documentName={documentName}
          hideTitle={anyWelcomeOpen}
          showShare={canShareDocument && hydrated && !anyWelcomeOpen}
          shareable={documentShareable}
          community={headerCommunity}
          teamDocument={!!documentTeamId}
          offline={isOffline}
          // Visitors see "Make a copy" instead of "Share": same slot (a joined
          // team member is no visitor: the team's documents are theirs to share),
          // different action. Hidden during the welcome flow so the
          // first-paint chrome stays minimal, and during hydration so
          // we don't render the button before we know whether the user
          // is the owner. A Community visitor gets it from the Community bar instead.
          onMakeCopy={
            !canShareDocument && hydrated && !anyWelcomeOpen && documentId && !sessionCommunity
              ? makeCopy
              : undefined
          }
          copying={copying}
          readOnly={isStructureReadOnly}
          renameNonce={renameDocumentNonce}
          // Minimal chrome moves the pill to an icon in the status bar.
          rolePill={minimalChrome ? undefined : <RolePill {...role} />}
          // docs/specs/012-collaboration/presentation-mode.md "The header's Present button": only
          // while the deck has a slide to show, on a desktop, once the document is up. Every role.
          present={
            hydrated && !anyWelcomeOpen && !isMobileViewport && slideDeck.runnable.length > 0
              ? {
                  slideCount: slideDeck.runnable.length,
                  starting: slideDeck.startingDeck,
                  onPresent: () => {
                    track('UI', 'Opened', 'HeaderPresent');
                    void slideDeck.start();
                  },
                }
              : undefined
          }
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
    );

  // The tab bar, the editor's footer. Hidden through the welcome flow, in zen mode and in embeds.
  // Side by side (docs/specs/007-editor/split-view.md) lays it across both panes, like the header.
  const footer =
    anyWelcomeOpen || zenMode || embedMode ? null : (
      <AreaErrorBoundary area="TabBar" fallback="panel">
        <TabBar
          powerUser={isPowerUserMode(userPreferences)}
          workbenchLink={
            workbench && documentId
              ? (labelled) => <WorkbenchOpenLink documentId={documentId} labelled={labelled} />
              : undefined
          }
          roleIcon={
            minimalChrome ? <RoleStatusIcon role={role.role} onToggle={role.onToggle} /> : undefined
          }
          tabs={tabs}
          activeId={activeId}
          // Clicking an avatar in a presence stack opens the Collaborators
          // modal (docs/specs/012-collaboration/collaborator-enhancements.md), which is where Follow (docs/specs/012-collaboration/follow-me-viewport.md) lives.
          followingId={followMe.followingId}
          followerCount={followMe.followerCount}
          onOpenCollaborators={openCollaborators}
          onMoveTabToFolder={moveTabToFolder}
          onRemoveTabFromFolder={removeTabFromFolder}
          onRenameFolder={renameTabFolder}
          activeTabHasContent={activeTab.elements.length > 0}
          onSelect={selectTab}
          onAdd={() => addTab()}
          onRename={renameTab}
          onDuplicate={duplicateTab}
          onDelete={deleteTab}
          onClearContent={clearTabContent}
          onImportTab={() => setImportOpen(true)}
          onExportTab={() => {
            setExportScope('tab');
            setExportOpen(true);
          }}
          otherDocuments={addToDocumentTargets({
            documentId,
            documentList,
            isOffline,
            workbench: workbench !== null,
            isOwner,
          })}
          onCopyTabTo={linkActiveTabTo}
          onToggleLockTab={toggleActiveTabLock}
          modeChoiceFor={ctx.modeChoiceFor}
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
            onPaste: () =>
              pasteFromClipboard(
                undefined,
                contextMenu?.mode === 'canvas' ? (contextMenu.canvasPoint ?? null) : null,
              ),
            canPaste: hasClipboard,
          }}
        />
      </AreaErrorBoundary>
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
          {/* The active tab's finish (docs/specs/008-canvas/finish.md), for the menus and panels; each
              canvas provides its own tab's again. */}
          <CanvasFinishProvider finish={activeTab.finish}>
            {/* The wobble Sketch palette tiles are drawn through (palette-tile-finish.ts). */}
            <SketchFilterDefs />
            {/* Plan boards and cards, and the dialogs that draw them (exports), read the items and
              their actions here (docs/specs/026-plan/plan-board.md). */}
            <PlanProvider value={ctx.plan.context}>
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
                    <MinimalChromeProvider
                      value={minimalChrome}
                      powerUser={isPowerUserMode(userPreferences)}
                    >
                      <UiScaleProvider value={uiScales}>
                        <DockNamesProvider value={userPreferences?.dockButtonNames !== false}>
                          <EditorModeProvider value={ctx.editorMode}>
                            {/* Side by side tabs (docs/specs/007-editor/split-view.md): the editor, and another
                      tab of the document live beside it when one has been dragged to the right. */}
                            <SplitViewFrame header={header} footer={footer}>
                              {(headerInColumn, footerInColumn, splitShowing) => (
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
                                        <span className="text-brand-700 dark:text-brand-300">
                                          Cancel
                                        </span>
                                      </button>
                                    </div>
                                  ) : null}
                                  {headerInColumn}
                                  {sessionCommunity && appChrome && hydrated ? (
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
                                        <CommentBadgesContext.Provider
                                          value={!(embedMode && isReadOnly) && !sessionCommunity}
                                        >
                                          {/* Indicators are editor chrome: an embed never draws them (docs/specs/008-canvas/element-indicators.md). */}
                                          <SuppressElementIndicators when={embedMode}>
                                            <EditorCanvasHost />
                                          </SuppressElementIndicators>
                                        </CommentBadgesContext.Provider>
                                      </AgentFocusContext.Provider>
                                    </ChangesetRevealContext.Provider>
                                    {ctx.plan.openItemId || ctx.plan.editingTypeId ? (
                                      <PlanSheetsHost plan={ctx.plan} />
                                    ) : null}
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
                                  {workbench ? (
                                    // The workbench's Reconnect line; its Open in livediagram sits in the tab bar.
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
                                      deps={quickStyleDeps}
                                      hidden={
                                        // Not beside another tab (docs/specs/007-editor/split-view.md): half a window has
                                        // no room for it next to the selection.
                                        splitShowing ||
                                        zenMode ||
                                        embedMode ||
                                        // Not in Plan mode (docs/specs/026-plan/plan-mode.md): a board's look is its theme's.
                                        ctx.editorMode.mode === 'plan' ||
                                        // Off in Settings (docs/specs/007-editor/user-preferences.md); style memory stays.
                                        !panelEnabled(userPreferences, 'quickStylePanelEnabled') ||
                                        (contextMenu !== null && contextMenu.mode !== 'canvas')
                                      }
                                      powerUser={isPowerUserMode(userPreferences)}
                                    />
                                  </AreaErrorBoundary>
                                  {ctx.searchOpen ? (
                                    <AreaErrorBoundary area="Search">
                                      <EditorSearchPanel />
                                    </AreaErrorBoundary>
                                  ) : null}
                                  {/* Live poll (docs/specs/012-collaboration/live-poll.md). The prompt is shown to EVERY participant
          including view-role; the results panel unlocks once you've
          responded (or if you're the host). Both vanish with the poll —
          nothing here is persisted. */}
                                  <PollPromptSheet
                                    // Keyed on the poll so a second poll starts with a clean free-text
                                    // box rather than inheriting the first one's half-typed answer.
                                    key={livePoll.poll?.id ?? 'no-poll'}
                                    // Asked of whoever may answer (docs/specs/013-workspace/share-roles.md): a Viewer only looks.
                                    poll={
                                      ctx.can.takePart && livePoll.poll && !livePoll.myAnswer
                                        ? livePoll.poll
                                        : null
                                    }
                                    onAnswer={livePoll.answerPoll}
                                  />
                                  {/* Bring Focus (docs/specs/012-collaboration/bring-focus.md). A dialog like the poll prompt above, and for
          the same reason: it is a question addressed to you, not a status
          line. Shown to view-role visitors too. */}
                                  <FocusInviteDialog
                                    from={
                                      focusInvite.invite
                                        ? (livePresence.find(
                                            (p) => p.id === focusInvite.invite!.from,
                                          )?.name ?? 'Someone')
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
                                    {/* The Plan tour (docs/specs/026-plan/plan-tour.md): the first time a person works in Plan. */}
                                    {mountPlanTour ? <PlanTourHost /> : null}
                                    {/* The Facilitate tour (docs/specs/012-collaboration/facilitate-tour.md): the first time a person works in Facilitate. */}
                                    {mountFacilitateTour ? <FacilitateTourHost /> : null}
                                    {mountDrawTour ? <DrawTourHost /> : null}
                                    {/* The Forms tour (docs/specs/030-forms/forms.md "The Forms tour"): the first time an Editor opens a Form tab. */}
                                    {mountFormTour ? <FormTourHost /> : null}
                                    {/* A form template's form, started once its tab opens (lib/pending-form-start.ts). */}
                                    <PendingFormStart />
                                    {/* The Avatar tour (docs/specs/008-canvas/avatar-tour.md): the first time a person walks as an avatar. */}
                                    {mountAvatarTour ? <AvatarTourHost /> : null}
                                    {mountIllustrateTour ? <IllustrateTourHost /> : null}
                                    <ElementTourHost />
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
                                  {/* What a pasted board brought across (docs/specs/020-import-export/board-scene.md). */}
                                  <BoardSceneNotice
                                    notice={boardSceneInsert.notice}
                                    onClose={boardSceneInsert.dismissNotice}
                                  />
                                  {showDashboard ? (
                                    <DashboardPage
                                      // One page per Dashboard: opening another draws it still (useSlotEnter).
                                      key={activeTab.id}
                                      tab={activeTab}
                                      tabs={tabs}
                                      // A locked tab's Dashboard reads as a Viewer's does (plan-tabs.md "Dashboard tab").
                                      canEdit={ctx.can.level === 'edit' && !ctx.activeTabLocked}
                                      actions={ctx.planTabs}
                                      openTab={selectTab}
                                      loadTabs={loadAllTabs}
                                      loadedTabIds={ctx.loadedTabIds}
                                      deleteTab={deleteTab}
                                      releaseSheets={ctx.releaseSheets}
                                      renameTab={renameTab}
                                    />
                                  ) : null}
                                  {showForm ? (
                                    <FormPage
                                      key={activeTab.id}
                                      tab={activeTab}
                                      tabs={tabs}
                                      // A locked tab's form reads as a Viewer's does.
                                      canEdit={ctx.can.level === 'edit' && !ctx.activeTabLocked}
                                      actions={ctx.forms}
                                      openTab={selectTab}
                                      loadTabs={loadAllTabs}
                                      documentId={ctx.documentId}
                                      ownerId={ctx.selfParticipant.id}
                                      share={ctx.sessionShareCode}
                                      online={!isOffline}
                                    />
                                  ) : null}
                                  {/* One View Transition around every start, so a mode change turns the panel in place. */}
                                  <StartViewTransition>
                                    {showPlanBoardPicker ? (
                                      <PlanBoardPicker
                                        // Each choice makes the tab its kind (docs/specs/026-plan/plan-tabs.md).
                                        onPick={(preset) => {
                                          const c = ctx.getViewportCenter();
                                          ctx.planTabs.startElementTab('board', () =>
                                            ctx.dropPaletteItem('plan-board', c.x, c.y, {
                                              choice: preset,
                                            }),
                                          );
                                        }}
                                        onPickSheet={(start) => {
                                          const c = ctx.getViewportCenter();
                                          ctx.planTabs.startElementTab('sheet', () =>
                                            ctx.dropPaletteItem(
                                              'plan-sheet',
                                              c.x,
                                              c.y,
                                              // Empty Sheet: a blank grid, with no Setup Sheet (plan-tabs.md "Names").
                                              { choice: start ?? BLANK_SHEET_CHOICE },
                                            ),
                                          );
                                        }}
                                        onDashboard={ctx.planTabs.startDashboard}
                                        // Something Else: the Quick Start, on Everything.
                                        onQuickStart={openTemplatePicker}
                                        onTemplate={(kind) => {
                                          void ctx.chooseTemplate(kind);
                                          moveOnTemplatePick(kind);
                                        }}
                                        tabs={tabs}
                                        loadTabs={loadAllTabs}
                                        onSuggestedDashboard={ctx.planTabs.startSuggestedDashboard}
                                        onVisualisation={ctx.planTabs.startVisualisationTab}
                                        onForm={ctx.forms.startForm}
                                      />
                                    ) : null}
                                    {/* Empty-canvas hint (docs/specs/007-editor/new-document-route.md): a calm card in the
          middle of an empty canvas, so a blank document reads as intentionally blank. */}
                                    {/* An editor's empty Diagram, Facilitate or Illustrate tab offers its template start, in
          the card's place (docs/specs/007-editor/start-diagramming.md). */}
                                    {templateStart ? (
                                      <>
                                        <StartFromTemplates
                                          key={`${activeTab.id}:${templateStart}`}
                                          mode={templateStart}
                                          tabId={activeTab.id}
                                          onTemplate={(kind) => {
                                            void ctx.chooseTemplate(kind);
                                            moveOnTemplatePick(kind);
                                          }}
                                          onQuickStart={openTemplatePicker}
                                        />
                                        {/* Closed, it can be brought back from the palette tray (StartAgainTray). */}
                                        <StartAgainTray
                                          key={`tray:${activeTab.id}:${templateStart}`}
                                          mode={templateStart}
                                          tabId={activeTab.id}
                                          tabName={activeTab.name}
                                        />
                                      </>
                                    ) : showEmptyCanvasBanner ? (
                                      <EmptyCanvasBanner
                                        key={activeTab.id}
                                        tabId={activeTab.id}
                                        tabName={activeTab.name}
                                        readOnly={isReadOnly}
                                        participant={ctx.can.addContent && isReadOnly}
                                        onQuickStart={openTemplatePicker}
                                      />
                                    ) : null}
                                  </StartViewTransition>

                                  {/* Modifier hint (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/021-event-storming/event-storming.md): names what holding Shift does
          right now, and offers the Alt insert-between gesture while a note is
          on the move. Suppressed while a mode banner owns the top slot. */}
                                  {minimalChrome ? null : (
                                    <ModifierHint
                                      readOnly={isReadOnly}
                                      drag={drag}
                                      esBoard={esBoard}
                                      elements={activeTab.elements}
                                      hasElements={activeTab.elements.length > 0}
                                      suppressed={
                                        canvasTool === 'format' ||
                                        formatSourceId !== null ||
                                        pendingDraw !== null
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

                                  {/* The one file input behind "Add from Photo". Hidden, opened by the
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
                              )}
                            </SplitViewFrame>
                          </EditorModeProvider>
                        </DockNamesProvider>
                      </UiScaleProvider>
                    </MinimalChromeProvider>
                  </CanvasFocusProvider>
                </SheetsProviders>
              </FormBoardContext.Provider>
            </PlanProvider>
          </CanvasFinishProvider>
        </CanvasSurfaceProvider>
      </ViewportStoreProvider>
    </SelectionStoreProvider>
  );
}
