'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { visibleLayerElements } from '@livediagram/document';
import { CanvasAiPanel } from './CanvasAiPanel';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { pickPaletteAddHandlers } from '@/components/palette/palette-add-handlers';
import { Explorer } from '@/components/panels/Explorer';
import { Minimap } from '@/components/canvas/Minimap';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';
import { useCanvasToolPanels } from './useCanvasToolPanels';
import { WhiteboardDock } from './whiteboard/WhiteboardDock';

// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments. It stacks below the Palette (the
// top-right panel). Most documents never accumulate comments, so deferring
// the 164-line panel + its relative-time formatting
// dependencies keeps the editor's initial chunk lean.
const CollaboratePanel = dynamic(
  () => import('@/components/panels/CollaboratePanel').then((m) => m.CollaboratePanel),
  { ssr: false },
);

// Lazy for the same reason, and more so: the poll panel (docs/specs/012-collaboration/live-poll.md) only
// mounts while a poll is actually running, which is rare and brief.
const PollPanel = dynamic(() => import('@/components/panels/PollPanel').then((m) => m.PollPanel), {
  ssr: false,
});

// Same again for the vote panel (docs/specs/012-collaboration/session-tools.md): only on screen while a
// dot-vote is running.
const VotePanel = dynamic(() => import('@/components/panels/VotePanel').then((m) => m.VotePanel), {
  ssr: false,
});

// Lazy for the same reason: the Actions panel (docs/specs/012-collaboration/assigned-actions.md) only mounts when
// the active tab has at least one element with an OPEN assigned action.

