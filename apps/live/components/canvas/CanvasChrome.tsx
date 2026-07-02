import { computeDrawGuides } from '@/components/canvas/canvas-draw-guides';
import { CanvasGuideOverlay } from '@/components/canvas/CanvasGuideOverlay';
import { CanvasDrawPreview } from '@/components/canvas/CanvasDrawPreview';
import { getTheme } from '@/lib/themes';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { ActivityIcon, ActivityPanel, RedoIcon, UndoIcon } from '@/components/panels/ActivityPanel';
// Lazy-load CommentsPanel: only mounts when the active tab has at
// least one element with comments. It stacks below the Palette (the
// top-right panel). Most diagrams never accumulate comments, so deferring
// the 164-line panel + its formatRelativeTimeShort + useRelativeTimeTick
// dependencies keeps the editor's initial chunk lean.
const CommentsPanel = dynamic(() =>
  import('@/components/panels/CommentsPanel').then((m) => m.CommentsPanel),
);
import { Explorer } from '@/components/panels/Explorer';
import { isMobileViewportSync } from '@/lib/responsive';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { AiPanelContent } from '@/components/panels/AiPanel';
import { AiSettingsPopover } from '@/components/panels/AiSettingsPopover';
import { TopCenterChrome } from '@/components/chrome/TopCenterChrome';
// Lazy-load TemplatePicker (1163 lines + its theme / share helpers)
// the same way ExportTabDialog + ShareDialog already are. The picker
// is gated on `showTemplatePicker`, which is false for the common
// path (a returning user opening an existing diagram with tabs that
// already have content). For first-time guests on a fresh diagram
// the gate is true on first paint, but the empty canvas underneath
// has already rendered by then, so the user sees the welcome modal
// fade in a frame later rather than blocking the route on the
// picker's JS. The /live/new entry keeps the static import because
// the picker is the whole UI there.
import dynamic from 'next/dynamic';
const TemplatePicker = dynamic(() =>
  import('@/components/palette/TemplatePicker').then((m) => m.TemplatePicker),
);

