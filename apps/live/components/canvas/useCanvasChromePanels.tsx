'use client';

import dynamic from 'next/dynamic';
import { useCallback, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { ActivityPanel } from '@/components/panels/ActivityPanel';
import { LayersPanel } from '@/components/panels/LayersPanel';
import { AvatarPanel } from '@/components/panels/AvatarPanel';
import { visibleLayerElements } from '@livediagram/diagram';
import { CanvasAiPanel } from './CanvasAiPanel';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { Explorer } from '@/components/panels/Explorer';
import { Minimap } from '@/components/canvas/Minimap';
import type { CanvasChromeProps } from './CanvasChrome';
import { usePaletteChrome } from './usePaletteChrome';

// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments. It stacks below the Palette (the
// top-right panel). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
const CollaboratePanel = dynamic(() =>
  import('@/components/panels/CollaboratePanel').then((m) => m.CollaboratePanel),
);

// Lazy for the same reason, and more so: the poll panel (spec/88) only
// mounts while a poll is actually running, which is rare and brief.
const PollPanel = dynamic(() => import('@/components/panels/PollPanel').then((m) => m.PollPanel));

// Same again for the vote panel (spec/39): only on screen while a
// dot-vote is running.
const VotePanel = dynamic(() => import('@/components/panels/VotePanel').then((m) => m.VotePanel));

// Lazy for the same reason: the Actions panel (spec/68) only mounts when
// the active tab has at least one element with an OPEN assigned action.

// The six floating panels as elements (spec/63), lifted out of
// CanvasChrome: the stable handler bundles for the memo'd panels, the
// docking-aware wiring per panel, the palette's theme tint + dock-mode
// reopen-after-draw behaviour, and each panel's element with its own
// visibility gate. CanvasChrome distributes the returned map into the
// corner stacks (docking) or renders the elements inline (mobile /
// minimal / zen).
export function useCanvasChromePanels({
  props,
  chromeHidden,
  isMobile,
  dockingActive,
  panelWiringFor,
}: {
  props: CanvasChromeProps;
  chromeHidden: boolean;
  isMobile: boolean;
  dockingActive: boolean;
  panelWiringFor: ReturnType<typeof useCornerDocking>['panelWiringFor'];
}): { panelEls: Partial<Record<PanelId, ReactNode>> } {
  const {
    activeDockAnchor,
    activeMobilePanel,
    activityMinimized,
    activityPosition,
    aiPanel,
    canRedo,
    canUndo,
    canvasTool,
    changeLog,
    changeLogLoading,
    actionRows,
    commentRows,
    commentsPanelPosition,
    currentDiagramId,
    diagramList,
    diagramListLoading,
    elements,
    explorerBottomY,
    explorerPosition,
    folders,
    handleDockButtonClick,
    minimalPanels,
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
    onActivityRowClick,
    onAddAnnotation,
    onAddArrow,
    onAddAvatar,
    onAddBanner,
    onAddCallout,
    onAddHeader,
    onAddHero,
    onAddIcon,
    onAddImage,
    onAddLinkCard,
    onAddProcess,
    onAddShape,
    onAddStatRow,
    onAddSticky,
    onAddTable,
    onAddTechIcon,
    onAddText,
    onBeginFreehand,
    onBeginHighlighter,
    onBeginPolygon,
    onChangeSettings,
    onClearActivity,
    onClearRevertPreview,
    onCreateFolder,
    onDeleteDiagram,
    onDeleteFolder,
    onDismissShared,
    onDuplicateDiagram,
    onMoveActivity,
    onMoveCommentsPanel,
    onMoveDiagramToFolder,
    onMoveDiagramTo,
    onMoveExplorer,
    onMovePalette,
    onNewDiagram,
    onOpenActionForElement,
    onOpenCommentsForElement,
    onOpenDiagram,
    onOpenShareCurrent,
    onRedo,
    onRenameCurrent,
    onRenameFolder,
    onResetActivity,
    onResetCommentsPanel,
    onResetExplorer,
    onResetPalette,
    onRevertChange,
    onPreviewRevert,
    onSetCanvasTool,
    onExitAvatarMode,
    avatarConfig,
    onChangeAvatarField,
    onRandomiseAvatar,
    onAvatarReaction,
    avatarPanelPosition,
    onMoveAvatarPanel,
    onResetAvatarPanel,
    onToggleActivityMinimized,
    onToggleMinimalPanels,
    onUndo,
    paletteBottomY,
    palettePosition,
    pendingDraw,
    readOnly,
    savedAt,
    saveStatus,
    selfParticipant,
    setActiveDockAnchor,
    setActiveMobilePanel,
    setExplorerBottomY,
    setPaletteBottomY,
    settings,
    sharedDiagrams,
    tabLocked,
    tabName,
    tabThemeId,
    teamDiagrams,
    teamFolders,
    teams,
    viewportZoom,
    zenMode,
    onToggleZen,
  } = props;
  // Stable handler identities for the two React.memo'd panels (Explorer,
  // ActivityPanel) so they skip re-rendering on every drag frame even
  // though this chrome host re-renders with the canvas. useStableCallbacks
  // keeps each reference fixed while always invoking the latest prop, so
  // there's no stale-closure risk despite the parent's per-frame churn.
  // (The panels' data props are already stable: list state doesn't change
  // mid-drag, and EditorView memoises the `teams` / change-log arrays.)
  const explorerHandlers = useStableCallbacks({
    onDismissShared,
    onMoveExplorer,
    onResetExplorer,
    onOpenDiagram,
    onNewDiagram,
    onRenameCurrent,
    onOpenShareCurrent,
    onDeleteDiagram,
    onDuplicateDiagram,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveDiagramToFolder,
    onMoveDiagramTo,
  });
  const activityHandlers = useStableCallbacks({
    onUndo,
    onRedo,
    onRevertChange,
    onPreviewRevert,
    onClearRevertPreview,
    onActivityRowClick,
    onClearActivity,
    onMoveActivity,
    onResetActivity,
    onToggleActivityMinimized,
    onSetRevertHoverPreview: (v: boolean) => {
      // Settings flip fires BEFORE the persist (spec/22).
      track('UI', 'Toggled', v ? 'ActivityRevertPreviewOn' : 'ActivityRevertPreviewOff');
      onChangeSettings({ ...settings, activityRevertHoverPreview: v });
    },
  });
  const onExplorerSize = useCallback(
    (size: { width: number; height: number; bottomY: number }) => setExplorerBottomY(size.bottomY),
    [setExplorerBottomY],
  );
  const closeMobilePanel = useCallback(() => {
    setActiveMobilePanel(null);
    setActiveDockAnchor(null);
  }, [setActiveMobilePanel, setActiveDockAnchor]);
  // Palette chrome behaviours (dock-mode reopen-after-draw + the theme
  // tint for the tiles) — see usePaletteChrome.
  const { paletteTheme, paletteTint, onPaletteDrawArmed } = usePaletteChrome({
    tabThemeId,
    pendingDraw,
    minimalPanels,
    activeMobilePanel,
    handleDockButtonClick,
  });

  // --- Floating panels as elements (spec/63) ---
  // Built once with docking-aware wiring, then rendered either inline
  // (legacy: mobile / minimal / zen) or distributed into corner stacks
  // (desktop docking). Each keeps its own visibility gate.
  const explorerWiring = panelWiringFor(
    'explorer',
    explorerPosition,
    explorerHandlers.onResetExplorer,
  );
  const paletteWiring = panelWiringFor('palette', palettePosition, onResetPalette);
  const activityWiring = panelWiringFor(
    'activity',
    activityPosition,
    activityHandlers.onResetActivity,
  );
  const collaborateWiring = panelWiringFor(
    'collaborate',
    commentsPanelPosition,
    onResetCommentsPanel,
  );
  const aiWiring = aiPanel ? panelWiringFor('ai', aiPanel.position, aiPanel.onReset) : null;
  const layersWiring = panelWiringFor('layers', layersPanelPosition, onResetLayersPanel);
  const pollWiring = panelWiringFor('poll', pollPanelPosition, onResetPollPanel);
  const voteWiring = panelWiringFor('vote', votePanelPosition, onResetVotePanel);
  const avatarWiring = panelWiringFor('avatar', avatarPanelPosition ?? null, () =>
    onResetAvatarPanel?.(),
  );
  // In docking mode the corner flex columns own stacking, so the legacy
  // measured stack-below-the-palette offset is dropped.
  const legacyStackBelowY =
    palettePosition !== null || paletteBottomY === 0 ? undefined : paletteBottomY;

  const explorerEl = zenMode ? null : (
    <Explorer
      recentExcludedIds={userPreferences.recentExcludedIds ?? []}
      onToggleRecentExclusion={onToggleRecentExclusion}
      favouriteIds={favouriteIds}
      onToggleFavourite={onToggleFavourite}
      position={explorerWiring.position}
      diagrams={diagramList}
      ownerId={selfParticipant?.id ?? null}
      folders={folders}
      loading={diagramListLoading}
      shared={sharedDiagrams}
      teams={teams}
      teamFolders={teamFolders}
      teamDiagrams={teamDiagrams}
      onDismissShared={explorerHandlers.onDismissShared}
      currentDiagramId={currentDiagramId}
      onMoveTo={explorerHandlers.onMoveExplorer}
      onReset={explorerWiring.onReset}
      dock={explorerWiring.dock}
      onOpenDiagram={explorerHandlers.onOpenDiagram}
      onNewDiagram={explorerHandlers.onNewDiagram}
      onRenameCurrent={explorerHandlers.onRenameCurrent}
      // The stable wrapper is always a function, so gate on the real prop
      // to preserve "absent = navigation fallback" downstream.
      onOpenShareCurrent={onOpenShareCurrent ? explorerHandlers.onOpenShareCurrent : undefined}
      onDeleteDiagram={explorerHandlers.onDeleteDiagram}
      onDuplicateDiagram={explorerHandlers.onDuplicateDiagram}
      onCreateFolder={explorerHandlers.onCreateFolder}
      onRenameFolder={explorerHandlers.onRenameFolder}
      onDeleteFolder={explorerHandlers.onDeleteFolder}
      onMoveDiagramToFolder={explorerHandlers.onMoveDiagramToFolder}
      onMoveDiagramTo={onMoveDiagramTo ? explorerHandlers.onMoveDiagramTo : undefined}
      onSize={onExplorerSize}
      mobileOpenOverride={activeMobilePanel === 'explorer'}
      mobileDockAnchor={activeDockAnchor ?? undefined}
      forceDockMode={!!minimalPanels}
      onMobileClose={closeMobilePanel}
    />
  );

  const collaborateEl =
    !chromeHidden && (commentRows.length > 0 || actionRows.length > 0) ? (
      <CollaboratePanel
        position={collaborateWiring.position}
        commentRows={commentRows}
        actionRows={actionRows}
        stackBelowY={dockingActive ? undefined : legacyStackBelowY}
        onMoveTo={onMoveCommentsPanel}
        onReset={collaborateWiring.onReset}
        dock={collaborateWiring.dock}
        onCommentRowClick={onOpenCommentsForElement}
        onActionRowClick={onOpenActionForElement}
        mobileOpenOverride={activeMobilePanel === 'collaborate'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  const aiEl =
    !chromeHidden && aiPanel && aiWiring ? (
      <CanvasAiPanel
        aiPanel={aiPanel}
        wiring={aiWiring}
        stackBelowY={dockingActive ? undefined : legacyStackBelowY}
        tabName={tabName}
        settings={settings}
        onChangeSettings={onChangeSettings}
        minimalPanels={!!minimalPanels}
        activeMobilePanel={activeMobilePanel}
        activeDockAnchor={activeDockAnchor ?? undefined}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  const activityEl = chromeHidden ? null : (
    <ActivityPanel
      position={activityWiring.position}
      minimized={activityMinimized}
      tabLocked={tabLocked}
      entries={changeLog}
      loading={changeLogLoading}
      readOnly={readOnly}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={activityHandlers.onUndo}
      onRedo={activityHandlers.onRedo}
      onRevert={activityHandlers.onRevertChange}
      onPreviewRevert={activityHandlers.onPreviewRevert}
      onClearRevertPreview={activityHandlers.onClearRevertPreview}
      revertHoverPreview={settings?.activityRevertHoverPreview !== false}
      onSetRevertHoverPreview={activityHandlers.onSetRevertHoverPreview}
      resettable={activityWiring.resettable}
      onRowClick={activityHandlers.onActivityRowClick}
      onClearActivity={activityHandlers.onClearActivity}
      saveStatus={saveStatus}
      savedAt={savedAt}
      onMoveTo={activityHandlers.onMoveActivity}
      onReset={activityWiring.onReset}
      dock={activityWiring.dock}
      onToggleMinimized={activityHandlers.onToggleActivityMinimized}
    />
  );

  // Layers panel (spec/74). Edit sessions only (a viewer can't manage
  // layers; visibility / lock still shape what they see via the render
  // path). Desktop: hidden while minimised into its bottom-right dock
  // button. Mobile / minimal: always mounted so the dock button can pop
  // it open (mobileOpenOverride gates the actual render).
  const layersEl =
    !chromeHidden && !readOnly && (isMobile || minimalPanels ? true : !layersMinimized) ? (
      <LayersPanel
        layers={layers}
        activeLayerId={activeLayerId}
        counts={layerCounts}
        elements={elements}
        position={layersWiring.position}
        onMoveTo={onMoveLayersPanel}
        onReset={layersWiring.onReset}
        dock={layersWiring.dock}
        onMinimize={onToggleLayersMinimized}
        mobileOpenOverride={activeMobilePanel === 'layers'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
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
        onSetHoverPreviewEnabled={(v) => {
          // Settings flip fires BEFORE the persist (spec/22).
          track('UI', 'Toggled', v ? 'LayerHoverPreviewOn' : 'LayerHoverPreviewOff');
          onChangeSettings({ ...settings, layerHoverPreview: v });
        }}
        resettable={layersWiring.resettable}
      />
    ) : null;

  const paletteEl =
    chromeHidden || readOnly ? null : (
      <CommandPalette
        position={paletteWiring.position}
        canvasTool={canvasTool}
        onSetCanvasTool={onSetCanvasTool}
        onExitAvatarMode={onExitAvatarMode}
        onToggleZen={onToggleZen}
        onMoveTo={onMovePalette}
        onReset={paletteWiring.onReset}
        dock={paletteWiring.dock}
        minimalPanels={minimalPanels}
        onToggleMinimalPanels={onToggleMinimalPanels}
        settings={settings}
        onChangeSettings={onChangeSettings}
        canvasEmpty={elements.length === 0}
        onAddShape={onAddShape}
        onAddIcon={onAddIcon}
        onAddTechIcon={onAddTechIcon}
        onAddTable={onAddTable}
        onAddAnnotation={onAddAnnotation}
        onAddLinkCard={onAddLinkCard}
        onAddBanner={onAddBanner}
        onAddHero={onAddHero}
        onAddHeader={onAddHeader}
        onAddCallout={onAddCallout}
        onAddStatRow={onAddStatRow}
        onAddProcess={onAddProcess}
        onAddAvatar={onAddAvatar}
        onAddText={onAddText}
        onAddSticky={onAddSticky}
        onAddImage={onAddImage}
        onAddArrow={onAddArrow}
        onBeginFreehand={onBeginFreehand}
        onBeginHighlighter={onBeginHighlighter}
        onBeginPolygon={onBeginPolygon}
        pendingDraw={pendingDraw}
        themeTint={paletteTint}
        onSize={(size) => setPaletteBottomY(size.bottomY)}
        mobileTopOverridePx={explorerBottomY > 0 ? explorerBottomY + 4 : undefined}
        mobileOpenOverride={activeMobilePanel === 'palette'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onDrawArmed={onPaletteDrawArmed}
        onMobileClose={() => {
          setActiveMobilePanel(null);
          setActiveDockAnchor(null);
        }}
      />
    );

  // Minimap (spec/59) routed through docking like the other panels: it
  // stacks with Activity in the bottom-left and snaps / persists the same
  // way (the old "defer to Activity at the default corner" gate is gone —
  // stacking handles their coexistence). Desktop-only, gated on the map
  // setting + a few elements; hidden in zen / welcome (chromeHidden).
  const mapEnabled = settings?.showMinimap !== false;
  const mapAccent = paletteTheme.elementStroke ?? '#0ea5e9';
  const minimapWiring = panelWiringFor('minimap', props.mapPosition, props.onResetMap);
  // Hidden layers (spec/74) drop out of the miniature too, so the map
  // matches the canvas. Not rendered at all in the minimal panel layout
  // (spec/59): minimal collapses panels to dock buttons, and a
  // free-floating map contradicts that.
  const minimapEl =
    !chromeHidden && !isMobile && !minimalPanels && mapEnabled && elements.length >= 4 ? (
      <Minimap
        elements={visibleLayerElements(elements, props.tabLayers)}
        viewportOffset={props.viewportOffset}
        viewportZoom={viewportZoom}
        setViewportOffset={props.setViewportOffset}
        setViewportZoom={props.setViewportZoom}
        mainRef={props.mainRef}
        accentColor={mapAccent}
        position={minimapWiring.position}
        onMove={props.onMoveMap}
        onResetPosition={minimapWiring.onReset}
        resettable={minimapWiring.resettable}
        dock={minimapWiring.dock}
        enabled={mapEnabled}
        onSetEnabled={(v) => {
          track('UI', 'Toggled', v ? 'MinimapOn' : 'MinimapOff');
          onChangeSettings({ ...settings, showMinimap: v });
        }}
      />
    ) : null;

  // Live poll (spec/88). Unlike its neighbours this panel is absent most
  // of the time: it exists only while a poll is running and the viewer is
  // entitled to the results, so it joins and leaves its corner stack.
  const pollEl =
    !chromeHidden && pollPanel ? (
      <PollPanel
        poll={pollPanel.poll}
        answers={pollPanel.answers}
        isHost={pollPanel.isHost}
        onEnd={pollPanel.onEnd}
        onDismiss={pollPanel.onDismiss}
        position={pollWiring.position}
        stackBelowY={dockingActive ? undefined : legacyStackBelowY}
        onMoveTo={onMovePollPanel}
        onReset={pollWiring.onReset}
        dock={pollWiring.dock}
        mobileOpenOverride={activeMobilePanel === 'poll'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
      />
    ) : null;

  // Live vote (spec/39). Present only while a vote is on the tab: turnout
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
        stackBelowY={dockingActive ? undefined : legacyStackBelowY}
        onMoveTo={onMoveVotePanel}
        onReset={voteWiring.onReset}
        dock={voteWiring.dock}
        mobileOpenOverride={activeMobilePanel === 'vote'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        readOnly={!!readOnly}
      />
    ) : null;

  // Avatar Panel (spec/101): the character sheet, mounted only while Avatar
  // mode is active — so it joins and leaves its corner stack the way the
  // session-tool panels do. Available to view-role too (the mode is), and on
  // mobile / minimal it opens from its dock button like every other panel.
  const avatarEl =
    !chromeHidden && canvasTool === 'avatar' && avatarConfig ? (
      <AvatarPanel
        config={avatarConfig}
        onChange={(field, value) => onChangeAvatarField?.(field, value)}
        onRandomise={onRandomiseAvatar}
        onReaction={onAvatarReaction}
        shirt={selfParticipant?.color}
        position={avatarWiring.position}
        stackBelowY={dockingActive ? undefined : legacyStackBelowY}
        onMoveTo={(x, y) => onMoveAvatarPanel?.(x, y)}
        onReset={avatarWiring.onReset}
        dock={avatarWiring.dock}
        mobileOpenOverride={activeMobilePanel === 'avatar'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={closeMobilePanel}
      />
    ) : null;

  // Map of panel id → element for the docked-layout distribution.
  const panelEls: Partial<Record<PanelId, ReactNode>> = {
    explorer: explorerEl,
    palette: paletteEl,
    collaborate: collaborateEl,
    ai: aiEl,
    activity: activityEl,
    minimap: minimapEl,
    layers: layersEl,
    poll: pollEl,
    vote: voteEl,
    avatar: avatarEl,
  };
  return { panelEls };
}
