'use client';

import { isTypingTarget } from '@/lib/typing-target';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import { participantKey } from '@/lib/identity';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { CanvasAiPanel } from './CanvasAiPanel';
import { LazyExplorer } from '@/components/panels/LazyExplorer';
import type { CanvasChromeProps } from './CanvasChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';
import { stripSegmentGone, type SessionStripTools } from './SessionClusterStrip';
import { useWithheldExplorerCloses } from './useWithheldExplorerCloses';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a document without
// Plan pays nothing for it.
const CardFinderPanel = dynamic(
  () => import('@/components/plan/CardFinderPanel').then((m) => m.CardFinderPanel),
  { ssr: false },
);
const TrashPanel = dynamic(() => import('@/components/plan/TrashPanel').then((m) => m.TrashPanel), {
  ssr: false,
});
const NewCardPanel = dynamic(
  () => import('@/components/plan/NewCardPanel').then((m) => m.NewCardPanel),
  { ssr: false },
);
const CardTypesPanel = dynamic(
  () => import('@/components/plan/CardTypesPanel').then((m) => m.CardTypesPanel),
  { ssr: false },
);

// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments. It stacks below the Palette (the
// top-right panel). Most documents never accumulate comments, so deferring
// the 164-line panel + its relative-time formatting
// dependencies keeps the editor's initial chunk lean.
const CollaboratePanel = dynamic(
  () => import('@/components/panels/CollaboratePanel').then((m) => m.CollaboratePanel),
  { ssr: false },
);

// Lazy for the same reason: the Session strip's popovers (docs/specs/012-collaboration/session-tools.md
// "The Session strip") load on the first press of a Timer, Vote or Poll button.
const SessionPopover = dynamic(() => import('./SessionPopover').then((m) => m.SessionPopover), {
  ssr: false,
});

// Lazy for the same reason: the Actions panel (docs/specs/012-collaboration/assigned-actions.md) only mounts when
// the active tab has at least one element with an OPEN assigned action.

// The floating panels as elements (docs/specs/007-editor/panel-docking.md), lifted out of CanvasChrome:
// the stable handler bundles for the memo'd panels, the docking-aware
// wiring per panel, and each panel's element with
// its own visibility gate. CanvasChrome distributes the returned map into
// the corner stacks (docking) or renders the elements inline (zen). The
// Explorer and the cluster popovers render beside the corner layer. The
// tool-config panels, on screen only while
// their own tool is active, live in useCanvasToolPanels.
// The Explorer popover never moves, so its MovablePanel's move handler has nothing to do.
const NO_MOVE = () => {};

