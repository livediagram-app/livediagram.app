import { canvasIsBusy } from '@liveworkspace/workbench/lib/tab-style-ease';
import type { View } from '@liveworkspace/workbench/lib/viewport-store';
import { CanvasFinishProvider } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { LongPressRing } from '@liveworkspace/workbench/components/primitives/LongPressRing';
import {
  useViewportOf,
  useViewportStore,
} from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { useDoubleTapZoom } from '@/hooks/canvas/useDoubleTapZoom';
import { useSmallElementDoubleTap } from '@liveworkspace/workbench/hooks/canvas/useSmallElementDoubleTap';
import { useRef, ViewTransition } from 'react';
import { useFocusCanvasOnMount } from '@liveworkspace/workbench/hooks/canvas/useFocusCanvasOnMount';
import { isAnimatedPattern } from '@livediagram/document';
import { canvasMainStyle } from './canvas-main-style';
import { canvasToolOverlays } from './canvas-tool-overlays';
import { useObservedSize } from '@liveworkspace/workbench/hooks/canvas/useObservedSize';
import { useNoCanvasTextSelection } from '@liveworkspace/workbench/hooks/canvas/useNoCanvasTextSelection';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@liveworkspace/workbench/hooks/canvas/useQuickRing';
import { useZoomControls } from '@liveworkspace/workbench/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasWorldLayer } from './CanvasWorldLayer';
import { canvasGestureNow } from '@/lib/canvas-gesture';
import { useCanvasLongTaskLog } from '@liveworkspace/workbench/hooks/canvas/useCanvasLongTaskLog';
import { useSelectionStore } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { withStableEventProps } from '@liveworkspace/workbench/components/primitives/withStableEventProps';
import { CanvasLiveRegion } from '@liveworkspace/workbench/components/canvas/CanvasLiveRegion';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { routeBoardDoubleClick } from '@/lib/whiteboard-edit-target';
import { useWhiteboardPenCursor } from '@/hooks/canvas/useWhiteboardPenCursor';
import { usePortalTravel } from '@/components/canvas/portal-travel';

import { useCanvasPointer } from './useCanvasPointer';
import { useCanvasDrawTools } from './useCanvasDrawTools';
import { useCanvasSelectionInput } from './useCanvasSelectionInput';

import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { TabLoadOverlay } from '@liveworkspace/workbench/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { PathEditToolbar } from '@/components/canvas/path/PathEditToolbar';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@liveworkspace/workbench/hooks/canvas/useCanvasSelectHandlers';
import { SLIDE_VIEW_TRANSITION_UPDATE } from './slide-transition';
import { useStickyPeelVars } from '@liveworkspace/workbench/lib/sticky-peel-image';

// The canvas boundary (docs/specs/008-canvas/canvas-performance.md "The canvas re-renders only for what it
// shows"): memoised, its `on…` props stable, so an editor render that changes nothing it shows stops here.
export const Canvas = withStableEventProps(CanvasView);

// The canvas is what shows the view (docs/specs/008-canvas/blueprints/viewport-store.md "Inside the
// canvas"): CanvasView subscribes to it; what it renders takes the view only where it shows it.
const wholeView = (v: View) => v;

