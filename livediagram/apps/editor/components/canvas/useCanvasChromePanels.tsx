'use client';

import { isTypingTarget } from '@/lib/typing-target';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import { participantKey } from '@/lib/identity';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { loadLayersPanel } from '@/lib/editor-deferred-code';
import { visibleLayerElements } from '@livediagram/document';
import { LazyExplorer } from '@/components/panels/LazyExplorer';
import { ViewMinimap } from '@/components/canvas/view-readers';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';
import { stripSegmentGone, type SessionStripTools } from './SessionClusterStrip';
import { tidyUpOffered } from './tidy-up-actions';
import { useWithheldExplorerCloses } from './useWithheldExplorerCloses';

// Layers is a popover most visits never open: mounted from its first opening on (its code fetched once the
// editor is idle, lib/editor-deferred-code.ts), and kept mounted after.
const LayersPanel = dynamic(loadLayersPanel, { ssr: false });

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

// Lazy for the same reason: the Tidy Up popover (docs/specs/008-canvas/layout-cleanup.md "The Tidy Up button")
// loads on the first press of its button.
const TidyUpPopover = dynamic(() => import('./TidyUpPopover').then((m) => m.TidyUpPopover), {
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

export function useCanvasChromePanels({
  props,
  stripTools,
  chromeHidden,
  isMobile,
  panelWiringFor,
  panelsOn,
}: {
  props: CanvasChromeProps;
  // The tools the mode's Session strip offers (sessionStripTools), as CanvasChrome drew them.
  stripTools: SessionStripTools | null;
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
  // The Session strip's open popover (Timer, Vote or Poll), over its button.
  sessionPopoverEl: ReactNode;
  // The Tidy Up popover over its button, in Diagram mode.
  tidyUpPopoverEl: ReactNode;
  // The Avatar panel over its button (docs/specs/008-canvas/avatar-mode.md "The Avatar Panel").
  avatarPopoverEl: ReactNode;
  paletteTint: ReturnType<typeof usePaletteChrome>['paletteTint'];
} {
  const {
    activeDockAnchor,
    activeDockPanel,
    actionRows,
    commentRows,
    commentsPanelPosition,
    currentDocumentId,
    currentShareCode,
    onRenameCurrentDocument,
    elements,
    layers,
    activeLayerId,
    layerCounts,
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
    onMoveCommentsPanel,
    onNewDocument,
    explorerMenuActions,
    onOpenActionForElement,
    onToggleActionDone,
    onOpenCommentsForElement,
    onResetCommentsPanel,
    readOnly,
    takePart,
    selfParticipant,
    setActiveDockAnchor,
    setActiveDockPanel,
    settings,
    tabThemeId,
    zenMode,
  } = props;
  // Stable handler identities for the React.memo'd Explorer so it skips re-rendering on every drag frame even
  // though this chrome host re-renders with the canvas. useStableCallbacks
  // keeps each reference fixed while always invoking the latest prop, so
  // there's no stale-closure risk despite the parent's per-frame churn.
  const explorerHandlers = useStableCallbacks({
    onNewDocument,
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
  // The six tool-config panels (avatar / laser / spotlight / eraser / format /
  // slide deck), see useCanvasToolPanels. They share one contract: on screen
  // only while their own tool is active.
  // The Tidy Up popover belongs to its button: leaving Diagram mode, Zen or a locked-out session closes it.
  const tidyUp = props.tidyUp;
  const tidyUpShown = tidyUpOffered({
    actions: tidyUp,
    editorMode: props.editorMode,
    zenMode: !!zenMode,
  });
  const tidyUpOpen = activeDockPanel === 'tidy-up' && tidyUpShown && !chromeHidden;
  useEffect(() => {
    if (activeDockPanel === 'tidy-up' && !tidyUpShown) closeDockPanel();
  }, [activeDockPanel, tidyUpShown, closeDockPanel]);
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
  const { avatarEl, laserEl, spotlightEl, eraserEl, formatEl, slideDeckEl } = useCanvasToolPanels({
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
        currentDocumentId={currentDocumentId}
        currentShareCode={currentShareCode ?? null}
        onRenameCurrent={onRenameCurrentDocument}
        onNewDocument={explorerHandlers.onNewDocument}
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

  // Layers panel (docs/specs/006-document/layers.md). Edit sessions only (a viewer can't manage
  // layers; visibility / lock still shape what they see via the render
  // path). A popover over its bottom-right cluster button, always mounted so
  // that button can pop it open (popoverOpen gates the actual render).
  // Its Settings switch removes it outright; layers themselves keep applying.
  const layersOpen = activeDockPanel === 'layers';
  const [layersOpened, setLayersOpened] = useState(layersOpen);
  if (layersOpen && !layersOpened) setLayersOpened(true);
  const layersEl =
    !chromeHidden && !readOnly && panelsOn.layers && layersOpened ? (
      <LayersPanel
        layers={layers}
        tabFont={props.tabFont}
        activeLayerId={activeLayerId}
        counts={layerCounts}
        elements={elements}
        popoverOpen={layersOpen}
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
    !chromeHidden && !isMobile && mapEnabled && elements.length >= 4 ? (
      <ViewMinimap
        elements={mapElements}
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
    minimap: minimapEl,
    laser: laserEl,
    spotlight: spotlightEl,
    eraser: eraserEl,
    'slide-deck': slideDeckEl,
    format: formatEl,
  };
  return {
    panelEls,
    explorerEl,
    // The cluster popovers, rendered beside the corner layer rather than in it (see panelEls).
    collaborateEl,
    avatarPopoverEl: avatarEl,
    tidyUpPopoverEl:
      tidyUpOpen && tidyUp ? (
        <TidyUpPopover
          actions={tidyUp}
          empty={elements.length === 0}
          anchor={activeDockAnchor ?? undefined}
          onClose={closeDockPanel}
        />
      ) : null,
    layersEl,
    sessionPopoverEl,
    paletteTint,
  };
}
