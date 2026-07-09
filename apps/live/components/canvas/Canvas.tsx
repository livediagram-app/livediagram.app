import { useEffect, useMemo, useRef, useState } from 'react';
import { isAnimatedPattern } from '@livediagram/diagram';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { AnimatedCanvasBackground } from '@/components/canvas/AnimatedCanvasBackground';
import { pointerToCanvas } from '@/lib/canvas';
import { deriveCanvasSelection } from '@/lib/canvas-selection';
import { canvasCursorClass } from '@/lib/canvas-chrome';
import { useCanvasMobileDock } from '@/hooks/canvas/useCanvasMobileDock';
import { drawIntentCursor } from '@/lib/draw-mode';
import { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import { useQuickRing } from '@/hooks/canvas/useQuickRing';
import { useZoomControls } from '@/hooks/canvas/useZoomControls';
import { usePaletteDrop } from '@/hooks/canvas/usePaletteDrop';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { getTheme } from '@/lib/themes';
import { CanvasSelectionToolbars } from '@/components/canvas/CanvasSelectionToolbars';
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

// Reused as the excludeIds argument to snapResizeBounds during draw-
// to-size: the new element doesn't exist yet, so there's nothing to
// exclude. A module-level frozen Set keeps the snap effect from
// allocating a new Set on every pointermove.

import { CanvasChrome } from '@/components/canvas/CanvasChrome';
import { CanvasElementsLayer } from '@/components/canvas/CanvasElementsLayer';
import { CanvasLiveRegion } from '@/components/canvas/CanvasLiveRegion';
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricView } from '@/hooks/canvas/useIsometricView';
import { SpotlightOverlay } from '@/components/canvas/SpotlightOverlay';
import { useSpotlight } from '@/hooks/canvas/useSpotlight';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { Portal } from '@/components/primitives/Portal';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';
import { useCanvasSurfaceGestures } from '@/hooks/canvas/useCanvasSurfaceGestures';
import { useCanvasSelectHandlers } from '@/hooks/canvas/useCanvasSelectHandlers';

