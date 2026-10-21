import dynamic from 'next/dynamic';
import type { View } from '@/lib/viewport-store';
import { CanvasMenu } from './canvas-menu-context';
import { CanvasFinishProvider } from './CanvasFinishContext';
import { LongPressRing } from '@/components/primitives/LongPressRing';
import { useViewportOf, useViewportStore } from '@/hooks/canvas/useViewportStore';
import { useDoubleTapZoom } from '@/hooks/canvas/useDoubleTapZoom';
import { useSmallElementDoubleTap } from '@/hooks/canvas/useSmallElementDoubleTap';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isAnimatedPattern } from '@liveplanner/document';
import { tabBackgroundStyle, worldPatternOrigin } from '@/lib/canvas-backgrounds';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { drawIntentCursor, isWhiteboardPenIntent } from '@/lib/draw-mode';
import { WhiteboardPenPreview } from '@/components/canvas/whiteboard/WhiteboardPenPreview';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@/hooks/canvas/useQuickRing';
import { useZoomControls } from '@/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { isEventStormingTab } from '@liveplanner/document';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { PageImageAccessProvider } from '@/components/canvas/page-image-access';
import { CanvasZoomProvider } from '@/components/canvas/CanvasZoomContext';
import { useCanvasLongTaskLog } from '@/hooks/canvas/useCanvasLongTaskLog';
import { useSelectionOf, useSelectionStore } from '@/hooks/canvas/useSelectionStore';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import type { Selection } from '@/lib/selection-store';
import { withStableEventProps } from '@/components/primitives/withStableEventProps';
import { MindGrowProvider } from '@/components/canvas/MindGrowContext';
import { MindOutlineProvider, useMindOutlineBadges } from '@/components/canvas/MindOutlineContext';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@/lib/element-indicator-style';
import { CanvasStillProvider } from '@/components/canvas/CanvasStillContext';
import { CanvasArrivalProvider } from '@/components/canvas/CanvasArrivalContext';
import { CanvasLiveRegion } from '@/components/canvas/CanvasLiveRegion';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { EraserBrushRing } from '@/components/canvas/EraserBrushRing';
import { DEFAULT_ERASER_CONFIG, eraserRadius } from '@/lib/eraser-config';
import { WHITEBOARD_ERASER_RADIUS_PX } from '@/lib/whiteboard-tool';
import { routeBoardDoubleClick } from '@/lib/whiteboard-edit-target';
import { useWhiteboardPenCursor } from '@/hooks/canvas/useWhiteboardPenCursor';
import { useCanvasPointer } from './useCanvasPointer';
import { articlePlusBlocked } from '@/lib/article-plus-blocked';
import { useCanvasDrawTools } from './useCanvasDrawTools';
import { usePortalTravel } from './portal-travel';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { PathDraftLayer } from '@/components/canvas/path/PathDraftLayer';
import { LogoCanvasOverlays } from '@/components/canvas/LogoCanvasOverlays';
import { PathEditLayer } from '@/components/canvas/path/PathEditLayer';
import { PathEditToolbar } from '@/components/canvas/path/PathEditToolbar';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@/hooks/canvas/useCanvasSelectHandlers';
import { useArrowLabelLayouts } from '@/hooks/canvas/useArrowLabelLayouts';
import { useFontEpoch } from '@/components/canvas/useFontEpoch';
import { loadArticleFlows, loadCanvasPages } from '@/lib/editor-deferred-code';
import { GifOmit } from './GifOmit';
import { useStickyPeelVars } from '@/lib/sticky-peel-image';