function CanvasView(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabLayers,
    tabKind,
    tabBackgroundOpacity,
    tabBackgroundPatternScale,
    tabBackgroundAnimationSpeed,
    tabPatternColor,
    mainRef,
    isPinchingRef,
    setViewportOffset,
    setViewportZoom,
    elements,
    onSelectMarquee,
    canvasTool,
    onCanvasPointerMove,
    editingId,
    pendingDraw,
    onCommitDraw,
    onCommitFreehand,
    onCommitPolygon,
    onDeselect,
    onSelect,
    onCanvasContextMenu,
    onElementContextMenu,
    onMultiContextMenu,
    onShiftSelect,
    onCanvasDoubleClick,
    tabLoadState,
    onRetryTabLoad,
  } = props;
  const { zoom: viewportZoom, offset: viewportOffset } = useViewportOf(wholeView);
  // The zoom when a handler runs, for what is handed down and must keep its identity across zooms.
  const viewportStore = useViewportStore();

  const wrapperRef = useRef<HTMLDivElement>(null);
  // A whiteboard pen's own cursor, as chosen in the dock's More flyout.
  const penCursorValue = useWhiteboardPenCursor(
    pendingDraw,
    props.whiteboardDock?.prefs.cursor,
    viewportZoom,
  );

  // Paint mode is the Format canvas tool: it reads as paint mode from its
  // first click (copy cursor, handles/label-drag/dblclick suppressed on boxed
  // elements AND arrows), not only once a source is armed.
  const isPaintMode = canvasTool === 'format';
  // Nudge above the Fit button when everything on the canvas has scrolled out of view.
  // Long tasks, with the gesture they fell in, while the canvas-perf debug scope is on
  // (docs/specs/008-canvas/canvas-performance.md "Observability").
  useCanvasLongTaskLog(canvasGestureNow);
  const offscreenContent = useOffscreenContent(elements, viewportOffset, viewportZoom, mainRef);
  // The canvas's size, for the pattern's zoom centre (worldPatternOrigin).
  const mainSize = useObservedSize(mainRef) ?? { width: 0, height: 0 };
  // No text selection starts on the canvas (docs/specs/008-canvas/canvas-performance.md "A press on the canvas
  // selects no text").
  useNoCanvasTextSelection(mainRef);

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Which quick-connect ring (if any) is open. Self-contained state + reset /
  // outside-close effects live in useQuickRing.
  // The selection lives in the store (docs/specs/008-canvas/blueprints/selection-store.md): the canvas
  // reads it when a handler runs and subscribes only to the narrow slices it draws.
  const selectionStore = useSelectionStore();
  const [quickRingOpen, setQuickRingOpen] = useQuickRing(selectionStore);
  // Which panel is open as a popover off its button (the Toolbar Explorer,
  // the cluster popovers). See useDockPopovers; the popover anchor math is
  // the tested computeDockAnchor.
  const {
    activeDockPanel,
    setActiveDockPanel,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  } = useDockPopovers(mainRef);

  // Pan + marquee + held-Space machinery lives in
  // useCanvasPanAndMarquee. The hook owns the pointerdown / move
  // / up listeners and the rect-vs-element marquee intersection,
  // exposes pan / marquee state + setters back so the canvas's
  // own pointerdown handlers can drive it, and exposes the
  // spaceHeldRef the pointerdown reads to decide pan vs marquee (and
  // spaceHeld, its state twin, for the cursor).
  const { pan, setPan, marquee, marqueeStore, setMarquee, spaceHeldRef, spaceHeld } =
    useCanvasPanAndMarquee({
      viewportZoom,
      setViewportOffset,
      elements,
      wrapperRef,
      onDeselect,
      onSelectMarquee,
      onShiftSelect,
      currentSelection: () => {
        const { selectedId, multiSelectedIds } = selectionStore.get();
        return new Set([...multiSelectedIds, ...(selectedId ? [selectedId] : [])]);
      },
      isPinchingRef,
    });

  // Palette drag-drop onto the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    onDropPhoto: props.onDropPhoto,
    onDropFile: props.onDropFile,
    onDropLibraryShape: props.onDropLibraryShape,
    onDropPalette: props.onDropPalette,
    viewportZoom,
    wrapperRef,
  });

  const {
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    setZoomTo: handleSetZoom,
  } = useZoomControls(setViewportZoom);

  // Every arrow label, laid out once per element change, and what the selection chrome derives from
  // (useCanvasSelectionInput).
  const { hasArrows, arrowLabels, selectionInput, soleSelectedPathId } = useCanvasSelectionInput({
    elements,
    editingId,
    isPaintMode,
    tabLocked,
    readOnly,
    tabKind,
    tabLayers,
    tabFont: props.tabFont,
    tabFinish: props.tabFinish,
    elementMenuOpen: props.elementMenuOpen,
  });

  const { spotlightLook, spotlight, eraserPos, handlePointerMoveCanvas, handlePointerLeaveCanvas } =
    useCanvasPointer({ canvasTool, mainRef, onCanvasPointerMove, wrapperRef, viewportZoom });

  // Portals (docs/specs/009-elements/portal-element.md): the camera centres on the paired portal, on this tab or
  // another; Canvas owns the viewport, so travel is resolved here.
  const { resolvePortal } = usePortalTravel({
    elements,
    tabs: props.portalTabs,
    activeTabId: props.activeTabId,
    onFollowLink: props.onFollowLink,
    mainRef,
    setViewportOffset,
  });

  // Isometric view (docs/specs/008-canvas/isometric-view.md): the orbit-able camera + the innermost
  // transform fragment, pivoted on the content centre — see
  // useIsometricView. Shift-drag on the canvas spins / tilts it (see
  // the <main> pointerdown handler).
  const { isoCamera, isoFragment } = useIsometricView({ canvasTool, elements, mainRef });

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld,
    isPaintMode,
  });

  // Stable selection-routing wrappers for the memo'd element / arrow
  // views — see useCanvasSelectHandlers.
  const { handleElementContextSelect, handleArrowSelect, handleElementClick } =
    useCanvasSelectHandlers({
      inertIds: props.layerInertIds,
      isPaintMode,
      readSelection: selectionStore.get,
      onSelect,
      onDeselect,
      onShiftSelect,
      onElementContextMenu,
      onMultiContextMenu,
    });

  const {
    stamp,
    drawDrag,
    penPoints,
    penStroke,
    drawHover,
    polygonVertices,
    polygonCursor,
    handlePolygonDoubleClick,
    pathTool,
    beginPendingDrawOrPolygon,
  } = useCanvasDrawTools({
    props,
    pendingDraw,
    elements,
    canvasTool,
    viewportZoom,
    wrapperRef,
    isPinchingRef,
    onCommitDraw,
    onCommitFreehand,
    onCommitPolygon,
    editingId,
    soleSelectedPathId,
    onDeselect,
  });

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const doubleTap = useDoubleTapZoom(mainRef, viewportStore, { id: props.activeTabId, elements });
  const smallElementTap = useSmallElementDoubleTap(doubleTap.onElement);
  const stickyPeel = useStickyPeelVars();
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    middleMousePan: props.settings?.middleMousePan !== false,
    pendingDraw,
    whiteboard: props.whiteboardDock !== undefined,
    viewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan,
    setMarquee,
    spotlight,
    isoCamera,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    interceptPress: (e) => pathTool.beginEditPress(e),
    onEraseStart: props.onEraseStart,
    onCanvasContextMenu,
    onDeselect,
    // On a whiteboard a double-click inside a shape edits it (lib/whiteboard-edit-target). On the bare board a
    // finger's double-tap zooms in on the spot, a mouse's double-click drops text
    // (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom").
    onCanvasDoubleClick: (x, y, byFinger) =>
      routeBoardDoubleClick(
        {
          whiteboard: props.editorMode === 'draw',
          elements,
          layers: tabLayers,
          inertIds: props.layerInertIds,
        },
        { x, y },
        {
          edit: props.onBeginEdit,
          board: byFinger ? (bx, by) => doubleTap.onCanvas({ x: bx, y: by }) : onCanvasDoubleClick,
        },
      ),
  });

  // Focus the canvas on mount, so a paste works before the first click (useFocusCanvasOnMount).
  useFocusCanvasOnMount(mainRef);
  return (
    // This canvas's tab's finish (docs/specs/008-canvas/finish.md), over the editor's active tab's.
    <CanvasFinishProvider finish={props.tabFinish}>
      {/* A slide move animates the surface as a View Transition typed by its direction (slide-transition.ts);
            nothing else animates it. */}
      <ViewTransition default="none" update={SLIDE_VIEW_TRANSITION_UPDATE}>
        <main
          ref={mainRef}
          // In the tab order (docs/specs/004-interface-design/canvas-accessibility.md): keyboard users Tab to the canvas as
          // one stop, then Tab / Shift+Tab walk the elements (useCanvasA11y,
          // engaged only while this surface itself is focused — the marker
          // attribute below is how the hook recognises it). The role stays
          // the main landmark (not "application") because the floating
          // panels render inside it and must keep normal SR navigation.
          tabIndex={0}
          aria-label="Canvas"
          data-region="canvas"
          data-canvas-a11y-root=""
          onPointerMove={handlePointerMoveCanvas}
          onPointerLeave={handlePointerLeaveCanvas}
          onDragOver={paletteDrop.onDragOver}
          onDrop={paletteDrop.onDrop}
          onPointerDownCapture={(e) => {
            surface.onPointerDownCapture(e);
            if (!e.isPropagationStopped()) smallElementTap.onPointerDownCapture(e);
          }}
          // A dark backdrop deepens the sticky paper-peel (docs/specs/008-canvas/canvas-and-palette.md): the shadow
          // ink is tuned for light paper and vanishes on a dark wall. Flagged
          // here so the peel's CSS can respond without knowing about themes.
          data-dark-canvas={isDarkCanvas(tabBackgroundColor) ? '' : undefined}
          // The Tab Style colour ease scopes to the canvas (@liveworkspace/workbench/lib/tab-style-ease.ts); on a busy
          // canvas it eases this surface alone, the parts snapping (canvasIsBusy).
          data-canvas-root=""
          data-canvas-busy={canvasIsBusy(elements.length) ? '' : undefined}
          onContextMenuCapture={surface.onContextMenuCapture}
          onContextMenu={surface.onContextMenu}
          onPointerUp={surface.onContextMenuPointerUp}
          onPointerDown={surface.onPointerDown}
          onDoubleClick={(e) => {
            if (e.target !== e.currentTarget) return;
            if (handlePolygonDoubleClick() || pathTool.handlePathDoubleClick()) return;
            surface.onSurfaceDoubleClick(e);
          }}
          // A finger's double-tap on an element too small to work on frames it before it edits (useSmallElementDoubleTap).
          onDoubleClickCapture={smallElementTap.onDoubleClickCapture}
          // focus-visible ring only: pointer focus stays outline-free, but a
          // keyboard user Tabbing to the canvas sees where they landed.
          // overflow-clip, not overflow-hidden: a hidden box still scrolls (focus revealing a label
          // editor past the bottom edge, a scrollIntoView), and the corner chrome positioned in it (the
          // bottom-right cluster, the Map) rode up the screen by every scroll and stayed there. A
          // clipped box clips the same and can never scroll (docs/specs/008-canvas/canvas-and-palette.md).
          className={`relative flex-1 touch-none select-none overflow-clip outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
            pendingDraw ? '' : cursorClass
          }`}
          style={canvasMainStyle({
            tabBackgroundPattern,
            tabBackgroundColor,
            tabPatternColor,
            tabBackgroundOpacity,
            tabBackgroundPatternScale,
            stickyPeel,
            viewportOffset,
            viewportZoom,
            mainSize,
            pendingDraw,
            penCursorValue,
            pathCursor: pathTool.cursor,
          })}
        >
          {/* SR-only polite live region (docs/specs/004-interface-design/canvas-accessibility.md): selection / delete / undo
          announcements land here. */}
          <CanvasLiveRegion />
          {/* Animated backdrops (docs/specs/008-canvas/canvas-and-palette.md) paint as an ambient overlay behind the
          canvas content; the static patterns ride the <main> background
          above. tabBackgroundStyle returns just the backdrop colour for
          these, so this layer is the only thing that draws their motion. */}
          {isAnimatedPattern(tabBackgroundPattern) ? (
            <AnimatedCanvasBackground
              variant={tabBackgroundPattern}
              color={tabPatternColor}
              scale={tabBackgroundPatternScale}
              speed={tabBackgroundAnimationSpeed}
              opacity={tabBackgroundOpacity}
            />
          ) : null}
          <CanvasWorldLayer
            props={props}
            wrapperRef={wrapperRef}
            surface={surface}
            handlePolygonDoubleClick={handlePolygonDoubleClick}
            pathTool={pathTool}
            penStroke={penStroke}
            resolvePortal={resolvePortal}
            cursorClass={cursorClass}
            penCursorValue={penCursorValue}
            viewportZoom={viewportZoom}
            viewportOffset={viewportOffset}
            isoFragment={isoFragment}
            isoAngles={{ azimuth: isoCamera.azimuth, elevation: isoCamera.elevation }}
            hasArrows={hasArrows}
            arrowLabels={arrowLabels}
            selectionInput={selectionInput}
            isPaintMode={isPaintMode}
            handleArrowSelect={handleArrowSelect}
            handleElementClick={handleElementClick}
            handleElementContextSelect={handleElementContextSelect}
            quickRingOpen={quickRingOpen}
            setQuickRingOpen={setQuickRingOpen}
            drawDrag={drawDrag}
          />

          {canvasToolOverlays({
            canvasTool,
            eraserPos,
            spotlight,
            spotlightLook,
            whiteboardDock: props.whiteboardDock,
            eraserConfig: props.eraserConfig,
          })}

          <CanvasSelectionToolbars
            props={props}
            selectionInput={selectionInput}
            quickRingOpen={quickRingOpen !== null}
          />
          {pathTool.toolbar ? (
            <PathEditToolbar
              {...pathTool.toolbar}
              viewportOffset={viewportOffset}
              zoom={viewportZoom}
            />
          ) : null}

          <CanvasChrome
            {...props}
            // While a path is being drawn, Undo and Redo (the dock's and the corner's) step through its
            // nodes, not the board (docs/specs/023-draw-mode/path-tool.md "Drawing").
            {...(pathTool.history
              ? {
                  canUndo: pathTool.history.canUndo,
                  canRedo: pathTool.history.canRedo,
                  onUndo: pathTool.history.undo,
                  onRedo: pathTool.history.redo,
                }
              : null)}
            mainSize={mainSize}
            laserConfig={props.laserConfig}
            onChangeLaserField={props.onChangeLaserField}
            spotlightConfig={spotlightLook.config}
            onChangeSpotlightField={spotlightLook.setField}
            spotlightRadius={spotlight.radius}
            onSetSpotlightRadius={spotlight.setRadius}
            spotlightPanelPosition={props.spotlightPanelPosition}
            onMoveSpotlightPanel={props.onMoveSpotlightPanel}
            onResetSpotlightPanel={props.onResetSpotlightPanel}
            eraserConfig={props.eraserConfig}
            onChangeEraserField={props.onChangeEraserField}
            formatConfig={props.formatConfig}
            onToggleFormatGroup={props.onToggleFormatGroup}
            onSetFormatMode={props.onSetFormatMode}
            formatBrushSource={props.formatBrushSource}
            formatPanelPosition={props.formatPanelPosition}
            onMoveFormatPanel={props.onMoveFormatPanel}
            onResetFormatPanel={props.onResetFormatPanel}
            eraserPanelPosition={props.eraserPanelPosition}
            onMoveEraserPanel={props.onMoveEraserPanel}
            onResetEraserPanel={props.onResetEraserPanel}
            laserPanelPosition={props.laserPanelPosition}
            onMoveLaserPanel={props.onMoveLaserPanel}
            onResetLaserPanel={props.onResetLaserPanel}
            offscreenContent={offscreenContent}
            marquee={marqueeStore}
            drawDrag={drawDrag}
            drawHover={drawHover}
            stamp={stamp}
            // Off a whiteboard, a marker's live stroke guides off its box as the pencil's does.
            penPoints={
              penPoints ??
              (penStroke && props.editorMode !== 'draw' ? penStroke.points.slice() : null)
            }
            polygonVertices={polygonVertices}
            polygonCursor={polygonCursor}
            wrapperRef={wrapperRef}
            activeDockPanel={activeDockPanel}
            setActiveDockPanel={setActiveDockPanel}
            activeDockAnchor={activeDockAnchor}
            setActiveDockAnchor={setActiveDockAnchor}
            handleDockButtonClick={handleDockButtonClick}
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleSetZoom={handleSetZoom}
            onIsoOrbit={isoCamera.startOrbit}
            onIsoReset={isoCamera.reset}
          />
          {/* Lazy per-tab load (docs/specs/006-document/per-tab-storage.md). Last child + z-[var(--z-overlay)] so it covers the
          canvas AND the floating palette, blocking any edit that would
          otherwise overwrite an unfetched tab's real content. */}
          {tabLoadState && tabLoadState !== 'ready' ? (
            <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
          ) : null}
          {/* Drag-to-add ghost (docs/specs/010-palette/palette-drag-ghost.md): previews where a dragged palette shape
          will land, following the cursor over the canvas. */}
          <PaletteDragGhost zoom={viewportZoom} />
          {/* Map (docs/specs/008-canvas/minimap.md) now renders inside CanvasChrome's docking layer
          (docs/specs/007-editor/panel-docking.md) so it snaps + stacks like the other floating panels. */}
          {/* Touch long-press "hold" ring at the finger: the docs/specs/008-canvas/canvas-and-palette.md
            press-and-hold affordance that opens the context menu on touch. */}
          <LongPressRing point={surface.canvasLongPress.pressPoint} />
        </main>
      </ViewTransition>
    </CanvasFinishProvider>
  );
}
