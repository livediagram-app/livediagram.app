'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import { participantKey } from '@/lib/identity';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { visibleLayerElements } from '@livediagram/document';
import { CanvasAiPanel } from './CanvasAiPanel';
import { Explorer } from '@/components/panels/Explorer';
import { ViewMinimap } from '@/components/canvas/view-readers';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';
import { sessionStripTools } from './SessionClusterStrip';

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
// wiring per panel, the palette's theme tint, and each panel's element with
// its own visibility gate. CanvasChrome distributes the returned map into
// the corner stacks (docking) or renders the elements inline (zen). The
// Explorer and the cluster popovers render beside the corner layer. The
// tool-config panels, on screen only while
// their own tool is active, live in useCanvasToolPanels.
// The Explorer popover never moves, so its MovablePanel's move handler has nothing to do.
const NO_MOVE = () => {};

export function useCanvasChromePanels({
  props,
  chromeHidden,
  isMobile,
  panelWiringFor,
  panelsOn,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  isMobile: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
  // Which panels are on in Settings (docs/specs/007-editor/user-preferences.md), read by CanvasChrome
  // so each panel and its cluster button agree.
  panelsOn: { layers: boolean; collaborate: boolean };
}): {
  panelEls: Partial<Record<PanelId, ReactNode>>;
  // The Explorer, a popover under the menu button (docs/specs/007-editor/toolbar-layout.md).
  explorerEl: ReactNode;
  // Layers, a popover over its cluster button, rendered outside the corner layer.
  layersEl: ReactNode;
  collaborateEl: ReactNode;
  slidesPopoverEl: ReactNode;
  // The Card Types panel over its cluster button, in Plan mode (docs/specs/026-plan/item-types.md).
  cardTypesPopoverEl: ReactNode;
  trashPopoverEl: ReactNode;
  newCardPopoverEl: ReactNode;
  cardFinderPopoverEl: ReactNode;
  // The Session strip's open popover (Timer, Vote or Poll), over its button.
  sessionPopoverEl: ReactNode;
  paletteTint: ReturnType<typeof usePaletteChrome>['paletteTint'];
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
    layers,
    activeLayerId,
    layerCounts,
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
    onSelectLayer,
    onAddLayer,
    onRemoveLayer,
    onRenameLayer,
    onToggleLayerVisibility,
    onToggleLayerLock,
    onReorderLayer,
    onMergeLayer,
    onSetLayerOpacity,
    onClearLayer,
    onHideOtherLayers,
    onPreviewLayer,
    onCreateFolder,
    onDeleteDocument,
    onDeleteFolder,
    onDismissShared,
    onDuplicateDocument,
    onMoveCommentsPanel,
    onMoveDocumentToFolder,
    onMoveDocumentTo,
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
    selfParticipant,
    setActiveDockAnchor,
    setActiveDockPanel,
    settings,
    sharedDocuments,
    tabName,
    tabThemeId,
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
  // The theme tint for the palette tiles: see usePaletteChrome.
  const { paletteTheme, paletteTint } = usePaletteChrome({ tabThemeId });

  // --- Corner panels as elements (docs/specs/007-editor/panel-docking.md) ---
  // Built once with docking-aware wiring, then rendered either inline (zen)
  // or distributed into corner stacks. Each keeps its own visibility gate.
  const collaborateWiring = panelWiringFor(
    'collaborate',
    commentsPanelPosition,
    onResetCommentsPanel,
  );
  const aiWiring = aiPanel ? panelWiringFor('ai', aiPanel.position, aiPanel.onReset) : null;
  // The six tool-config panels (avatar / laser / spotlight / eraser / format /
  // slide deck), see useCanvasToolPanels. They share one contract: on screen
  // only while their own tool is active.
  // The Slides popover belongs to Illustrate mode's button: leaving the mode (Shift+D, a tab
  // switch) closes it rather than leaving it floating with no button under it.
  const slidesOpen = activeDockPanel === 'slides' && !!props.illustratePages;
  useEffect(() => {
    if (activeDockPanel === 'slides' && !props.illustratePages) closeDockPanel();
  }, [activeDockPanel, props.illustratePages, closeDockPanel]);
  // The Card Types popover, likewise, belongs to Plan mode's button.
  const planMode = props.editorMode === 'plan';
  const cardTypesOpen = activeDockPanel === 'card-types' && planMode;
  const trashOpen = activeDockPanel === 'plan-trash' && planMode;
  const cardFinderOpen = activeDockPanel === 'plan-cards' && planMode;
  const newCardOpen = activeDockPanel === 'plan-new-card' && planMode;
  useEffect(() => {
    if (
      (activeDockPanel === 'card-types' ||
        activeDockPanel === 'plan-trash' ||
        activeDockPanel === 'plan-cards' ||
        activeDockPanel === 'plan-new-card') &&
      !planMode
    )
      closeDockPanel();
  }, [activeDockPanel, planMode, closeDockPanel]);
  const { avatarEl, laserEl, spotlightEl, eraserEl, formatEl, slideDeckEl } = useCanvasToolPanels({
    props,
    chromeHidden,
    panelWiringFor,
    slidesPopover: slidesOpen
      ? { anchor: activeDockAnchor ?? undefined, onClose: closeDockPanel }
      : null,
  });

  const explorerEl =
    zenMode || props.explorerHidden ? null : (
      <Explorer
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
        onDuplicateDocument={explorerHandlers.onDuplicateDocument}
        onCreateFolder={explorerHandlers.onCreateFolder}
        onRenameFolder={explorerHandlers.onRenameFolder}
        onDeleteFolder={explorerHandlers.onDeleteFolder}
        onTeamFolders={onTeamFolders}
        onMoveDocumentToFolder={explorerHandlers.onMoveDocumentToFolder}
        onMoveDocumentTo={onMoveDocumentTo ? explorerHandlers.onMoveDocumentTo : undefined}
        popoverOpen={activeDockPanel === 'explorer'}
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
        onCommentRowClick={(id) => {
          onOpenCommentsForElement(id);
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

  // Layers panel (docs/specs/006-document/layers.md). Edit sessions only (a viewer can't manage
  // layers; visibility / lock still shape what they see via the render
  // path). A popover over its bottom-right cluster button, always mounted so
  // that button can pop it open (popoverOpen gates the actual render).
  // Its Settings switch removes it outright; layers themselves keep applying.
  const layersEl =
    !chromeHidden && !readOnly && panelsOn.layers ? (
      <LayersPanel
        layers={layers}
        tabFont={props.tabFont}
        activeLayerId={activeLayerId}
        counts={layerCounts}
        elements={elements}
        popoverOpen={activeDockPanel === 'layers'}
        popoverAnchor={activeDockAnchor ?? undefined}
        onPopoverClose={closeDockPanel}
        onSelectLayer={onSelectLayer}
        onAddLayer={onAddLayer}
        onRemoveLayer={onRemoveLayer}
        onRenameLayer={onRenameLayer}
        onToggleVisibility={onToggleLayerVisibility}
        onToggleLock={onToggleLayerLock}
        onReorderLayer={onReorderLayer}
        onMergeLayer={onMergeLayer}
        onSetLayerOpacity={onSetLayerOpacity}
        onClearLayer={onClearLayer}
        onHideOtherLayers={onHideOtherLayers}
        onPreviewLayer={onPreviewLayer}
        hoverPreviewEnabled={settings?.layerHoverPreview !== false}
        showPreview={settings?.layersShowPreview !== false}
        showCount={settings?.layersShowCount !== false}
      />
    ) : null;

  // Minimap (docs/specs/008-canvas/minimap.md) routed through docking like the other panels: it
  // docks in the bottom-left and snaps / persists the same way. Desktop-only, gated on the map
  // setting + a few elements; hidden in zen / welcome (chromeHidden).
  const mapEnabled = settings?.showMinimap !== false;
  const mapAccent = paletteTheme.elementStroke;
  const minimapWiring = panelWiringFor('minimap', props.mapPosition, props.onResetMap);
  // Hidden layers (docs/specs/006-document/layers.md) drop out of the miniature too, so the map
  // matches the canvas. Memoised: with a hidden layer the filter returns a new array, which would
  // rebuild the Map's whole drawing on every render (docs/specs/008-canvas/canvas-performance.md).
  const mapElements = useMemo(
    () => visibleLayerElements(elements, props.tabLayers),
    [elements, props.tabLayers],
  );
  const minimapEl =
    !chromeHidden &&
    !isMobile &&
    mapEnabled &&
    (elements.length >= 4 || (props.illustratePages?.pages.length ?? 0) > 0) ? (
      <ViewMinimap
        elements={mapElements}
        pages={props.illustratePages?.pages}
        writing={props.illustratePages?.articles?.flows}
        tabFont={props.tabFont}
        setViewportOffset={props.setViewportOffset}
        setViewportZoom={props.setViewportZoom}
        mainSize={props.mainSize}
        paperColor={props.tabBackgroundColor}
        accentColor={mapAccent}
        position={minimapWiring.position}
        onMove={props.onMoveMap}
        onResetPosition={minimapWiring.onReset}
        dock={minimapWiring.dock}
        dimOutside={settings?.mapDimOutside !== false}
        size={settings?.mapSize ?? 'medium'}
      />
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
  const stripTools = sessionStripTools(props.editorMode);
  const sessionTools = stripTools ? props.sessionTools : undefined;
  const sessionButtonGone =
    sessionSegment !== null &&
    (!sessionTools ||
      (sessionSegment === 'session-poll' && !stripTools?.poll) ||
      (!!readOnly &&
        ((sessionSegment === 'session-timer' && !sessionTools.timer) ||
          (sessionSegment === 'session-vote' && !tabVote) ||
          (sessionSegment === 'session-poll' && !pollPanel))));
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
    minimap: minimapEl,
    avatar: avatarEl,
    laser: laserEl,
    spotlight: spotlightEl,
    eraser: eraserEl,
    // Over its cluster button (Illustrate mode) it renders beside the corner layer, like Collaborate.
    'slide-deck': slidesOpen ? null : slideDeckEl,
    format: formatEl,
  };
  return {
    panelEls,
    explorerEl,
    // The cluster popovers, rendered beside the corner layer rather than in it (see panelEls).
    collaborateEl,
    slidesPopoverEl: slidesOpen ? slideDeckEl : null,
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
    layersEl,
    sessionPopoverEl,
    paletteTint,
  };
}