export function Canvas(props: CanvasProps) {
  const {
    tabLocked,
    readOnly,
    tabBackgroundPattern,
    tabBackgroundColor,
    tabBackgroundOpacity,
    tabBackgroundPatternScale,
    tabPatternColor,
    mainRef,
    isPinchingRef,
    viewportOffset,
    setViewportOffset,
    viewportZoom,
    setViewportZoom,
    elements,
    selectedId,
    soloSelectedId,
    multiSelectedIds,
    onSelectMarquee,
    canvasTool,
    onCanvasPointerMove,
    editingId,
    formatSourceId,
    groupSourceId,
    pendingDraw,
    onCommitDraw,
    onCommitFreehand,
    recogniseShapes,
    onDeselect,
    onSelect,
    onCanvasContextMenu,
    onElementContextMenu,
    onMultiContextMenu,
    onShiftSelect,
    tabThemeId,
    onCanvasDoubleClick,
    tabLoadState,
    onRetryTabLoad,
  } = props;

  // Touch has no right-click, so a press-and-hold on the empty canvas opens
  // the tab / canvas context menu (the same one desktop reaches via
  // right-click). Element presses stopPropagation in their own pointerdown,
  // so this only arms for the bare canvas. Movement (pan / marquee) cancels it.
  const canvasLongPress = useLongPress((x, y) => onCanvasContextMenu?.(x, y));

  const wrapperRef = useRef<HTMLDivElement>(null);

  const isPaintMode = formatSourceId !== null;
  const isGroupMode = groupSourceId !== null;
  // Nudge above the Fit button when the whole diagram has scrolled out of view.
  const offscreenContent = useOffscreenContent(elements, viewportOffset, viewportZoom, mainRef);

  // Pan tracking. viewportOffset is owned by the page (so element placement
  // can reason about the visible viewport); we just read/write through props.
  // Palette's bottom-Y (offsetTop + offsetHeight in offsetParent
  // coords). The Comments + AI panels use this to stack below the
  // Palette as it changes height; MovablePanel publishes it via onSize.
  // The bottom-Y (vs height alone) makes the alignment robust to the
  // Palette's own top-utility class, so the stacked panel lands at
  // paletteBottomY + 16 regardless of whether the palette pins to
  // top-2 (mobile) or top-4 (desktop).
  const [paletteBottomY, setPaletteBottomY] = useState<number>(0);
  // Explorer's measured bottom edge on mobile. The Palette sits BELOW
  // this via its `mobileTopOverridePx` so the diagram switcher fits
  // above the Palette without overlapping. Desktop ignores it (the
  // Explorer pins to top-left there, not as a banner).
  const [explorerBottomY, setExplorerBottomY] = useState<number>(0);
  // Which quick-connect ring (if any) is open. Self-contained state + reset /
  // outside-close effects live in useQuickRing.
  const [quickRingOpen, setQuickRingOpen] = useQuickRing(selectedId);
  // Mobile dock state + toggle (compact button row replacing the four
  // full-width collapse banners on mobile). See useCanvasMobileDock; the
  // popover anchor math is the tested computeDockAnchor.
  const {
    activeMobilePanel,
    setActiveMobilePanel,
    dockButtonRefs,
    activeDockAnchor,
    setActiveDockAnchor,
    handleDockButtonClick,
  } = useCanvasMobileDock(mainRef);

  // Pan + marquee + held-Space machinery lives in
  // useCanvasPanAndMarquee. The hook owns the pointerdown / move
  // / up listeners and the rect-vs-element marquee intersection,
  // exposes pan / marquee state + setters back so the canvas's
  // own pointerdown handlers can drive it, and exposes the
  // spaceHeldRef the pointerdown reads to decide pan vs marquee.
  const { pan, setPan, marquee, setMarquee, spaceHeldRef } = useCanvasPanAndMarquee({
    viewportZoom,
    setViewportOffset,
    elements,
    wrapperRef,
    onDeselect,
    onSelectMarquee,
    isPinchingRef,
  });

  // Palette drag-drop onto the canvas (onDragOver / onDrop), lifted into
  // usePaletteDrop so the canvas body keeps to layout + pointer routing.
  const paletteDrop = usePaletteDrop({
    onDropPalette: props.onDropPalette,
    viewportZoom,
    wrapperRef,
  });

  const {
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    resetZoom: handleResetZoom,
  } = useZoomControls(viewportZoom, setViewportZoom);

  // Selection-display derivation (primary element, bounds, and every
  // "show this chrome?" predicate) lives in lib/canvas-selection.ts so
  // it's unit-tested. Memoised because selectionMembers walks every
  // element and Canvas re-renders on every drag tick.
  const canvasSelection = useMemo(
    () =>
      deriveCanvasSelection({
        elements,
        selectedId,
        soloSelectedId,
        multiSelectedIds,
        editingId,
        isPaintMode,
        isGroupMode,
        tabLocked,
        readOnly,
      }),
    [
      elements,
      selectedId,
      soloSelectedId,
      multiSelectedIds,
      editingId,
      isPaintMode,
      isGroupMode,
      tabLocked,
      readOnly,
    ],
  );
  const {
    memberIds,
    selectionBounds,
    showPlus,
    showHandlesFor: showHandles,
    showAnchorsFor,
    unionResizeBounds,
    unionResizePrimaryId,
    showUnionResize,
  } = canvasSelection;

  // Cached check only. Render loops iterate `elements` directly so
  // arrows and boxed elements interleave in z-order (see render
  // block below); the only thing we still need eagerly is "are
  // there any arrows" to decide whether to mount the ArrowDefs.
  // `some` short-circuits on the first arrow (which is usually
  // near the front of the list once a diagram has any), so the
  // typical render pays O(1); the prior reduce was unconditional
  // O(N) for the sole purpose of computing a boolean.
  const hasArrows = elements.some((el) => el.type === 'arrow');

  // Spotlight presenter tool (spec/09): screen-space light position +
  // radius. Local to Canvas so the click handlers, the pointer tracker, and
  // the overlay share one source of truth; survives Pan/Select detours
  // because Canvas stays mounted.
  const spotlight = useSpotlight();

  // Isometric view (spec/45): the orbit-able camera + the innermost
  // transform fragment, pivoted on the content centre — see
  // useIsometricView. Shift-drag on the canvas spins / tilts it (see
  // the <main> pointerdown handler).
  const { isoCamera, isoFragment } = useIsometricView({ canvasTool, elements, mainRef });

  const cursorClass = canvasCursorClass({
    pendingDraw: !!pendingDraw,
    pan: !!pan,
    marquee: !!marquee,
    canvasTool,
    spaceHeld: spaceHeldRef.current,
    isPaintMode,
    isGroupMode,
  });

  // Colour for the link / comment badges. The active theme's
  // elementStroke is the obvious "this theme's accent" — it's what
  // arrows and new shape outlines use. The Brand theme has no stroke
  // override, so fall back to brand-500 (the hex behind bg-brand-500).
  const badgeColor = getTheme(tabThemeId).elementStroke ?? '#0ea5e9';

  // Broadcast the local pointer position to peers (canvas-coords).
  // Throttling lives in page.tsx so the Canvas stays prop-driven.
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    // Spotlight tracks the cursor in SCREEN space (px relative to <main>),
    // not canvas-coords: its light must stay put on screen as the diagram
    // pans / zooms under it. <main> is `position: relative` with no border,
    // so its content origin is its bounding-rect top-left.
    if (canvasTool === 'spotlight') {
      const node = mainRef && 'current' in mainRef ? mainRef.current : null;
      const mr = node?.getBoundingClientRect();
      if (mr) spotlight.setPos({ x: e.clientX - mr.left, y: e.clientY - mr.top });
    }
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasPointerMove(sx, sy);
  };
  const handlePointerLeaveCanvas = () => {
    onCanvasPointerMove(null, null);
  };

  // Stable selection-routing wrappers for the memo'd element / arrow
  // views — see useCanvasSelectHandlers.
  const { handleElementContextSelect, handleArrowSelect } = useCanvasSelectHandlers({
    inertIds: props.layerInertIds,
    soloSelectedId: props.soloSelectedId,
    elements,
    multiSelectedIds,
    onSelect,
    onShiftSelect,
    onElementContextMenu,
    onMultiContextMenu,
  });

  const { drawDrag, penPoints, drawHover, beginPendingDrawGesture } = useCanvasDrawGesture({
    pendingDraw,
    elements,
    wrapperRef,
    viewportZoom,
    isPinchingRef,
    recogniseShapes,
    onCommitDraw,
    onCommitFreehand,
  });

  // Bare-surface press routing (capture intercepts, background context
  // menu, pan-vs-marquee) lives in useCanvasSurfaceGestures; the JSX
  // below mounts its handlers verbatim.
  const surface = useCanvasSurfaceGestures({
    canvasTool,
    pendingDraw,
    viewportOffset,
    viewportZoom,
    mainRef,
    wrapperRef,
    spaceHeldRef,
    setPan,
    setMarquee,
    spotlight,
    isoCamera,
    canvasLongPress,
    beginPendingDrawGesture,
    onEraseStart: props.onEraseStart,
    onCanvasContextMenu,
    onCanvasDoubleClick,
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
  return (
    <main
      ref={mainRef}
      // In the tab order (spec/71): keyboard users Tab to the canvas as
      // one stop, then Tab / Shift+Tab walk the elements (useCanvasA11y,
      // engaged only while this surface itself is focused — the marker
      // attribute below is how the hook recognises it). The role stays
      // the main landmark (not "application") because the floating
      // panels render inside it and must keep normal SR navigation.
      tabIndex={0}
      aria-label="Diagram canvas"
      data-canvas-a11y-root=""
      onPointerMove={handlePointerMoveCanvas}
      onPointerLeave={handlePointerLeaveCanvas}
      onDragOver={paletteDrop.onDragOver}
      onDrop={paletteDrop.onDrop}
      onPointerDownCapture={surface.onPointerDownCapture}
      onContextMenuCapture={surface.onContextMenuCapture}
      onContextMenu={surface.onContextMenu}
      onPointerDown={surface.onPointerDown}
      // focus-visible ring only: pointer focus stays outline-free, but a
      // keyboard user Tabbing to the canvas sees where they landed.
      className={`relative flex-1 touch-none select-none overflow-hidden outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-400/70 [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
        pendingDraw ? '' : cursorClass
      }`}
      style={{
        ...tabBackgroundStyle(
          tabBackgroundPattern,
          viewportOffset,
          tabBackgroundColor,
          tabPatternColor,
          tabBackgroundOpacity,
          tabBackgroundPatternScale,
        ),
        // Mirror the inner-wrapper cursor on <main>. The inner div is
        // `absolute inset-0` but its CSS transform scales it (zoom),
        // so when zoom is below 1 the hit area shrinks and the
        // surrounding "letterbox" gap falls through to <main>. Without
        // setting cursor here too, the user would see the OS default
        // arrow in that gap while a draw-to-size intent is pending.
        ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
      }}
    >
      {/* SR-only polite live region (spec/71): selection / delete / undo
          announcements land here. */}
      <CanvasLiveRegion />
      {/* Animated backdrops (spec/09) paint as an ambient overlay behind the
          diagram content; the static patterns ride the <main> background
          above. tabBackgroundStyle returns just the backdrop colour for
          these, so this layer is the only thing that draws their motion. */}
      {isAnimatedPattern(tabBackgroundPattern) ? (
        <AnimatedCanvasBackground
          variant={tabBackgroundPattern}
          color={tabPatternColor}
          scale={tabBackgroundPatternScale}
          opacity={tabBackgroundOpacity}
        />
      ) : null}
      <div
        ref={wrapperRef}
        onPointerDown={surface.onWrapperPointerDown}
        onDoubleClick={surface.onWrapperDoubleClick}
        // Spotlight (spec/09) is a non-editing presenter mode: make the whole
        // diagram layer ignore pointer events so NO element kind can be
        // selected, dragged, or edited (a per-element capture guard can't
        // catch every select path — boxed elements, arrow hit-bands, labels,
        // click vs pointerdown). Clicks then fall through to <main>, where the
        // capture handler turns them into grow / shrink, and middle-mouse or
        // held-Space still pans.
        // Isometric view (spec/45): like Spotlight, the layer goes
        // pointer-events-none so NO element kind can be selected / dragged —
        // it's a read-only view tool. Clicks fall through to <main>, where a
        // drag pans (canvasTool === 'isometric' is added to `wantsPan`).
        className={`absolute inset-0 origin-center touch-none ${
          canvasTool === 'spotlight' || canvasTool === 'isometric' ? 'pointer-events-none' : ''
        } ${pendingDraw ? '' : cursorClass}`}
        // Scopes the [data-iso] CSS (globals.css): frames settle just under
        // the base plane while the camera orbits so they can't z-fight
        // (flicker) with the coplanar contents above them.
        data-iso={canvasTool === 'isometric' ? '' : undefined}
        style={{
          // Translate is in canvas-coords (applied first); scale is centred
          // on the wrapper so zooming keeps the viewport centre stable.
          // Isometric tilt (spec/45) is appended INNERMOST (last in the list,
          // so it transforms the content first): that keeps the pan translate
          // in screen space, so a drag moves the scene the way the cursor
          // moves at any camera angle. The fragment (built above as
          // isoFragment) pivots the tilt around the content centre so the
          // diagram tilts in place / stays centred while orbiting rather than
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
          ...(pendingDraw ? { cursor: drawIntentCursor(pendingDraw) } : null),
        }}
      >
        {/* Isometric extrusion (spec/45): per-element raised blocks painted
            behind the real element layer, which caps each column at z=0.
            Only mounted while the tool is active. */}
        {canvasTool === 'isometric' ? <IsometricDepthLayer elements={elements} /> : null}
        <CanvasElementsLayer
          {...props}
          hasArrows={hasArrows}
          memberIds={memberIds}
          showHandles={showHandles}
          showAnchorsFor={showAnchorsFor}
          badgeColor={badgeColor}
          selectionBounds={selectionBounds}
          showPlus={showPlus}
          showUnionResize={showUnionResize}
          unionResizeBounds={unionResizeBounds}
          unionResizePrimaryId={unionResizePrimaryId}
          isPaintMode={isPaintMode}
          isGroupMode={isGroupMode}
          handleArrowSelect={handleArrowSelect}
          handleElementContextSelect={handleElementContextSelect}
          quickRingOpen={quickRingOpen}
          setQuickRingOpen={setQuickRingOpen}
        />
      </div>

      {/* Spotlight presenter shroud (spec/09). Screen-space sibling of the
          transformed wrapper so the light stays fixed on screen while the
          diagram pans / zooms underneath. Rendered before CanvasChrome so the
          palette + chrome paint ON TOP and stay reachable to switch tools
          back; pointer-events-none lets clicks fall through to <main>. */}
      {canvasTool === 'spotlight' ? (
        <SpotlightOverlay pos={spotlight.pos} radius={spotlight.radius} />
      ) : null}

      <CanvasSelectionToolbars
        props={props}
        selection={canvasSelection}
        quickRingOpen={quickRingOpen !== null}
      />

      <CanvasChrome
        {...props}
        isPaintMode={isPaintMode}
        isGroupMode={isGroupMode}
        offscreenContent={offscreenContent}
        marquee={marquee}
        drawDrag={drawDrag}
        drawHover={drawHover}
        penPoints={penPoints}
        wrapperRef={wrapperRef}
        paletteBottomY={paletteBottomY}
        setPaletteBottomY={setPaletteBottomY}
        explorerBottomY={explorerBottomY}
        setExplorerBottomY={setExplorerBottomY}
        activeMobilePanel={activeMobilePanel}
        setActiveMobilePanel={setActiveMobilePanel}
        dockButtonRefs={dockButtonRefs}
        activeDockAnchor={activeDockAnchor}
        setActiveDockAnchor={setActiveDockAnchor}
        handleDockButtonClick={handleDockButtonClick}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleResetZoom={handleResetZoom}
        onIsoOrbit={isoCamera.startOrbit}
        onIsoReset={isoCamera.reset}
      />
      {/* Lazy per-tab load (spec/13). Last child + z-[var(--z-overlay)] so it covers the
          canvas AND the floating palette, blocking any edit that would
          otherwise overwrite an unfetched tab's real content. */}
      {tabLoadState && tabLoadState !== 'ready' ? (
        <TabLoadOverlay state={tabLoadState} onRetry={() => onRetryTabLoad?.()} />
      ) : null}
      {/* Drag-to-add ghost (spec/58): previews where a dragged palette shape
          will land, following the cursor over the canvas. */}
      <PaletteDragGhost zoom={viewportZoom} />
      {/* Map (spec/59) now renders inside CanvasChrome's docking layer
          (spec/63) so it snaps + stacks like the other floating panels. */}
      {/* Touch long-press "hold" ring at the finger: the spec/09
          press-and-hold affordance that opens the context menu on touch.
          Portaled to escape the canvas's pan/zoom transform so its fixed
          position is viewport-relative. Reveals only after a deliberate hold
          and completes as the context menu opens. */}
      {canvasLongPress.pressPoint ? (
        <Portal>
          <div
            aria-hidden
            className="animate-longpress-hold pointer-events-none fixed z-[var(--z-toast)] h-9 w-9 rounded-full border-2 border-brand-500/70"
            style={{ left: canvasLongPress.pressPoint.x, top: canvasLongPress.pressPoint.y }}
          />
        </Portal>
      ) : null}
    </main>
  );
}
