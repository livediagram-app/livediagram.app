import type { View } from '@/lib/viewport-store';
import { CanvasMenu } from './canvas-menu-context';
import { CanvasFinishProvider } from './CanvasFinishContext';
import { LongPressRing } from '@/components/primitives/LongPressRing';
import { useViewportOf, useViewportStore } from '@/hooks/canvas/useViewportStore';
import { useDoubleTapZoom } from '@/hooks/canvas/useDoubleTapZoom';
import { useSmallElementDoubleTap } from '@/hooks/canvas/useSmallElementDoubleTap';
import { useEffect, useMemo, useRef } from 'react';
import { isAnimatedPattern } from '@liveplanner/project';
import { tabBackgroundStyle, worldPatternOrigin } from '@/lib/canvas-backgrounds';
import { useObservedSize } from '@/hooks/canvas/useObservedSize';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useDockPopovers } from '@/hooks/canvas/useDockPopovers';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@/hooks/canvas/useQuickRing';
import { useZoomControls } from '@/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { isDarkCanvas } from '@/lib/dark-canvas';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { CanvasZoomProvider } from '@/components/canvas/CanvasZoomContext';
import { useCanvasLongTaskLog } from '@/hooks/canvas/useCanvasLongTaskLog';
import { useSelectionStore } from '@/hooks/canvas/useSelectionStore';
import type { CanvasSelectionInput } from '@/hooks/canvas/useCanvasSelectionView';
import { withStableEventProps } from '@/components/primitives/withStableEventProps';
import { MindGrowProvider } from '@/components/canvas/MindGrowContext';
import { MindOutlineProvider, useMindOutlineBadges } from '@/components/canvas/MindOutlineContext';
import { ElementIndicatorStyleProvider } from '@/components/canvas/ElementIndicatorStyleContext';
import { readElementIndicatorStyle } from '@/lib/element-indicator-style';
import { CanvasArrivalProvider } from '@/components/canvas/CanvasArrivalContext';
import { CanvasLiveRegion } from '@/components/canvas/CanvasLiveRegion';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { useCanvasPointer } from './useCanvasPointer';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@/hooks/canvas/useCanvasSelectHandlers';
import { useArrowLabelLayouts } from '@/hooks/canvas/useArrowLabelLayouts';
import { useFontEpoch } from '@/components/canvas/useFontEpoch';
import { useStickyPeelVars } from '@/lib/sticky-peel-image';

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
  const viewportStore = useViewportStore();

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Paint mode is the Format canvas tool: it reads as paint mode from its
  // first click (copy cursor, handles/label-drag/dblclick suppressed on boxed
  // elements AND arrows), not only once a source is armed.
  const isPaintMode = canvasTool === 'format';
  // Nudge above the Fit button when everything on the canvas has scrolled out of view.
  // Long tasks, with the gesture they fell in, while the canvas-perf debug scope is on
  // (docs/specs/008-canvas/canvas-performance.md "Observability").
  useCanvasLongTaskLog();
  const offscreenContent = useOffscreenContent(elements, viewportOffset, viewportZoom, mainRef);
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
    isPinchingRef,
  });

  // A file dropped on the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    onDropFile: props.onDropFile,
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
  const selectionInput = useMemo<CanvasSelectionInput>(
    () => ({
      elements,
      editingId,
      isPaintMode,
      tabLocked,
      readOnly,
      elementMenuOpen: props.elementMenuOpen === true,
      labelRectOf: arrowLabels.labelRectOf,
    }),
    [elements, editingId, isPaintMode, tabLocked, readOnly, props.elementMenuOpen, arrowLabels],
  );
  const { handlePointerMoveCanvas, handlePointerLeaveCanvas } = useCanvasPointer({
    onCanvasPointerMove,
    wrapperRef,
    viewportZoom,
  });

  // Isometric view (docs/specs/008-canvas/isometric-view.md): the orbit-able camera + the innermost
  // transform fragment, pivoted on the content centre — see
  // useIsometricView. Shift-drag on the canvas spins / tilts it (see
  // the <main> pointerdown handler).
  const { isoCamera, isoFragment } = useIsometricView({ canvasTool, elements, mainRef });

  const cursorClass = canvasCursorClass({
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

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const doubleTap = useDoubleTapZoom(mainRef, viewportStore, { id: props.activeTabId, elements });
  const smallElementTap = useSmallElementDoubleTap(doubleTap.onElement);
  const stickyPeel = useStickyPeelVars();
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    middleMousePan: props.settings?.middleMousePan !== false,
    viewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan,
    setMarquee,
    isoCamera,
    onCanvasContextMenu,
    onDeselect,
    // A finger's double-tap on the bare canvas zooms in on the spot, a mouse's double-click drops text
    // (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom").
    onCanvasDoubleClick: (x, y, byFinger) =>
      byFinger ? doubleTap.onCanvas({ x, y }) : onCanvasDoubleClick(x, y),
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
          className={`relative flex-1 touch-none select-none overflow-clip outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${cursorClass}`}
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
            // The elements, as against the chrome over them (useDoubleTapZoom).
            data-canvas-content=""
            onPointerDown={surface.onWrapperPointerDown}
            onDoubleClick={surface.onWrapperDoubleClick}
            // Isometric view (docs/specs/008-canvas/isometric-view.md): the layer goes pointer-events-none so NO
            // element kind can be selected / dragged (a per-element capture guard can't catch every select path
            // — boxed elements, arrow hit-bands, labels, click vs pointerdown) — it's a read-only view tool.
            // Clicks fall through to <main>, where a drag pans (canvasTool === 'isometric' is added to
            // `wantsPan`).
            className={`absolute inset-0 origin-center touch-none ${
              canvasTool === 'isometric' ? 'pointer-events-none' : ''
            } ${cursorClass}`}
            // Scopes the [data-iso] CSS (globals.css): frames settle just under
            // the base plane while the camera orbits so they can't z-fight
            // (flicker) with the coplanar contents above them.
            data-iso={canvasTool === 'isometric' ? '' : undefined}
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
            }}
          >
            {/* Isometric extrusion (docs/specs/008-canvas/isometric-view.md): per-element raised blocks painted
              behind the real element layer, which caps each column at z=0.
              Only mounted while the tool is active. */}
            {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
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
                        hasArrows={hasArrows}
                        arrowLabels={arrowLabels}
                        selectionInput={selectionInput}
                        isPaintMode={isPaintMode}
                        handleArrowSelect={handleArrowSelect}
                        handleElementClick={handleElementClick}
                        handleElementContextSelect={handleElementContextSelect}
                        quickRingOpen={quickRingOpen}
                        setQuickRingOpen={setQuickRingOpen}
                      />
                    </ElementIndicatorStyleProvider>
                  </MindOutlineProvider>
                </MindGrowProvider>
              </CanvasZoomProvider>
            </CanvasArrivalProvider>
          </div>

          <CanvasSelectionToolbars
            props={props}
            selectionInput={selectionInput}
            quickRingOpen={quickRingOpen !== null}
          />
          <CanvasChrome
            {...props}
            mainSize={mainSize}
            formatConfig={props.formatConfig}
            onToggleFormatGroup={props.onToggleFormatGroup}
            onSetFormatMode={props.onSetFormatMode}
            formatBrushSource={props.formatBrushSource}
            formatPanelPosition={props.formatPanelPosition}
            onMoveFormatPanel={props.onMoveFormatPanel}
            onResetFormatPanel={props.onResetFormatPanel}
            offscreenContent={offscreenContent}
            marquee={marquee}
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
          {/* Lazy per-tab load (docs/specs/006-project/per-tab-storage.md). Last child + z-[var(--z-overlay)] so it covers the
            canvas AND the floating palette, blocking any edit that would
            otherwise overwrite an unfetched tab's real content. */}
          {tabLoadState && tabLoadState !== 'ready' ? (
            <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
          ) : null}
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