// Pages mode's pages and their writing draw only on a tab that has pages, so their code loads on demand
// (lib/editor-deferred-code.ts fetches it as the editor mounts).
const CanvasPages = dynamic(loadCanvasPages, { ssr: false });
const ArticleFlows = dynamic(loadArticleFlows, { ssr: false });

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
  const readZoom = useCallback(() => viewportStore.get().zoom, [viewportStore]);

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
  useCanvasLongTaskLog();
  const offscreenContent = useOffscreenContent(
    elements,
    viewportOffset,
    viewportZoom,
    mainRef,
    props.pagesMode?.pages,
  );
  // The canvas's size, for the pattern's zoom centre (worldPatternOrigin).
  const mainSize = useObservedSize(mainRef) ?? { width: 0, height: 0 };

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
  const { pan, setPan, marquee, setMarquee, spaceHeldRef, spaceHeld } = useCanvasPanAndMarquee({
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

  // "Are there any arrows" decides whether to mount the ArrowDefs and lay out
  // labels. `some` short-circuits on the first arrow, so the typical render
  // pays O(1).
  const hasArrows = elements.some((el) => el.type === 'arrow');
  // Every arrow label laid out once per element change, avoiding each other
  // (docs/specs/008-canvas/arrow-labels.md). Laid out here, not in the element
  // layer, because the selection toolbars clear a label as part of its arrow.
  const fontEpoch = useFontEpoch();
  const arrowLabels = useArrowLabelLayouts(
    elements,
    hasArrows,
    props.tabFont,
    fontEpoch,
    undefined,
    props.tabFinish,
  );

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because it walks the elements. The chrome that derives it lays a drag in
  // progress over these elements itself (useCanvasSelectionView), so a preview frame renders the
  // chrome and not this canvas (docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved").
  // An object in an article's writing (a chart, an image, a table) connects to nothing: no
  // quick-connect pluses on it (docs/specs/007-editor/article-pages.md "Zones"). A predicate the
  // selection derivation applies, so the canvas itself still doesn't read the selection.
  const articlePages = props.pagesMode?.pages;
  const plusBlocked = useMemo(
    () => articlePlusBlocked(articlePages, elements),
    [articlePages, elements],
  );
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      esBoard: isEventStormingTab({ kind: tabKind, layers: tabLayers }),
      elementMenuOpen: props.elementMenuOpen === true,
      labelRectOf: arrowLabels.labelRectOf,
      plusBlocked,
    }),
    [
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      tabLayers,
      tabKind,
      props.elementMenuOpen,
      arrowLabels,
      plusBlocked,
    ],
  );
  // The one selected element when it is a path: the path tool's edit gesture arms on it.
  const soleSelectedPathId = useSelectionOf(
    useCallback(
      (s: Selection) =>
        s.multiSelectedIds.size === 0 &&
        s.selectedId !== null &&
        elements.some((el) => el.id === s.selectedId && el.type === 'path')
          ? s.selectedId
          : null,
      [elements],
    ),
  );

  const { eraserPos, handlePointerMoveCanvas, handlePointerLeaveCanvas } = useCanvasPointer({
    canvasTool,
    mainRef,
    onCanvasPointerMove,
    wrapperRef,
    viewportZoom,
  });

  // Portals (docs/specs/009-elements/portal-element.md): the camera centres on the paired portal — see
  // usePortalTravel.
  const { resolvePortal } = usePortalTravel({
    elements,
    tabs: props.portalTabs,
    activeTabId: props.activeTabId,
    onFollowLink: props.onFollowLink,
    mainRef,
    readZoom,
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
    formatPagePress,
    offPage,
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
    isoCamera,
    beginPendingDrawGesture: beginPendingDrawOrPolygon,
    interceptPress: (e) => formatPagePress(e) || pathTool.beginEditPress(e),
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

  // Auto-focus the canvas surface on mount so clipboard paste works
  // before the user has clicked anywhere. The browser only dispatches
  // `paste` events on a focusable element; <main> has tabIndex=-1 to
  // be a valid focus target, but it doesn't grab focus by itself.
  // Without this, a freshly-loaded editor swallows Cmd/Ctrl+V silently
  // until the first canvas click. preventScroll keeps the viewport
  // from jumping if the page was scrolled at load time.
  useEffect(() => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  }, [mainRef]);
  // Mind map (docs/specs/009-elements/mind-node.md): the growers the label editor and the "+" reach.
  const { onGrowMindNode, onAbandonMindNode } = props;
  const mindGrow = useMemo(
    () => ({ grow: onGrowMindNode, abandon: onAbandonMindNode }),
    [onGrowMindNode, onAbandonMindNode],
  );
  // The Edit Outline badge on each map root (MindOutlineContext).
  const mindOutlineBadges = useMindOutlineBadges(
    elements,
    props.canEditMindOutline,
    props.onEditMindOutline,
    props.onTidyMindMap,
  );
  return (
    // This canvas's tab's finish (docs/specs/008-canvas/finish.md), over the editor's active tab's.
    <CanvasFinishProvider finish={props.tabFinish}>
      <CanvasMenu.Provider value={onCanvasContextMenu ?? null}>
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
            // The Tab Style colour ease scopes to the canvas (lib/tab-style-ease.ts).
            data-canvas-root=""
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
            style={{
              // The paper hollow arrowheads fill with (arrow-defs.tsx).
              ['--lvd-canvas-paper' as string]: tabBackgroundColor,
              // The sticky notes' paper peel, as a picture (sticky-peel-image.ts).
              ...stickyPeel,
              // In world space: the pattern pans and zooms with the elements, so
              // they stay on the same dots at any zoom (worldPatternOrigin).
              ...tabBackgroundStyle(
                tabBackgroundPattern,
                worldPatternOrigin(viewportOffset, viewportZoom, {
                  w: mainSize.width,
                  h: mainSize.height,
                }),
                tabBackgroundColor,
                tabPatternColor,
                tabBackgroundOpacity,
                tabBackgroundPatternScale * viewportZoom,
              ),
              // Mirror the inner-wrapper cursor on <main>. The inner div is
              // `absolute inset-0` but its CSS transform scales it (zoom),
              // so when zoom is below 1 the hit area shrinks and the
              // surrounding "letterbox" gap falls through to <main>. Without
              // setting cursor here too, the user would see the OS default
              // arrow in that gap while a draw-to-size intent is pending.
              ...(pendingDraw ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) } : null),
              ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
            }}
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
            <div
              ref={wrapperRef}
              // The pages and elements, as against the chrome over them (useLogoPaletteSwitch).
              data-canvas-content=""
              onPointerDown={surface.onWrapperPointerDown}
              onDoubleClick={(e) => {
                // Polygon finish-line double-click (docs/specs/008-canvas/polygon-tool.md) wins over the
                // add-text double-click while the intent is armed.
                if (handlePolygonDoubleClick() || pathTool.handlePathDoubleClick()) return;
                // Off a page nothing is made, but a finger's double-tap still zooms there.
                if (offPage(e) && !surface.pressedByFinger()) return;
                surface.onWrapperDoubleClick(e);
              }}
              // Isometric view (docs/specs/008-canvas/isometric-view.md): the layer goes pointer-events-none so NO
              // element kind can be selected / dragged (a per-element capture guard can't catch every select path
              // — boxed elements, arrow hit-bands, labels, click vs pointerdown) — it's a read-only view tool.
              // Clicks fall through to <main>, where a drag pans (canvasTool === 'isometric' is added to
              // `wantsPan`).
              className={`absolute inset-0 origin-center touch-none ${
                canvasTool === 'isometric' ? 'pointer-events-none' : ''
              } ${pendingDraw ? '' : cursorClass}`}
              // Scopes the [data-iso] CSS (globals.css): frames settle just under
              // the base plane while the camera orbits so they can't z-fight
              // (flicker) with the coplanar contents above them.
              data-iso={canvasTool === 'isometric' ? '' : undefined}
              // A whiteboard pen draws wherever it presses, so nothing under it swaps
              // the pen cursor for its own (globals.css, docs/specs/023-draw-mode/draw-mode.md "Pens").
              data-pen-in-hand={
                (pendingDraw?.type === 'freehand' && pendingDraw.variant === 'whiteboard') ||
                pendingDraw?.type === 'path'
                  ? ''
                  : undefined
              }
              data-path-cursor={pathTool.cursor ? '' : undefined}
              style={{
                // Translate is in canvas-coords (applied first); scale is centred
                // on the wrapper so zooming keeps the viewport centre stable.
                // Isometric tilt (docs/specs/008-canvas/isometric-view.md) is appended INNERMOST (last in the list,
                // so it transforms the content first): that keeps the pan translate
                // in screen space, so a drag moves the scene the way the cursor
                // moves at any camera angle. The fragment (built above as
                // isoFragment) pivots the tilt around the content centre so the
                // canvas tilts in place / stays centred while orbiting rather than
                // swinging off-screen. preserve-3d lets the depth layer's
                // translateZ stack read as real extruded height.
                transform: `scale(${viewportZoom}) translate(${viewportOffset.x}px, ${viewportOffset.y}px)${isoFragment}`,
                ...(canvasTool === 'isometric' ? { transformStyle: 'preserve-3d' as const } : null),
                // Draw-mode cursor: every intent gets a custom inline-SVG
                // cursor (crosshair at the pointer tip plus a small glyph
                // hinting at what's about to land). Without this, tool
                // intents inherited the default arrow cursor because the
                // wrapper drops its Tailwind cursor- class above when
                // pendingDraw is set, leaving no cursor specified at all.
                ...(pendingDraw
                  ? { cursor: penCursorValue ?? drawIntentCursor(pendingDraw) }
                  : null),
                // A path in its edit mode says what a press would do (usePathTool).
                ...(pathTool.cursor ? { cursor: pathTool.cursor } : null),
              }}
            >
              {/* Isometric extrusion (docs/specs/008-canvas/isometric-view.md): per-element raised blocks painted
            behind the real element layer, which caps each column at z=0.
            Only mounted while the tool is active. */}
              {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
              {/* Pages mode's A4 pages, under every element (CanvasPages). */}
              {props.pagesMode ? (
                // The image store's access, for the pages' pictures (page-image-access).
                <PageImageAccessProvider access={props.imageContext}>
                  <CanvasPages
                    // Its page state (the palette's pages seen, an open panel, hidden layout cards) is the
                    // tab's own: page ids repeat across tabs.
                    key={props.activeTabId}
                    view={props.pagesMode}
                    zoom={viewportZoom}
                    // Zen and the isometric view show the sheets alone: no labels, cogs,
                    // layout invites or add button.
                    bare={props.zenMode === true || canvasTool === 'isometric'}
                    placing={!!pendingDraw}
                    onOpenTheme={props.onOpenCanvasTheme}
                  />
                </PageImageAccessProvider>
              ) : null}
              {/* Article pages' writing (ArticleFlows), over the sheets and under the elements, so a
            zone's elements sit in the room the writing leaves them. */}
              {props.pagesMode?.articles && canvasTool !== 'isometric' ? (
                <ArticleFlows
                  view={props.pagesMode}
                  zoom={viewportZoom}
                  interactive={!pendingDraw}
                  elements={elements}
                />
              ) : null}
              <CanvasStillProvider still={props.editorMode === 'draw'}>
                <CanvasArrivalProvider
                  tabId={props.activeTabId ?? ''}
                  loaded={props.activeTabLoaded ?? true}
                >
                  {/* The zoom reaches only the counter-scaled parts of each element
              (docs/specs/008-canvas/canvas-performance.md). */}
                  <CanvasZoomProvider zoom={viewportZoom}>
                    <MindGrowProvider value={mindGrow}>
                      <MindOutlineProvider value={mindOutlineBadges}>
                        <ElementIndicatorStyleProvider
                          style={readElementIndicatorStyle(props.settings)}
                        >
                          <CanvasElementsLayer
                            {...props}
                            elements={pathTool.elements}
                            // Portal travel is resolved HERE (Canvas owns the viewport), so the prop
                            // from the host is overridden with the local resolver.
                            onEnterPortal={resolvePortal}
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
                        </ElementIndicatorStyleProvider>
                      </MindOutlineProvider>
                    </MindGrowProvider>
                  </CanvasZoomProvider>
                </CanvasArrivalProvider>
              </CanvasStillProvider>
              {/* Drafts and the logo page's guides: editor-only, left out of an animated GIF
            (GifOmit). */}
              <GifOmit>
                {/* The whiteboard pen's stroke being drawn (docs/specs/023-draw-mode/draw-mode.md "Pens"):
            in this transformed layer, after the elements, laid out as the stroke it lands as, so
            the same layer rasterises both and release changes no pixel. */}
                {penStroke && isWhiteboardPenIntent(pendingDraw) ? (
                  <WhiteboardPenPreview
                    stroke={penStroke}
                    pen={pendingDraw}
                    ink={props.whiteboardInk ?? 'currentColor'}
                    zoom={viewportZoom}
                  />
                ) : null}
                {/* The path being drawn (docs/specs/023-draw-mode/path-tool.md), in the same layer. */}
                {pathTool.draftView ? <PathDraftLayer {...pathTool.draftView} /> : null}
                {/* A logo page's guides, its snap points and Mirror's live twins (LogoCanvasOverlays). */}
                {props.pagesMode ? (
                  <LogoCanvasOverlays
                    view={props.pagesMode}
                    bare={props.zenMode === true || canvasTool === 'isometric'}
                    pendingDraw={pendingDraw}
                    penStroke={penStroke}
                    pathDraft={pathTool.draftView}
                    ink={props.whiteboardInk ?? 'currentColor'}
                    wrapperRef={wrapperRef}
                    zoom={viewportZoom}
                  />
                ) : null}
                {pathTool.editView ? <PathEditLayer {...pathTool.editView} /> : null}
              </GifOmit>
            </div>

            {/* The eraser's brush ring (docs/specs/008-canvas/eraser-panel.md): a screen-space sibling of the
          transformed wrapper — it must not pan or zoom with the canvas, and it must never take a pointer event.
          Rendered before CanvasChrome so the palette + chrome paint ON TOP. */}
            {canvasTool === 'eraser' ? (
              <EraserBrushRing
                pos={eraserPos}
                // A whiteboard's brush is fixed per mode (docs/specs/023-draw-mode/draw-mode.md "Eraser").
                radius={
                  props.whiteboardDock
                    ? WHITEBOARD_ERASER_RADIUS_PX[props.whiteboardDock.prefs.eraserMode]
                    : eraserRadius(props.eraserConfig ?? DEFAULT_ERASER_CONFIG)
                }
                filtered={
                  !props.whiteboardDock &&
                  (props.eraserConfig ?? DEFAULT_ERASER_CONFIG).target !== 'anything'
                }
              />
            ) : null}

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
              offscreenContent={offscreenContent}
              marquee={marquee}
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
      </CanvasMenu.Provider>
    </CanvasFinishProvider>
  );
}
