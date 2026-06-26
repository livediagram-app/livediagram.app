import {
  alignmentGuides,
  arrowSnapPoints,
  deriveTextColorForBg,
  isSelfDrawingShape,
  snapToArrowPoint,
  type ArrowElement,
} from '@livediagram/diagram';
import { ARROW_SNAP_REVEAL_PX, ARROW_SNAP_THRESHOLD_PX } from '@/lib/canvas';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import { getTheme } from '@/lib/themes';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { isSvgRenderedShape, ShapeSvgOverlay } from '@/components/canvas/shape-svg-overlay';
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
  PANEL_CORNERS,
  PANEL_IDS,
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

// Nothing to exclude when guiding a draw-to-size box: the element doesn't
// exist yet, so every neighbour is a candidate.
const NO_GUIDE_EXCLUDE: Set<string> = new Set();

// Axis-aligned bounding box of a point list, single pass (a freehand
// stroke can hold thousands of samples, so avoid Math.min(...spread)).
function boundingBoxOf(points: { x: number; y: number }[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    else if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    else if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

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
    onOpenFullExplorer,
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
    onOpenFullExplorer,
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
      dock?: MovablePanelDockProps;
    } => {
      if (!dockingActive) return { position: legacyPosition, onReset: legacyReset };
      const placement = dock.placementOf(id);
      const dragging = dock.isDragging(id);
      return {
        position: placement.mode === 'free' ? placement.pos : null,
        onReset: () => dock.resetPanel(id),
        dock: {
          docked: placement.mode === 'corner' && !dragging,
          dockedCorner: placement.mode === 'corner' ? placement.corner : undefined,
          getDockBounds,
          onDockDragStart: () => dock.beginDrag(id),
          onDockDrag: (geom) => dock.updateDrag(id, geom),
          onDockDragEnd: (geom) => {
            if (dock.endDrag(id, geom)) track('UI', 'Moved', 'PanelDock');
          },
        },
      };
    },
    [dockingActive, dock, getDockBounds],
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
  // Alignment guides for the in-progress draw-to-size box, so the user
  // sees which neighbour edges / centres it latched onto — the same faint
  // lines a move / resize shows. Box intents only (arrows are a line,
  // freehand a stroke). drawDrag's start + current are already the
  // SNAPPED points, so alignmentGuides reports a line exactly when a snap
  // is in effect, mirroring the move/resize derivation. Concatenated with
  // the move/resize snapGuides (mutually exclusive in practice) for the
  // single guide overlay below.
  const drawBoxGuides =
    drawDrag && pendingDraw && pendingDraw.type !== 'arrow' && pendingDraw.type !== 'freehand'
      ? alignmentGuides(
          {
            x: Math.min(drawDrag.startX, drawDrag.currentX),
            y: Math.min(drawDrag.startY, drawDrag.currentY),
            width: Math.abs(drawDrag.currentX - drawDrag.startX),
            height: Math.abs(drawDrag.currentY - drawDrag.startY),
          },
          elements,
          NO_GUIDE_EXCLUDE,
        )
      : [];
  // Pre-press start-snap preview: guides for the snapped hover point (a
  // 0×0 candidate), so the user sees the first corner latch before they
  // press. Mutually exclusive with drawBoxGuides (hover is cleared once a
  // drag starts). The snapped dot itself renders below the guide overlay.
  const drawHoverGuides = drawHover
    ? alignmentGuides(
        { x: drawHover.x, y: drawHover.y, width: 0, height: 0 },
        elements,
        NO_GUIDE_EXCLUDE,
      )
    : [];
  // Freehand: guide off the live stroke's bounding box so its edges /
  // centre line up with neighbours as you draw — combined with the
  // pre-press start snap, that lets a sketch match a nearby element's
  // width / height (draw until the far edge latches the neighbour's edge).
  const penBox = penPoints && penPoints.length > 0 ? boundingBoxOf(penPoints) : null;
  const drawPenGuides = penBox ? alignmentGuides(penBox, elements, NO_GUIDE_EXCLUDE) : [];
  const alignGuides =
    drawBoxGuides.length > 0 || drawHoverGuides.length > 0 || drawPenGuides.length > 0
      ? [...snapGuides, ...drawBoxGuides, ...drawHoverGuides, ...drawPenGuides]
      : snapGuides;
  // While drawing a NEW arrow near another arrow, reveal that arrow's snap
  // points (spec/50) — the same dots the reposition drag shows — so the user
  // can line the new endpoint up as they draw, not only after dropping it.
  const drawArrowSnaps: SnapTarget[] = (() => {
    if (!drawDrag || !pendingDraw || pendingDraw.type !== 'arrow') return [];
    const cursor = { x: drawDrag.currentX, y: drawDrag.currentY };
    const hit = snapToArrowPoint(cursor, elements, ARROW_SNAP_REVEAL_PX, '');
    if (!hit) return [];
    const target = elements.find((e) => e.id === hit.arrowId && e.type === 'arrow') as
      | ArrowElement
      | undefined;
    if (!target) return [];
    const snapped = hit.dist <= ARROW_SNAP_THRESHOLD_PX;
    return arrowSnapPoints(target, elements).map((sp) => ({
      x: sp.x,
      y: sp.y,
      active: snapped && Math.abs(sp.t - hit.t) < 1e-6,
    }));
  })();
  // The reposition-drag targets and the draw-time targets never coexist (one
  // gesture at a time), so a simple concat drives the single dot overlay.
  const allSnapTargets =
    drawArrowSnaps.length > 0 ? [...snapTargets, ...drawArrowSnaps] : snapTargets;

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
      folders={folders}
      loading={diagramListLoading}
      shared={sharedDiagrams}
      teams={teams}
      teamFolders={teamFolders}
      teamDiagrams={teamDiagrams}
      onDismissShared={explorerHandlers.onDismissShared}
      onOpenFullExplorer={explorerHandlers.onOpenFullExplorer}
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
        onReset={aiWiring.onReset}
        onMoveTo={aiPanel.onMove}
        {...aiWiring.dock}
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
          tabName={tabName}
          ownerId={aiPanel.ownerId}
          onApplyElements={aiPanel.onApplyElements}
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
        resettable={minimapWiring.position !== null || minimapWiring.dock !== undefined}
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

      {/* Alignment guides. While a move / resize snap is in effect,
          draw a faint line along each edge / centre the dragged element
          now shares with a neighbour, so the user sees WHY it snapped.
          Canvas coords convert to client coords via the wrapper rect +
          zoom (same as the draw / pen previews). The colour follows the
          theme: the theme's element stroke when it sets one, else a
          slate tuned to contrast with the theme's backdrop — faint via
          opacity so it reads as helper chrome, not content. */}
      {alignGuides.length > 0
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const theme = getTheme(tabThemeId);
            const color = theme.elementStroke ?? deriveTextColorForBg(theme.backgroundColor);
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {alignGuides.map((g, i) => {
                  // Convert the guide's canvas-space line into the two
                  // screen-space endpoints. A vertical guide (axis 'x')
                  // holds x constant and runs start→end in y; horizontal
                  // is the mirror.
                  const x1 = rect.left + (g.axis === 'x' ? g.position : g.start) * viewportZoom;
                  const y1 = rect.top + (g.axis === 'x' ? g.start : g.position) * viewportZoom;
                  const x2 = rect.left + (g.axis === 'x' ? g.position : g.end) * viewportZoom;
                  const y2 = rect.top + (g.axis === 'x' ? g.end : g.position) * viewportZoom;
                  return (
                    <line
                      key={`${g.axis}:${g.position}:${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={1}
                      strokeOpacity={0.55}
                      strokeDasharray="4 3"
                    />
                  );
                })}
              </svg>
            );
          })()
        : null}

      {/* Arrow-endpoint snap targets. While dragging an arrow's endpoint,
          mark the connection points of nearby shapes so the user can see
          where it will snap; the point the endpoint is currently snapped to
          is drawn larger + filled. Same canvas→screen conversion as the
          guides above. */}
      {allSnapTargets.length > 0
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {allSnapTargets.map((t, i) => {
                  const x = rect.left + t.x * viewportZoom;
                  const y = rect.top + t.y * viewportZoom;
                  return (
                    <circle
                      key={`snap-${i}`}
                      cx={x}
                      cy={y}
                      r={t.active ? 5 : 3.5}
                      fill={t.active ? 'rgb(14, 165, 233)' : 'white'}
                      stroke="rgb(14, 165, 233)"
                      strokeWidth={t.active ? 2 : 1.5}
                    />
                  );
                })}
              </svg>
            );
          })()
        : null}

      {/* Pre-press start-snap dot. While a draw is armed and the hovered
          pointer has snapped to a neighbour, mark the snapped point so the
          user knows where the first corner will land before pressing (the
          guide lines above show what it aligned to). */}
      {drawHover
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const x = rect.left + drawHover.x * viewportZoom;
            const y = rect.top + drawHover.y * viewportZoom;
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="rgb(14, 165, 233)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              </svg>
            );
          })()
        : null}

      {/* Equal-spacing (distribution) guides. While a move snaps an
          element to even spacing with its neighbours, draw the matched
          gap segments as pink tick-capped lines so the equal distances
          read at a glance. Same canvas→screen conversion as above. */}
      {distGuides.length > 0
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const cx = (v: number) => rect.left + v * viewportZoom;
            const cy = (v: number) => rect.top + v * viewportZoom;
            const color = 'rgb(236, 72, 153)'; // pink-500, distinct from alignment
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {distGuides.flatMap((g, gi) =>
                  g.spans.map((s, si) => {
                    const key = `${gi}:${si}`;
                    if (g.axis === 'x') {
                      const x1 = cx(s.from);
                      const x2 = cx(s.to);
                      const y = cy(s.cross);
                      return (
                        <g key={key} stroke={color} strokeWidth={1}>
                          <line x1={x1} y1={y} x2={x2} y2={y} />
                          <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
                          <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
                        </g>
                      );
                    }
                    const y1 = cy(s.from);
                    const y2 = cy(s.to);
                    const x = cx(s.cross);
                    return (
                      <g key={key} stroke={color} strokeWidth={1}>
                        <line x1={x} y1={y1} x2={x} y2={y2} />
                        <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
                        <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} />
                      </g>
                    );
                  }),
                )}
              </svg>
            );
          })()
        : null}

      {marquee ? (
        <div
          aria-hidden
          // Border + faint fill take the active tab theme's accent (elementStroke,
          // else the brand sky) so the marquee suits the tab. color-mix keeps the
          // 12% fill working whatever colour format the theme uses.
          className="pointer-events-none fixed z-[var(--z-chrome)] rounded-sm border"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
            borderColor: paletteTheme.elementStroke ?? '#0ea5e9',
            backgroundColor: `color-mix(in srgb, ${paletteTheme.elementStroke ?? '#0ea5e9'} 12%, transparent)`,
          }}
        />
      ) : null}

      {/* Draw-to-size preview. drawDrag holds canvas coords; convert
          to client coords via the wrapper rect + viewportZoom so the
          overlay aligns with the canvas content under it. The shape
          itself renders via ShapeSvgOverlay (the same primitive
          BoxedElementView uses for committed shapes) with a dashed-
          brand stroke + translucent brand fill, so "draw circle"
          looks like an oval, "draw diamond" like a diamond, etc.
          The three simple kinds (square / circle / stadium) bypass
          SVG and use border-radius on the wrapping div, matching
          how BoxedElementView renders them at rest. */}
      {/* Pen-gesture live preview. While the user is drawing freehand,
          paint the in-progress polyline as a brand-tinted stroke so
          they can see what they're sketching. Sits on the same z-[var(--z-chrome)]
          overlay layer as the draw-to-size box preview. Switches to
          the committed FreehandSvg after release (the next render
          tick once the new element lands in `elements`). */}
      {penPoints && pendingDraw?.type === 'freehand' && penPoints.length >= 2
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            // Build an SVG polyline string from the sampled canvas-
            // coord points, converted to client coords via the
            // wrapper rect + zoom so the overlay aligns with the
            // canvas content.
            const d = penPoints
              .map(
                (p, i) =>
                  `${i === 0 ? 'M' : 'L'} ${rect.left + p.x * viewportZoom} ${
                    rect.top + p.y * viewportZoom
                  }`,
              )
              .join(' ');
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                <path
                  d={d}
                  fill="none"
                  stroke="rgb(14, 165, 233)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            );
          })()
        : null}

      {drawDrag && pendingDraw
        ? (() => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) return null;
            // Arrow intent: render the drag as a line from the start
            // point to the current point, with a small chevron-like
            // arrowhead near the end so the user sees the direction
            // they've drawn (the committed arrow defaults to no
            // arrowheads; this is just preview chrome).
            if (pendingDraw.type === 'arrow') {
              const x1 = rect.left + drawDrag.startX * viewportZoom;
              const y1 = rect.top + drawDrag.startY * viewportZoom;
              const x2 = rect.left + drawDrag.currentX * viewportZoom;
              const y2 = rect.top + drawDrag.currentY * viewportZoom;
              return (
                <svg
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                </svg>
              );
            }
            const canvasMinX = Math.min(drawDrag.startX, drawDrag.currentX);
            const canvasMinY = Math.min(drawDrag.startY, drawDrag.currentY);
            const canvasW = Math.abs(drawDrag.currentX - drawDrag.startX);
            const canvasH = Math.abs(drawDrag.currentY - drawDrag.startY);
            const widthPx = Math.max(canvasW * viewportZoom, 1);
            const heightPx = Math.max(canvasH * viewportZoom, 1);
            // The self-drawing shapes (progress / rail / rating / charts) render
            // via their own views, not ShapeSvgOverlay (which would draw nothing
            // for them), so they fall back to the dashed-rect preview.
            const usesSvg =
              pendingDraw.type === 'shape' &&
              isSvgRenderedShape(pendingDraw.kind) &&
              !isSelfDrawingShape(pendingDraw.kind);
            // Box intents: square / circle / stadium use border-
            // radius on the wrapping div (matching the BoxedElementView
            // at-rest treatment), every SVG-rendered shape kind
            // delegates to ShapeSvgOverlay, and text / sticky / image
            // fall back to a simple dashed-rect. The text + sticky
            // + image branches use 4px corners; stickies don't get
            // their corner-fold preview here because the preview is
            // very small and a peeled corner just reads as noise.
            const radius =
              pendingDraw.type === 'shape' &&
              (pendingDraw.kind === 'circle' || pendingDraw.kind === 'progress-ring')
                ? '50%'
                : pendingDraw.type === 'shape' &&
                    (pendingDraw.kind === 'stadium' || pendingDraw.kind === 'progress-bar')
                  ? '9999px'
                  : '4px';
            return (
              <div
                aria-hidden
                className="pointer-events-none fixed z-[var(--z-chrome)]"
                style={{
                  left: rect.left + canvasMinX * viewportZoom,
                  top: rect.top + canvasMinY * viewportZoom,
                  width: widthPx,
                  height: heightPx,
                }}
              >
                {usesSvg && pendingDraw.type === 'shape' ? (
                  <ShapeSvgOverlay
                    shape={pendingDraw.kind}
                    fill="rgba(14, 165, 233, 0.10)"
                    stroke="rgb(14, 165, 233)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    aspect={heightPx > 0 ? widthPx / heightPx : 1}
                  />
                ) : (
                  <div
                    className="h-full w-full border border-dashed border-brand-500 bg-brand-500/10"
                    style={{ borderRadius: radius }}
                  />
                )}
              </div>
            );
          })()
        : null}

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