export function useCanvasChromePanels({
  props,
  stripTools,
  chromeHidden,
  isMobile,
  panelWiringFor,
  panelsOn,
}: {
  props: CanvasChromeProps;
  // The tools the Session strip offers (sessionStripTools), as CanvasChrome drew them.
  stripTools: SessionStripTools | null;
  chromeHidden: boolean;
  isMobile: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
  // Which panels are on in Settings (docs/specs/007-editor/user-preferences.md), read by CanvasChrome
  // so each panel and its cluster button agree.
  panelsOn: { collaborate: boolean };
}): {
  panelEls: Partial<Record<PanelId, ReactNode>>;
  // The Explorer, a popover under the menu button (docs/specs/007-editor/toolbar-layout.md).
  explorerEl: ReactNode;
  collaborateEl: ReactNode;
  // The Card Types panel over its cluster button (docs/specs/026-plan/item-types.md).
  cardTypesPopoverEl: ReactNode;
  trashPopoverEl: ReactNode;
  newCardPopoverEl: ReactNode;
  cardFinderPopoverEl: ReactNode;
  // The Session strip's open popover (Timer, Vote or Poll), over its button.
  sessionPopoverEl: ReactNode;
  // The Avatar panel over its button (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel").
  avatarPopoverEl: ReactNode;
} {
  const {
    activeDockAnchor,
    activeDockPanel,
    aiPanel,
    actionRows,
    commentRows,
    commentsPanelPosition,
    currentDocumentId,
    documentList,
    documentListLoading,
    elements,
    folders,
    userPreferences,
    onToggleRecentExclusion,
    favouriteIds,
    onToggleFavourite,
    pollPanel,
    tabVote,
    voteResults,
    onJumpToVoteResult,
    isVoteHost,
    participantCount,
    voteReview,
    onNextVoteResult,
    onPrevVoteResult,
    onDoneVoteReview,
    onCreateFolder,
    onDeleteDocument,
    onDeleteFolder,
    onDismissShared,
    onDuplicateDocument,
    onMoveCommentsPanel,
    onMoveDocumentToFolder,
    onMoveDocumentTo,
    onLibraryChanged,
    onNewDocument,
    explorerMenuActions,
    onOpenActionForElement,
    onToggleActionDone,
    onOpenCommentsForElement,
    onOpenDocument,
    onRenameCurrent,
    onRenameFolder,
    onTeamFolders,
    onResetCommentsPanel,
    readOnly,
    takePart,
    selfParticipant,
    setActiveDockAnchor,
    setActiveDockPanel,
    settings,
    sharedDocuments,
    tabName,
    teamDocuments,
    teamFolders,
    teams,
    zenMode,
  } = props;
  // Stable handler identities for the React.memo'd Explorer so it skips re-rendering on every drag frame even
  // though this chrome host re-renders with the canvas. useStableCallbacks
  // keeps each reference fixed while always invoking the latest prop, so
  // there's no stale-closure risk despite the parent's per-frame churn.
  // (The panels' data props are already stable: list state doesn't change
  // mid-drag, and EditorView memoises the `teams` array.)
  const explorerHandlers = useStableCallbacks({
    onDismissShared,
    onOpenDocument,
    onNewDocument,
    onRenameCurrent,
    onDeleteDocument,
    onDuplicateDocument,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveDocumentToFolder,
    onMoveDocumentTo,
    onLibraryChanged,
    onMenuShare: explorerMenuActions?.onShare,
    onMenuExport: explorerMenuActions?.onExport,
    onMenuSearch: explorerMenuActions?.onSearch,
    onMenuSettings: explorerMenuActions?.onOpenSettings,
  });
  // The ⋯ menu's rows, stable like the rest; a row stays absent while its
  // handler is, since the stable wrapper alone would always look present.
  const hasShare = !!explorerMenuActions?.onShare;
  const hasExport = !!explorerMenuActions?.onExport;
  const hasSearch = !!explorerMenuActions?.onSearch;
  const hasSettings = !!explorerMenuActions?.onOpenSettings;
  const explorerMenu = useMemo(
    () => ({
      onShare: hasShare ? explorerHandlers.onMenuShare : undefined,
      onExport: hasExport ? explorerHandlers.onMenuExport : undefined,
      onSearch: hasSearch ? explorerHandlers.onMenuSearch : undefined,
      onOpenSettings: hasSettings ? explorerHandlers.onMenuSettings : undefined,
    }),
    [explorerHandlers, hasShare, hasExport, hasSearch, hasSettings],
  );

  const closeDockPanel = useCallback(() => {
    setActiveDockPanel(null);
    setActiveDockAnchor(null);
  }, [setActiveDockPanel, setActiveDockAnchor]);

  // --- Corner panels as elements (docs/specs/007-editor/panel-docking.md) ---
  // Built once with docking-aware wiring, then rendered either inline (zen)
  // or distributed into corner stacks. Each keeps its own visibility gate.
  const collaborateWiring = panelWiringFor(
    'collaborate',
    commentsPanelPosition,
    onResetCommentsPanel,
  );
  const aiWiring = aiPanel ? panelWiringFor('ai', aiPanel.position, aiPanel.onReset) : null;
  // The five tool-config panels (avatar / laser / spotlight / format /
  // slide deck), see useCanvasToolPanels. They share one contract: on screen
  // only while their own tool is active.
  // The Card Types popover, and the Plan strip's others, over their buttons.
  const cardTypesOpen = activeDockPanel === 'card-types';
  const trashOpen = activeDockPanel === 'plan-trash';
  const cardFinderOpen = activeDockPanel === 'plan-cards';
  const newCardOpen = activeDockPanel === 'plan-new-card';
  // The Avatar panel belongs to its button, which belongs to the mode: leaving Avatar mode closes it.
  const avatarMode = props.canvasTool === 'avatar';
  const avatarOpen = activeDockPanel === 'avatar' && avatarMode;
  useEffect(() => {
    if (activeDockPanel === 'avatar' && !avatarMode) closeDockPanel();
  }, [activeDockPanel, avatarMode, closeDockPanel]);
  // Escape closes the Avatar panel and nothing else (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel"):
  // caught ahead of the editor's shortcuts, where Escape would otherwise leave Avatar mode altogether. A typing
  // field in the panel (the message view) handles its own Escape first.
  useEffect(() => {
    if (!avatarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      closeDockPanel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [avatarOpen, closeDockPanel]);
  const { avatarEl, laserEl, spotlightEl, formatEl, slideDeckEl } = useCanvasToolPanels({
    props,
    chromeHidden,
    panelWiringFor,
    avatarPopover: avatarOpen
      ? { anchor: activeDockAnchor ?? undefined, onClose: closeDockPanel }
      : null,
  });

  // Mounted from its first opening on, never before (its code loads then), and kept mounted after so
  // the folders someone expanded stay expanded.
  const explorerOpen = activeDockPanel === 'explorer';
  const [explorerOpened, setExplorerOpened] = useState(explorerOpen);
  if (explorerOpen && !explorerOpened) setExplorerOpened(true);
  // Withheld (the workbench frame, a phone held sideways), an open Explorer closes.
  const explorerHidden = !!props.explorerHidden;
  useWithheldExplorerCloses(explorerHidden, explorerOpen, closeDockPanel);
  const explorerEl =
    zenMode || explorerHidden || !explorerOpened ? null : (
      <LazyExplorer
        recentExcludedIds={userPreferences.recentExcludedIds ?? []}
        onToggleRecentExclusion={onToggleRecentExclusion}
        favouriteIds={favouriteIds}
        onToggleFavourite={onToggleFavourite}
        // A popover under the menu button (docs/specs/007-editor/toolbar-layout.md): never placed or dragged.
        position={null}
        documents={documentList}
        ownerId={selfParticipant?.id ?? null}
        folders={folders}
        loading={documentListLoading}
        shared={sharedDocuments}
        teams={teams}
        teamFolders={teamFolders}
        teamDocuments={teamDocuments}
        onDismissShared={explorerHandlers.onDismissShared}
        currentDocumentId={currentDocumentId}
        onMoveTo={NO_MOVE}
        onOpenDocument={explorerHandlers.onOpenDocument}
        onNewDocument={explorerHandlers.onNewDocument}
        menuActions={explorerMenu}
        onRenameCurrent={explorerHandlers.onRenameCurrent}
        onDeleteDocument={explorerHandlers.onDeleteDocument}
        onLibraryChanged={explorerHandlers.onLibraryChanged}
        onDuplicateDocument={explorerHandlers.onDuplicateDocument}
        onCreateFolder={explorerHandlers.onCreateFolder}
        onRenameFolder={explorerHandlers.onRenameFolder}
        onDeleteFolder={explorerHandlers.onDeleteFolder}
        onTeamFolders={onTeamFolders}
        onMoveDocumentToFolder={explorerHandlers.onMoveDocumentToFolder}
        onMoveDocumentTo={onMoveDocumentTo ? explorerHandlers.onMoveDocumentTo : undefined}
        popoverOpen={explorerOpen}
        popoverAnchor={activeDockAnchor ?? undefined}
        asPopover
        dismissOnOutside
        onPopoverClose={closeDockPanel}
      />
    );

  // Collaborate panel (docs/specs/012-collaboration/assigned-actions.md §5): a popover hanging above its
  // cluster button after Layers, in every layout (the button opens it through
  // the dock's one-open-at-a-time slot; popoverOpen gates the render).
  // Mounted only while the tab has a thread or an action, the button's gate,
  // and never while its Settings switch is off (docs/specs/007-editor/user-preferences.md).
  const collaborateEl =
    !chromeHidden && panelsOn.collaborate && (commentRows.length > 0 || actionRows.length > 0) ? (
      <CollaboratePanel
        position={collaborateWiring.position}
        commentRows={commentRows}
        actionRows={actionRows}
        onMoveTo={onMoveCommentsPanel}
        onReset={collaborateWiring.onReset}
        // It steps aside once a row takes you somewhere, or on a phone it
        // would cover the card you just went to.
        onCommentRowClick={(id, cell) => {
          onOpenCommentsForElement(id, cell);
          closeDockPanel();
        }}
        onActionRowClick={(id) => {
          onOpenActionForElement(id);
          closeDockPanel();
        }}
        onToggleActionDone={onToggleActionDone}
        popoverOpen={activeDockPanel === 'collaborate'}
        popoverAnchor={activeDockAnchor ?? undefined}
        asPopover
        dismissOnOutside
        onPopoverClose={closeDockPanel}
      />
    ) : null;

  const aiEl =
    !chromeHidden && aiPanel && aiWiring ? (
      <CanvasAiPanel aiPanel={aiPanel} wiring={aiWiring} tabName={tabName} settings={settings} />
    ) : null;

  // The Session strip's popovers (docs/specs/012-collaboration/session-tools.md "The Session strip"). A
  // segment whose button has gone (a view-role visitor's tool ended, a poll dismissed) closes its
  // popover rather than leaving it floating with no button under it.
  const sessionSegment =
    activeDockPanel === 'session-timer' ||
    activeDockPanel === 'session-vote' ||
    activeDockPanel === 'session-poll'
      ? activeDockPanel
      : null;
  // Only the tools the mode's strip offers (docs/specs/012-collaboration/session-tools.md).
  const sessionTools = stripTools ? props.sessionTools : undefined;
  const sessionButtonGone = stripSegmentGone({
    segment: sessionSegment,
    tools: sessionTools ? stripTools : null,
    readOnly: !!readOnly,
    running: { timer: !!sessionTools?.timer, vote: !!tabVote, poll: !!pollPanel },
  });
  useEffect(() => {
    if (sessionButtonGone) closeDockPanel();
  }, [sessionButtonGone, closeDockPanel]);
  // A running tool's popover stays up until its button closes it, and goes when the activity ends
  // (docs/specs/012-collaboration/session-tools.md "The Session strip"), rather than turning back
  // into the set-up under the facilitator's pointer.
  const sessionRunning =
    sessionSegment === 'session-timer'
      ? !!sessionTools?.timer
      : sessionSegment === 'session-vote'
        ? !!tabVote
        : sessionSegment === 'session-poll'
          ? !!sessionTools?.livePoll
          : false;
  // Per segment: switching from a running tool's popover to an idle one is not an ending.
  const wasRunning = useRef({ segment: sessionSegment, running: sessionRunning });
  useEffect(() => {
    const prev = wasRunning.current;
    wasRunning.current = { segment: sessionSegment, running: sessionRunning };
    if (sessionSegment && prev.segment === sessionSegment && prev.running && !sessionRunning)
      closeDockPanel();
  }, [sessionRunning, sessionSegment, closeDockPanel]);
  const sessionPopoverEl =
    !chromeHidden && sessionSegment && sessionTools && !sessionButtonGone ? (
      <SessionPopover
        segment={sessionSegment}
        anchor={activeDockAnchor ?? undefined}
        onClose={closeDockPanel}
        session={sessionTools}
        readOnly={!!readOnly}
        canVote={!readOnly || !!takePart}
        holdOpen={!isMobile}
        voteSelfId={participantKey(selfParticipant)}
        pollPanel={pollPanel}
        vote={{
          tabVote,
          elements,
          participantCount,
          results: voteResults,
          reviewIndex: voteReview ? voteReview.index : null,
          onJumpToResult: onJumpToVoteResult,
          isHost: isVoteHost,
          review: voteReview,
          onNextResult: onNextVoteResult,
          onPrevResult: onPrevVoteResult,
          onDoneReview: onDoneVoteReview,
        }}
      />
    ) : null;

  // Map of panel id → element for the docked-layout distribution.
  const panelEls: Partial<Record<PanelId, ReactNode>> = {
    // Collaborate renders outside the corner layer (collaborateEl, below).
    collaborate: null,
    ai: aiEl,
    laser: laserEl,
    spotlight: spotlightEl,
    'slide-deck': slideDeckEl,
    format: formatEl,
  };
  return {
    panelEls,
    explorerEl,
    // The cluster popovers, rendered beside the corner layer rather than in it (see panelEls).
    collaborateEl,
    avatarPopoverEl: avatarEl,
    cardTypesPopoverEl: cardTypesOpen ? (
      <CardTypesPanel
        popoverOpen
        popoverAnchor={activeDockAnchor ?? undefined}
        onPopoverClose={closeDockPanel}
      />
    ) : null,
    cardFinderPopoverEl: cardFinderOpen ? (
      <CardFinderPanel
        popoverAnchor={activeDockAnchor ?? undefined}
        onPopoverClose={closeDockPanel}
      />
    ) : null,
    newCardPopoverEl: newCardOpen ? (
      <NewCardPanel popoverAnchor={activeDockAnchor ?? undefined} onPopoverClose={closeDockPanel} />
    ) : null,
    trashPopoverEl: trashOpen ? (
      <TrashPanel popoverAnchor={activeDockAnchor ?? undefined} onPopoverClose={closeDockPanel} />
    ) : null,
    sessionPopoverEl,
  };
}