// The floating panels as elements (docs/specs/007-editor/panel-docking.md), lifted out of CanvasChrome:
// the stable handler bundles for the memo'd panels, the docking-aware
// wiring per panel, the palette's theme tint, and each panel's element with
// its own visibility gate. CanvasChrome distributes the returned map into
// the corner stacks (docking) or renders the elements inline (zen). The
// tool-config panels, on screen only while
// their own tool is active, live in useCanvasToolPanels.
export function useCanvasChromePanels({
  props,
  chromeHidden,
  isMobile,
  dockingActive,
  toolbarActive,
  panelWiringFor,
  panelsOn,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  isMobile: boolean;
  dockingActive: boolean;
  // Toolbar layout (docs/specs/007-editor/toolbar-layout.md): the strip stands in for the
  // Palette, and the Explorer opens as a popover under the menu button
  // instead of floating in its corner.
  toolbarActive: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
  // Which panels are on in Settings (docs/specs/007-editor/user-preferences.md), read by CanvasChrome
  // so each panel and its cluster button agree.
  panelsOn: { layers: boolean; collaborate: boolean };
}): {
  panelEls: Partial<Record<PanelId, ReactNode>>;
  // The Explorer, when it belongs to the Toolbar layout's menu button rather
  // than to a corner (then panelEls.explorer is null).
  toolbarExplorerEl: ReactNode;
  // Layers in the Toolbar layout: a popover over its cluster button,
  // rendered outside the corner layer (then its panelEl is null).
  toolbarClusterEls: ReactNode;
  collaborateEl: ReactNode;
  // True when Layers opens as a popover over its cluster button
  // (Toolbar, and zen).
  clusterPopovers: boolean;
  paletteTint: ReturnType<typeof usePaletteChrome>['paletteTint'];
} {
  const {
    activeDockAnchor,
    activeDockPanel,
    aiPanel,
    canvasTool,
    actionRows,
    commentRows,
    commentsPanelPosition,
    currentDocumentId,
    documentList,
    documentListLoading,
    elements,
    explorerPosition,
    folders,
    layers,
    activeLayerId,
    layerCounts,
    layersPanelPosition,
    layersMinimized,
    onMoveLayersPanel,
    onResetLayersPanel,
    userPreferences,
    onToggleRecentExclusion,
    favouriteIds,
    onToggleFavourite,
    pollPanel,
    pollPanelPosition,
    onMovePollPanel,
    onResetPollPanel,
    tabVote,
    votePanelPosition,
    onMoveVotePanel,
    onResetVotePanel,
    voteResults,
    onJumpToVoteResult,
    isVoteHost,
    participantCount,
    voteReview,
    onEndVote,
    onRevealVote,
    onClearVote,
    onToggleLayersMinimized,
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
    esBoard,
    esBoardControls,
    onChangeSettings,
    onCreateFolder,
    onDeleteDocument,
    onDeleteFolder,
    onDismissShared,
    onDuplicateDocument,
    onMoveCommentsPanel,
    onMoveDocumentToFolder,
    onMoveDocumentTo,
    onMoveExplorer,
    onMovePalette,
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
    onResetExplorer,
    onResetPalette,
    onSetCanvasTool,
    onExitAvatarMode,
    paletteBottomY,
    palettePosition,
    pendingDraw,
    readOnly,
    selfParticipant,
    setActiveDockAnchor,
    setActiveDockPanel,
    setPaletteBottomY,
    settings,
    sharedDocuments,
    tabName,
    tabThemeId,
    teamDocuments,
    teamFolders,
    teams,
    viewportZoom,
    zenMode,
    onToggleZen,
  } = props;
  // Stable handler identities for the React.memo'd Explorer so it skips re-rendering on every drag frame even
  // though this chrome host re-renders with the canvas. useStableCallbacks
  // keeps each reference fixed while always invoking the latest prop, so
  // there's no stale-closure risk despite the parent's per-frame churn.
  // (The panels' data props are already stable: list state doesn't change
  // mid-drag, and EditorView memoises the `teams` array.)
  const explorerHandlers = useStableCallbacks({
    onDismissShared,
    onMoveExplorer,
    onResetExplorer,
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

  // --- Floating panels as elements (docs/specs/007-editor/panel-docking.md) ---
  // Built once with docking-aware wiring, then rendered either inline (zen)
  // or distributed into corner stacks. Each keeps its own visibility gate.
  const explorerWiring = panelWiringFor(
    'explorer',
    explorerPosition,
    explorerHandlers.onResetExplorer,
  );
  const paletteWiring = panelWiringFor('palette', palettePosition, onResetPalette);
  const collaborateWiring = panelWiringFor(
    'collaborate',
    commentsPanelPosition,
    onResetCommentsPanel,
  );
  const aiWiring = aiPanel ? panelWiringFor('ai', aiPanel.position, aiPanel.onReset) : null;
  const layersWiring = panelWiringFor('layers', layersPanelPosition, onResetLayersPanel);
  const pollWiring = panelWiringFor('poll', pollPanelPosition, onResetPollPanel);
  const voteWiring = panelWiringFor('vote', votePanelPosition, onResetVotePanel);
  // In docking mode the corner flex columns own stacking, so the legacy
  // measured stack-below-the-palette offset is dropped.
  const stackBelowY = dockingActive
    ? undefined
    : palettePosition !== null || paletteBottomY === 0
      ? undefined
      : paletteBottomY;

  // The six tool-config panels (avatar / laser / spotlight / eraser / format /
  // slide deck), see useCanvasToolPanels. They share one contract: on screen
  // only while their own tool is active.
  const { avatarEl, laserEl, spotlightEl, eraserEl, formatEl, slideDeckEl } = useCanvasToolPanels({
    props,
    chromeHidden,
    stackBelowY,
    panelWiringFor,
  });

  const explorerEl = zenMode ? null : (
    <Explorer
      recentExcludedIds={userPreferences.recentExcludedIds ?? []}
      onToggleRecentExclusion={onToggleRecentExclusion}
      favouriteIds={favouriteIds}
      onToggleFavourite={onToggleFavourite}
      position={explorerWiring.position}
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
      onMoveTo={explorerHandlers.onMoveExplorer}
      onReset={explorerWiring.onReset}
      dock={explorerWiring.dock}
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
      // Toolbar layout: a popover under the menu button, the dock's path.
      asPopover={toolbarActive}
      dismissOnOutside={toolbarActive}
      onPopoverClose={closeDockPanel}
    />
  );

  // Layers opens as a popover over its bottom-right cluster button in
  // Toolbar (docs/specs/007-editor/toolbar-layout.md); the Floating layout docks it as a corner panel
  // that minimises into that button.
  const clusterPopovers = !dockingActive || toolbarActive;

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
      <CanvasAiPanel
        aiPanel={aiPanel}
        wiring={aiWiring}
        stackBelowY={stackBelowY}
        tabName={tabName}
        settings={settings}
      />
    ) : null;

  // Layers panel (docs/specs/006-document/layers.md). Edit sessions only (a viewer can't manage
  // layers; visibility / lock still shape what they see via the render
  // path). Floating: hidden while minimised into its bottom-right cluster
  // button. As a popover (clusterPopovers): always mounted so that button can
  // pop it open (popoverOpen gates the actual render).
  // Its Settings switch removes it outright; layers themselves keep applying.
  const layersEl =
    !chromeHidden && !readOnly && panelsOn.layers && (clusterPopovers ? true : !layersMinimized) ? (
      <LayersPanel
        layers={layers}
        tabFont={props.tabFont}
        activeLayerId={activeLayerId}
        counts={layerCounts}
        elements={elements}
        position={layersWiring.position}
        onMoveTo={onMoveLayersPanel}
        onReset={layersWiring.onReset}
        dock={clusterPopovers ? undefined : layersWiring.dock}
        onMinimize={onToggleLayersMinimized}
        popoverOpen={activeDockPanel === 'layers'}
        popoverAnchor={activeDockAnchor ?? undefined}
        asPopover={clusterPopovers}
        dismissOnOutside={clusterPopovers}
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

  // Draw mode keeps the Palette panel and fills it with Draw's tools instead of the catalogue
  // (docs/specs/023-draw-mode/draw-mode.md "What a whiteboard shows").
  const drawTools =
    props.editorMode === 'draw' && props.whiteboardDock ? (
      <WhiteboardDock
        variant="panel"
        model={props.whiteboardDock}
        ink={props.whiteboardInk ?? '#1c1917'}
      />
    ) : undefined;
  const paletteEl =
    chromeHidden || readOnly || toolbarActive ? null : (
      <CommandPalette
        drawTools={drawTools}
        position={paletteWiring.position}
        canvasTool={canvasTool}
        onSetCanvasTool={onSetCanvasTool}
        onExitAvatarMode={onExitAvatarMode}
        onToggleZen={onToggleZen}
        onMoveTo={onMovePalette}
        onReset={paletteWiring.onReset}
        dock={paletteWiring.dock}
        settings={settings}
        onChangeSettings={onChangeSettings}
        canvasEmpty={elements.length === 0}
        {...pickPaletteAddHandlers(props)}
        esBoard={esBoard}
        esBoardControls={esBoardControls}
        pendingDraw={pendingDraw}
        themeTint={paletteTint}
        onSize={(size) => setPaletteBottomY(size.bottomY)}
      />
    );

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
      <Minimap
        elements={mapElements}
        tabFont={props.tabFont}
        viewportOffset={props.viewportOffset}
        viewportZoom={viewportZoom}
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

  // Live poll (docs/specs/012-collaboration/live-poll.md). Unlike its neighbours this panel is absent most
  // of the time: it exists only while a poll is running and the viewer is
  // entitled to the results, so it joins and leaves its corner stack.
  const pollEl =
    !chromeHidden && pollPanel ? (
      <PollPanel
        poll={pollPanel.poll}
        answers={pollPanel.answers}
        isHost={pollPanel.isHost}
        onEnd={pollPanel.onEnd}
        onKeepResults={pollPanel.onKeepResults}
        onDismiss={pollPanel.onDismiss}
        position={pollWiring.position}
        stackBelowY={stackBelowY}
        onMoveTo={onMovePollPanel}
        onReset={pollWiring.onReset}
        dock={pollWiring.dock}
      />
    ) : null;

  // Live vote (docs/specs/012-collaboration/session-tools.md). Present only while a vote is on the tab: turnout
  // while casting is open, then the clickable ranked results.
  const voteEl =
    !chromeHidden && tabVote ? (
      <VotePanel
        vote={tabVote}
        elements={elements}
        participantCount={participantCount}
        results={voteResults}
        reviewIndex={voteReview ? voteReview.index : null}
        onJumpToResult={onJumpToVoteResult}
        onEndVote={onEndVote}
        onRevealVote={onRevealVote}
        onClearVote={onClearVote}
        isHost={isVoteHost}
        position={voteWiring.position}
        stackBelowY={stackBelowY}
        onMoveTo={onMoveVotePanel}
        onReset={voteWiring.onReset}
        dock={voteWiring.dock}
        readOnly={!!readOnly}
      />
    ) : null;

  // Map of panel id → element for the docked-layout distribution.
  const panelEls: Partial<Record<PanelId, ReactNode>> = {
    explorer: toolbarActive ? null : explorerEl,
    palette: paletteEl,
    // Collaborate renders outside the corner layer (collaborateEl, below).
    collaborate: null,
    ai: aiEl,
    minimap: minimapEl,
    layers: toolbarActive ? null : layersEl,
    poll: pollEl,
    vote: voteEl,
    avatar: avatarEl,
    laser: laserEl,
    spotlight: spotlightEl,
    eraser: eraserEl,
    'slide-deck': slideDeckEl,
    format: formatEl,
  };
  return {
    panelEls,
    toolbarExplorerEl: toolbarActive ? explorerEl : null,
    // Toolbar's cluster popovers, rendered beside the corner layer rather than
    // in it (see panelEls).
    collaborateEl,
    toolbarClusterEls: toolbarActive ? layersEl : null,
    clusterPopovers,
    paletteTint,
  };
}
