'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { getTheme } from '@/lib/themes';
import { isMobileViewportSync } from '@/lib/responsive';
import { track } from '@/lib/telemetry';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import type { useCornerDocking } from '@/hooks/ui/useCornerDocking';
import type { PanelId } from '@/lib/panel-layout';
import { ActivityPanel } from '@/components/panels/ActivityPanel';
import { CanvasAiPanel } from './CanvasAiPanel';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { Explorer } from '@/components/panels/Explorer';
import { Minimap } from '@/components/canvas/Minimap';
import type { CanvasChromeProps } from './CanvasChrome';

// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments. It stacks below the Palette (the
// top-right panel). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
const CollaboratePanel = dynamic(() =>
  import('@/components/panels/CollaboratePanel').then((m) => m.CollaboratePanel),
);

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
    onChangeSettings,
    onClearActivity,
    onCreateFolder,
    onDeleteDiagram,
    onDeleteFolder,
    onDismissShared,
    onDuplicateDiagram,
    onMoveActivity,
    onMoveCommentsPanel,
    onMoveDiagramToFolder,
    onMoveExplorer,
    onMovePalette,
    onNewDiagram,
    onOpenActionForElement,
    onOpenCommentsForElement,
    onOpenDiagram,
    onRedo,
    onRenameCurrent,
    onRenameFolder,
    onResetActivity,
    onResetCommentsPanel,
    onResetExplorer,
    onResetPalette,
    onRevertChange,
    onSetCanvasTool,
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
    onDeleteDiagram,
    onDuplicateDiagram,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveDiagramToFolder,
  });
  const activityHandlers = useStableCallbacks({
    onUndo,
    onRedo,
    onRevertChange,
    onActivityRowClick,
    onClearActivity,
    onMoveActivity,
    onResetActivity,
    onToggleActivityMinimized,
  });
  const onExplorerSize = useCallback(
    (size: { width: number; height: number; bottomY: number }) => setExplorerBottomY(size.bottomY),
    [setExplorerBottomY],
  );
  const closeMobilePanel = useCallback(() => {
    setActiveMobilePanel(null);
    setActiveDockAnchor(null);
  }, [setActiveMobilePanel, setActiveDockAnchor]);
  // Dock-mode palette reopen: when a draw tool is armed FROM the palette it
  // closes so the user can draw; once the draw lands (pendingDraw clears),
  // reopen the palette so they can pick the next thing without re-tapping.
  const reopenPaletteAfterDrawRef = useRef(false);
  const prevPendingDrawRef = useRef(pendingDraw);
  // Keep the latest opener in a ref so the transition effect can stay keyed
  // on pendingDraw without re-running every render.
  const openDockPanelRef = useRef(handleDockButtonClick);
  openDockPanelRef.current = handleDockButtonClick;
  useEffect(() => {
    const prev = prevPendingDrawRef.current;
    prevPendingDrawRef.current = pendingDraw;
    if (prev && !pendingDraw && reopenPaletteAfterDrawRef.current) {
      reopenPaletteAfterDrawRef.current = false;
      // Reopen via the dock handler so the popover anchor is recomputed
      // from the dock button (the same path a manual tap takes) — setting
      // the panel alone would reopen it at a stale/missing position.
      if (minimalPanels || isMobileViewportSync()) openDockPanelRef.current('palette');
    }
  }, [pendingDraw, minimalPanels]);
  // Theme tint for the palette tiles, so the palette previews the active
  // tab theme: the boxed-shape tiles render filled in the theme's element
  // fill + stroke, line-art tools + icons tint to the stroke. The Basic
  // theme leaves elementStroke null, so we pass nothing and the palette
  // keeps its default slate look. See spec/09.
  const paletteTheme = getTheme(tabThemeId);
  // A per-shape theme (UML / custom, spec/42 + spec/44) tints each shape
  // tile by its own kind even when the base element stroke is unset, so
  // surface the tint whenever there's a base stroke OR per-shape colours.
  const paletteTint =
    paletteTheme.elementStroke || paletteTheme.shapeColors
      ? {
          stroke: paletteTheme.elementStroke ?? undefined,
          fill: paletteTheme.elementFill ?? undefined,
          shapeColors: paletteTheme.shapeColors,
        }
      : undefined;
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
  // In docking mode the corner flex columns own stacking, so the legacy
  // measured stack-below-the-palette offset is dropped.
  const legacyStackBelowY =
    palettePosition !== null || paletteBottomY === 0 ? undefined : paletteBottomY;

  const explorerEl = zenMode ? null : (
    <Explorer
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
      onDeleteDiagram={explorerHandlers.onDeleteDiagram}
      onDuplicateDiagram={explorerHandlers.onDuplicateDiagram}
      onCreateFolder={explorerHandlers.onCreateFolder}
      onRenameFolder={explorerHandlers.onRenameFolder}
      onDeleteFolder={explorerHandlers.onDeleteFolder}
      onMoveDiagramToFolder={explorerHandlers.onMoveDiagramToFolder}
      onSize={onExplorerSize}
      mobileOpenOverride={activeMobilePanel === 'explorer'}
      mobileDockAnchor={activeDockAnchor ?? undefined}
      forceDockMode={!!minimalPanels}
      onMobileClose={closeMobilePanel}
    />
  );

  const collaborateEl =
    !chromeHidden && !minimalPanels && (commentRows.length > 0 || actionRows.length > 0) ? (
      <div className="hidden sm:contents">
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
        />
      </div>
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

  const paletteEl =
    chromeHidden || readOnly ? null : (
      <CommandPalette
        position={paletteWiring.position}
        canvasTool={canvasTool}
        onSetCanvasTool={onSetCanvasTool}
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
        pendingDraw={pendingDraw}
        themeTint={paletteTint}
        onSize={(size) => setPaletteBottomY(size.bottomY)}
        mobileTopOverridePx={explorerBottomY > 0 ? explorerBottomY + 4 : undefined}
        mobileOpenOverride={activeMobilePanel === 'palette'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onDrawArmed={() => {
          // Only remember to reopen if the palette was actually the open
          // dock panel when the draw was armed.
          reopenPaletteAfterDrawRef.current = activeMobilePanel === 'palette';
        }}
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
  const minimapEl =
    !chromeHidden && !isMobile && mapEnabled && elements.length >= 4 ? (
      <Minimap
        elements={elements}
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

  // Map of panel id → element for the docked-layout distribution.
  const panelEls: Partial<Record<PanelId, ReactNode>> = {
    explorer: explorerEl,
    palette: paletteEl,
    collaborate: collaborateEl,
    ai: aiEl,
    activity: activityEl,
    minimap: minimapEl,
  };
  return { panelEls };
}