import { Tooltip } from '@/components/primitives/Tooltip';
import { ZoomControls } from '@/components/chrome/ZoomControls';
import { OffscreenContentHint } from '@/components/canvas/OffscreenContentHint';
import { CanvasMobileDock } from '@/components/canvas/CanvasMobileDock';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useStableCallbacks } from '@/hooks/ui/useStableCallbacks';
import type { DockAnchor, MobilePanel } from '@/hooks/canvas/useCanvasMobileDock';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { usePanelDock } from '@/hooks/ui/usePanelDock';
import { PanelSnapSlot } from '@/components/canvas/PanelSnapSlot';
import {
  DEFAULT_PANEL_CORNER,
  PANEL_CORNERS,
  PANEL_IDS,
  STACK_GAP_PX,
  cornerBottomInset,
  type PanelCorner,
  type PanelId,
} from '@/lib/panel-layout';
import { Minimap } from '@/components/canvas/Minimap';
import type { MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import { track } from '@/lib/telemetry';

// Values the Canvas computes (selection projection + layout/dock/zoom
// state) and threads into the chrome alongside its own props.
type ChromeExtras = {
  isPaintMode: boolean;
  isGroupMode: boolean;
  // True when every element has scrolled out of view: show the nudge above
  // the Fit button (useOffscreenContent in Canvas).
  offscreenContent: boolean;
  marquee: { startX: number; startY: number; currentX: number; currentY: number } | null;
  drawDrag: { startX: number; startY: number; currentX: number; currentY: number } | null;
  // Snapped pointer position while a draw is armed but not yet started
  // (pre-press start-snap preview); null when not armed / not snapped.
  drawHover: { x: number; y: number } | null;
  penPoints: { x: number; y: number }[] | null;
  wrapperRef: RefObject<HTMLDivElement | null>;
  paletteBottomY: number;
  setPaletteBottomY: Dispatch<SetStateAction<number>>;
  explorerBottomY: number;
  setExplorerBottomY: Dispatch<SetStateAction<number>>;
  activeMobilePanel: MobilePanel | null;
  setActiveMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  dockButtonRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  activeDockAnchor: DockAnchor | null;
  setActiveDockAnchor: Dispatch<SetStateAction<DockAnchor | null>>;
  handleDockButtonClick: (id: MobilePanel) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetZoom: () => void;
  // Begin an isometric orbit drag from the given screen coordinates
  // (wired to `isoCamera.startOrbit`). Drives the dock orbit button,
  // which only renders while the isometric tool is active.
  onIsoOrbit: (clientX: number, clientY: number) => void;
  // Reset the isometric camera to its default angle (wired to
  // `isoCamera.reset`) — fired when the dock orbit button is clicked.
  onIsoReset: () => void;
};

type CanvasChromeProps = CanvasProps & ChromeExtras;

// Per-corner stack container classes (spec/63). Each is an absolute,
// pointer-inert flex column pinned to one corner of the dock layer
// (inset 16px = the `*-4` resting inset). Top corners stack downward,
// bottom corners upward (flex-col-reverse) so the first panel always
// sits flush to the corner and the rest flow away from it.
const DOCK_CORNER_CLASS: Record<PanelCorner, string> = {
  'top-left': 'left-4 top-4 flex-col items-start',
  'top-right': 'right-4 top-4 flex-col items-end',
  'bottom-left': 'left-4 bottom-4 flex-col-reverse items-start',
  // bottom-right omits `bottom-4`; its bottom is set inline to clear the
  // fixed zoom controls (cornerBottomInset), so panels docked there sit
  // above the zoom bar instead of overlapping it.
  'bottom-right': 'right-4 flex-col-reverse items-end',
};

// The floating chrome layer of the canvas: empty-state prompt, template
// picker, multi-select toolbar, mode banners, mobile dock, Explorer, the
// Activity / Comments / Editor / Context panels, the palette, and
// the zoom / undo cluster. Extracted from Canvas.tsx verbatim; consumes
// Canvas's props plus the computed ChromeExtras.

export function CanvasChrome(props: CanvasChromeProps) {
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
    commentRows,
    commentsPanelPosition,
    currentDiagramId,
    diagramList,
    diagramListLoading,
    diagramName,
    dockButtonRefs,
    drawDrag,
    drawHover,
    elements,
    explorerBottomY,
    explorerPosition,
    folders,
    handleDockButtonClick,
    handleResetZoom,
    handleZoomIn,
    handleZoomOut,
    marquee,
    minimalPanels,
    onToggleMinimalPanels,
    settings,
    onChangeSettings,
    onActivityRowClick,
    onAddArrow,
    onAddImage,
    onAddShape,
    onAddIcon,
    onAddTechIcon,
    onAddTable,
    onAddAnnotation,
    onAddLinkCard,
    onAddBanner,
    onAddHero,
    onAddHeader,
    onAddCallout,
    onAddStatRow,
    onAddProcess,
    onAddAvatar,
    onAddSticky,
    onAddText,
    onBeginFreehand,
    onChooseTemplate,
    onClearActivity,
    onCreateFolder,
    onDeleteDiagram,
    onDeleteFolder,
    offscreenContent,
    onDismissShared,
    onDuplicateDiagram,
    onFitToScreen,
    onMoveActivity,
    onMoveCommentsPanel,
    onMoveDiagramToFolder,
    onMoveExplorer,
    onMovePalette,
    onNewDiagram,
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
    onIsoOrbit,
    onIsoReset,
    onSetCanvasTool,
    onSkipTemplatePicker,
    onToggleActivityMinimized,
    onUndo,
    paletteBottomY,
    palettePosition,
    pendingDraw,
    penPoints,
    readOnly,
    savedAt,
    saveStatus,
    selfParticipant,
    snapGuides,
    distGuides,
    snapTargets,
    setActiveDockAnchor,
    setActiveMobilePanel,
    setExplorerBottomY,
    setPaletteBottomY,
    sharedDiagrams,
    teams,
    teamFolders,
    teamDiagrams,
    showTemplatePicker,
    tabLocked,
    tabName,
    tabThemeId,
    templatePickerLockedName,
    templatePickerMode,
    viewportZoom,
    welcomeOpen,
    wrapperRef,
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
  // Zen / focus mode (spec/26): hide all floating chrome. `chromeHidden`
  // folds it in next to the welcome-flow gate that already suppresses
  // the same panels, so each panel stays hidden in either state.
  const chromeHidden = welcomeOpen || zenMode === true;

  // --- Corner docking (spec/63) ---
  // Device-local panel layout + live drag/snap state. Self-contained
  // (reads/writes localStorage itself), so it lives here at the one
  // consumer rather than threaded through the editor view-model.
  const isMobile = useIsMobileViewport();
  const dock = usePanelDock();
  // The dock layer is an inset-0 child of <main>, so its rect is the
  // positioning origin for free / dragging panels and the basis for the
  // corner snap zones. Docking is desktop-only and off in the minimal
  // dock + zen layouts (no corners to dock into there).
  const dockLayerRef = useRef<HTMLDivElement>(null);
  const getDockBounds = useCallback(
    () => dockLayerRef.current?.getBoundingClientRect() ?? null,
    [],
  );
  // Live refs to the four corner stack containers, so snap detection can
  // measure how tall the EXISTING stack in each corner is and offset the
  // anchor to the landing position (below a top stack / above a bottom
  // one) instead of the bare corner.
  const cornerRefs = useRef<Record<PanelCorner, HTMLDivElement | null>>({
    'top-left': null,
    'top-right': null,
    'bottom-left': null,
    'bottom-right': null,
  });
  const measureCornerExtents = useCallback((): Record<PanelCorner, number> => {
    const out: Record<PanelCorner, number> = {
      'top-left': 0,
      'top-right': 0,
      'bottom-left': 0,
      'bottom-right': 0,
    };
    // The dragged panel is `position: fixed` (out of flow), so a corner
    // container's height already excludes it. Subtract the landing slot
    // (rendered only in the current candidate corner) so we measure just
    // the RESTING stack and don't feed the slot back into the anchor.
    const candidate = dock.drag?.candidate ?? null;
    const slot = Math.max(dock.drag?.height ?? 0, 48) + STACK_GAP_PX;
    for (const corner of PANEL_CORNERS) {
      const el = cornerRefs.current[corner];
      if (!el) continue;
      const h = el.getBoundingClientRect().height;
      out[corner] = Math.max(0, corner === candidate ? h - slot : h);
    }
    return out;
  }, [dock.drag]);
  const dockingActive = !isMobile && !minimalPanels && !zenMode;
  // Build the per-panel wiring: in docking mode, position comes from the
  // layout (free pos, or null when corner-docked → rendered as a flex
  // child), reset snaps back to the default corner, and the dock bundle
  // routes drags through the snap machinery. Otherwise the legacy
  // per-panel position/reset props are used unchanged.
  const panelWiringFor = useCallback(
    (
      id: PanelId,
      legacyPosition: { x: number; y: number } | null,
      legacyReset: () => void,
    ): {
      position: { x: number; y: number } | null;
      onReset: () => void;
      // True when the panel actually sits away from its default corner
      // (free, or docked elsewhere) — drives the "Reset position"
      // enablement, which spec/59 wants greyed when already home.
      resettable: boolean;
      dock?: MovablePanelDockProps;
    } => {
      if (!dockingActive)
        return {
          position: legacyPosition,
          onReset: legacyReset,
          resettable: legacyPosition !== null,
        };
      const placement = dock.placementOf(id);
      const dragging = dock.isDragging(id);
      return {
        position: placement.mode === 'free' ? placement.pos : null,
        onReset: () => dock.resetPanel(id),
        resettable: placement.mode === 'free' || placement.corner !== DEFAULT_PANEL_CORNER[id],
        dock: {
          docked: placement.mode === 'corner' && !dragging,
          dockedCorner: placement.mode === 'corner' ? placement.corner : undefined,
          getDockBounds,
          onDockDragStart: () => dock.beginDrag(id),
          onDockDrag: (geom) => dock.updateDrag(id, geom, measureCornerExtents()),
          onDockDragEnd: (geom) => {
            if (dock.endDrag(id, geom, measureCornerExtents())) track('UI', 'Moved', 'PanelDock');
          },
        },
      };
    },
    [dockingActive, dock, getDockBounds, measureCornerExtents],
  );
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
  const { alignGuides, allSnapTargets } = computeDrawGuides({
    drawDrag,
    pendingDraw,
    elements,
    drawHover,
    penPoints,
    snapGuides,
    snapTargets,
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
  const commentsWiring = panelWiringFor('comments', commentsPanelPosition, onResetCommentsPanel);
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

  const commentsEl =
    !chromeHidden && !minimalPanels && commentRows.length > 0 ? (
      <div className="hidden sm:contents">
        <CommentsPanel
          position={commentsWiring.position}
          rows={commentRows}
          stackBelowY={dockingActive ? undefined : legacyStackBelowY}
          onMoveTo={onMoveCommentsPanel}
          onReset={commentsWiring.onReset}
          dock={commentsWiring.dock}
          onRowClick={onOpenCommentsForElement}
        />
      </div>
    ) : null;

  const aiEl =
    !chromeHidden && aiPanel && aiWiring ? (
      <MovablePanel
        title="AI Assistant"
        position={aiWiring.position}
        defaultCorner="top-right-stacked"
        stackBelowY={dockingActive ? undefined : legacyStackBelowY}
        width="w-auto sm:w-64"
        collapsible
        // No header reset button here (unlike the other panels): the AI
        // panel's Settings popover already carries a "Reset position" item,
        // so a second one in the title row was redundant. Drag-to-move still
        // works via onMoveTo; the popover handles the reset.
        onMoveTo={aiPanel.onMove}
        {...aiWiring.dock}
        headerActions={
          <AiSettingsPopover
            enabled={settings.aiAssistanceEnabled === true}
            onSetEnabled={(v) => {
              track('AI', 'Toggled', v ? 'AiOn' : 'AiOff');
              onChangeSettings({ ...settings, aiAssistanceEnabled: v });
            }}
            showSuggestions={settings.aiSuggestedPrompts !== false}
            onSetShowSuggestions={(v) => onChangeSettings({ ...settings, aiSuggestedPrompts: v })}
            onResetPosition={aiWiring.onReset}
            resettable={aiWiring.resettable}
          />
        }
        mobileOpenOverride={activeMobilePanel === 'ai'}
        mobileDockAnchor={activeDockAnchor ?? undefined}
        forceDockMode={!!minimalPanels}
        onMobileClose={() => {
          setActiveMobilePanel(null);
          setActiveDockAnchor(null);
        }}
      >
        <AiPanelContent
          contextElements={aiPanel.contextElements}
          focusIds={aiPanel.focusIds}
          tabId={aiPanel.tabId}
          tabName={tabName}
          ownerId={aiPanel.ownerId}
          onApplyElements={aiPanel.onApplyElements}
          showSuggestions={settings.aiSuggestedPrompts !== false}
        />
      </MovablePanel>
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
    comments: commentsEl,
    ai: aiEl,
    activity: activityEl,
    minimap: minimapEl,
  };
  // Bucketing keys off the persisted placement ONLY (not which panel is
  // mid-drag): a dragged panel must stay in the same DOM parent for the
  // whole gesture — reparenting it would remount the component and drop
  // the in-flight drag. While lifted it just renders `position: absolute`
  // in place (MovablePanel), and its corner siblings reflow into the gap.
  // The persisted corner/free placement only changes on pointer-up.
  const freePanelIds = PANEL_IDS.filter(
    (id) => panelEls[id] != null && dock.placementOf(id).mode === 'free',
  );
  const snapCorner = dock.drag?.candidate ?? null;
  const snapHeight = dock.drag?.height ?? 0;
  const dockedLayer = dockingActive ? (
    <div ref={dockLayerRef} className="pointer-events-none absolute inset-0 z-[var(--z-panel)]">
      {PANEL_CORNERS.map((corner) => {
        const children = dock.cornerStacks[corner].filter((id) => panelEls[id] != null);
        // Show the live landing slot at the end of the candidate corner's
        // stack (flexbox places it where the panel will actually land).
        const showSlot = snapCorner === corner;
        if (children.length === 0 && !showSlot) return null;
        return (
          <div
            key={corner}
            ref={(el) => {
              cornerRefs.current[corner] = el;
            }}
            style={corner === 'bottom-right' ? { bottom: cornerBottomInset(corner) } : undefined}
            className={`pointer-events-none absolute flex gap-4 ${DOCK_CORNER_CLASS[corner]}`}
          >
            {children.map((id) => (
              <Fragment key={id}>{panelEls[id]}</Fragment>
            ))}
            {showSlot ? <PanelSnapSlot height={snapHeight} /> : null}
          </div>
        );
      })}
      {freePanelIds.map((id) => (
        <Fragment key={id}>{panelEls[id]}</Fragment>
      ))}
    </div>
  ) : null;

  return (
    <>
      {/* The empty-canvas hint is now a dismissible bottom banner
          (EmptyCanvasBanner), rendered by EditorView alongside the sign-in /
          theme banners rather than a centre-of-canvas card. */}

      {showTemplatePicker ? (
        <TemplatePicker
          mode={templatePickerMode}
          participant={selfParticipant}
          currentThemeId={tabThemeId}
          diagramName={diagramName}
          lockedName={templatePickerLockedName}
          onPick={onChooseTemplate}
          onSkip={onSkipTemplatePicker}
        />
      ) : null}

      <CanvasGuideOverlay
        alignGuides={alignGuides}
        allSnapTargets={allSnapTargets}
        distGuides={distGuides}
        drawHover={drawHover}
        viewportZoom={viewportZoom}
        marquee={marquee}
        tabThemeId={tabThemeId}
        wrapperRef={wrapperRef}
      />

      <CanvasDrawPreview
        drawDrag={drawDrag}
        penPoints={penPoints}
        pendingDraw={pendingDraw}
        viewportZoom={viewportZoom}
        wrapperRef={wrapperRef}
      />

      {/* Top-of-canvas floating chrome (spec/09): owner / role badge, the
          active editor-mode banner, multi-selection toolbar, session timer
          and vote banner — laid out as one non-overlapping stack. */}
      <TopCenterChrome {...props} />

      <CanvasMobileDock
        welcomeOpen={chromeHidden}
        minimalPanels={minimalPanels}
        readOnly={readOnly}
        hasAi={!!aiPanel}
        activeMobilePanel={activeMobilePanel}
        dockButtonRefs={dockButtonRefs}
        onDockButtonClick={handleDockButtonClick}
      />

      {/* Floating panels (spec/63). In the desktop docking layout they
          are distributed into per-corner stack containers (with a free
          layer + snap guides) by `dockedLayer`; otherwise — mobile,
          minimal dock, or zen — they render inline where they always
          did. Each element carries its own visibility gate, so the
          welcome-flow / read-only / zen suppression is unchanged.
          Explorer stays visible during the welcome flow; only zen hides
          it. */}
      {dockingActive ? (
        dockedLayer
      ) : (
        <>
          {explorerEl}
          {commentsEl}
          {aiEl}
          {activityEl}
          {paletteEl}
          {minimapEl}
        </>
      )}

      {/* Bottom dock. Order, left → right: Zoom controls, History
          controls, and a minimised Activity dock when applicable.
          The Palette is banner-collapsed in place (spec/09)
          so it's not in the dock cluster; the Explorer is hidden
          on mobile entirely (spec/07) and uses banner-collapse on
          desktop, so it's also not in the dock cluster. */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-[var(--z-panel)] flex items-center gap-2">
        {welcomeOpen ? null : (
          <>
            {offscreenContent ? <OffscreenContentHint onBringBack={onFitToScreen} /> : null}
            {!zenMode && activityMinimized && !readOnly ? (
              // Collapsed Activity dock (editor sessions only): a strip
              // with inline Undo / Redo so the most common history
              // actions don't require reopening the panel. View-role
              // visitors don't get this button at all: undo/redo and
              // the audit trail aren't actionable for them, so the
              // dock would just be dead chrome.
              <div
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="pointer-events-auto flex animate-pop-in items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
              >
                <Tooltip title="Open Tab Activity" description="Expand the Tab Activity panel.">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onToggleActivityMinimized}
                    aria-label="Open Tab Activity"
                    className="hidden h-11 w-11 items-center justify-center border-r border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 sm:flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <ActivityIcon />
                  </button>
                </Tooltip>
                <Tooltip title="Undo" description="Undo last edit.">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onUndo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    className="flex h-11 w-11 items-center justify-center text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
                  >
                    <UndoIcon />
                  </button>
                </Tooltip>
                <Tooltip title="Redo" description="Redo last undone edit.">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onRedo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    className="flex h-11 w-11 items-center justify-center border-l border-slate-100 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:disabled:text-slate-600 dark:disabled:hover:bg-transparent"
                  >
                    <RedoIcon />
                  </button>
                </Tooltip>
              </div>
            ) : null}
            <ZoomControls
              zoom={viewportZoom}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onReset={handleResetZoom}
              onFitToScreen={onFitToScreen}
              onIsoOrbit={canvasTool === 'isometric' ? onIsoOrbit : undefined}
              onIsoReset={canvasTool === 'isometric' ? onIsoReset : undefined}
              onToggleZen={onToggleZen}
              zenActive={zenMode}
            />
          </>
        )}
      </div>
    </>
  );
}
