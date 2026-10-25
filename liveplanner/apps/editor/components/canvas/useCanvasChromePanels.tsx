'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStableCallbacks } from '@liveworkspace/workbench/hooks/ui/useStableCallbacks';
import { participantKey } from '@/lib/identity';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { LazyExplorer } from '@/components/panels/LazyExplorer';
import type { CanvasChromeProps } from './CanvasChrome';
import { stripSegmentGone, type SessionStripTools } from './SessionClusterStrip';
import { useWithheldExplorerCloses } from '@liveworkspace/workbench/components/canvas/useWithheldExplorerCloses';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), so a project without
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
// top-right panel). Most projects never accumulate comments, so deferring
// the 164-line panel + its relative-time formatting
// dependencies keeps the editor's initial chunk lean.
const CollaboratePanel = dynamic(
  () => import('@/components/panels/CollaboratePanel').then((m) => m.CollaboratePanel),
  { ssr: false },
);

// Lazy for the same reason: the Session strip's popovers (docs/specs/012-collaboration/session-tools.md
// "The Session strip") load on the first press of a Timer or Vote button.
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
// Explorer and the cluster popovers render beside the corner layer.

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
  // The Session strip's open popover (Timer or Vote), over its button.
  sessionPopoverEl: ReactNode;
} {
  const {
    activeDockAnchor,
    activeDockPanel,
    actionRows,
    commentRows,
    commentsPanelPosition,
    currentProjectId,
    currentShareCode,
    onRenameCurrentProject,
    elements,
    tabVote,
    voteResults,
    onJumpToVoteResult,
    isVoteHost,
    participantCount,
    voteReview,
    onNextVoteResult,
    onPrevVoteResult,
    onDoneVoteReview,
    onMoveCommentsPanel,
    onNewProject,
    explorerMenuActions,
    onOpenActionForElement,
    onToggleActionDone,
    activeTabId,
    onOpenCommentsForElement,
    onResetCommentsPanel,
    readOnly,
    takePart,
    selfParticipant,
    setActiveDockAnchor,
    setActiveDockPanel,
    zenMode,
  } = props;
  // The Inbox's Mark Done for an action on this tab (lib/explorer-inbox-host): the canvas's own verb, through a
  // stable wrapper so the panel's props stay the same while the editor re-renders.
  const { markDone } = useStableCallbacks({
    markDone: (elementId: string, actionId: string) =>
      onToggleActionDone?.(elementId, true, actionId),
  });
  const canMarkDone = Boolean(onToggleActionDone);
  const inboxOpenAction = useMemo(
    () => (canMarkDone && activeTabId ? { tabId: activeTabId, markDone } : null),
    [canMarkDone, activeTabId, markDone],
  );
  // Stable handler identities for the React.memo'd Explorer so it skips re-rendering on every drag frame even
  // though this chrome host re-renders with the canvas. useStableCallbacks
  // keeps each reference fixed while always invoking the latest prop, so
  // there's no stale-closure risk despite the parent's per-frame churn.
  const explorerHandlers = useStableCallbacks({
    onNewProject,
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
  // The Card Types popover, and the Plan strip's others, over their buttons.
  const cardTypesOpen = activeDockPanel === 'card-types';
  const trashOpen = activeDockPanel === 'plan-trash';
  const cardFinderOpen = activeDockPanel === 'plan-cards';
  const newCardOpen = activeDockPanel === 'plan-new-card';

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
        currentProjectId={currentProjectId}
        inboxOpenAction={inboxOpenAction}
        currentShareCode={currentShareCode ?? null}
        onRenameCurrent={onRenameCurrentProject}
        onNewProject={explorerHandlers.onNewProject}
        menuActions={explorerMenu}
        popoverOpen={explorerOpen}
        popoverAnchor={activeDockAnchor ?? undefined}
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

  // The Session strip's popovers (docs/specs/012-collaboration/session-tools.md "The Session strip"). A
  // segment whose button has gone (a view-role visitor's tool ended) closes its
  // popover rather than leaving it floating with no button under it.
  const sessionSegment =
    activeDockPanel === 'session-timer' || activeDockPanel === 'session-vote'
      ? activeDockPanel
      : null;
  // Only the tools the mode's strip offers (docs/specs/012-collaboration/session-tools.md).
  const sessionTools = stripTools ? props.sessionTools : undefined;
  const sessionButtonGone = stripSegmentGone({
    segment: sessionSegment,
    tools: sessionTools ? stripTools : null,
    readOnly: !!readOnly,
    running: { timer: !!sessionTools?.timer, vote: !!tabVote },
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
  };
  return {
    panelEls,
    explorerEl,
    // The cluster popovers, rendered beside the corner layer rather than in it (see panelEls).
    collaborateEl,
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
