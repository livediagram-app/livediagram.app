import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { isAnimatedPattern, isBoxed, unionBoxedBounds } from '@livediagram/diagram';
import { isoPivot, isoTransform } from '@/lib/isometric';
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
import { IsometricDepthLayer } from '@/components/canvas/IsometricDepthLayer';
import { useIsometricCamera } from '@/hooks/canvas/useIsometricCamera';
import { SpotlightOverlay } from '@/components/canvas/SpotlightOverlay';
import { useSpotlight } from '@/hooks/canvas/useSpotlight';
import { useOffscreenContent } from '@/hooks/canvas/useOffscreenContent';
import { Portal } from '@/components/primitives/Portal';
import { TabLoadOverlay } from '@/components/canvas/TabLoadOverlay';
import { PaletteDragGhost } from '@/components/canvas/PaletteDragGhost';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasDrawGesture } from '@/components/canvas/useCanvasDrawGesture';

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

  // Isometric camera (spec/45): the orbit-able view angle. Local, non-synced
  // view state; Shift-drag on the canvas spins / tilts it (see the <main>
  // pointerdown handler).
  const isoCamera = useIsometricCamera();

  // Centre of the boxed content, in canvas px — the point the isometric
  // tilt pivots around so the diagram tilts in place (and stays put as you
  // orbit) instead of swinging off-screen. Only computed while the tool is
  // active; null when there's no boxed element to centre on.
  const isoContentCenter = useMemo(() => {
    if (canvasTool !== 'isometric') return null;
    const boxedIds = new Set(elements.filter(isBoxed).map((el) => el.id));
    if (boxedIds.size === 0) return null;
    const bb = unionBoxedBounds(elements, boxedIds);
    if (!bb) return null;
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  }, [canvasTool, elements]);

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

  // Stable wrapper for the element-right-click flow. BoxedElementView
  // is memoed; passing inline arrows for `onContextSelect` would
  // recreate them per element per render and invalidate the memo.
  // useCallback gives it one identity across renders, so the memoed
  // child sees the same function reference until `onSelect` or
  // `onElementContextMenu` itself changes upstream.
  const handleElementContextSelect = useCallback(
    (id: string, sx: number, sy: number) => {
      // Right-clicking a member of an active multi-selection keeps the whole
      // selection and opens a selection-wide menu. Right-clicking a grouped
      // element selects the group (which expands to all members) and opens
      // the same menu. Otherwise it's a single element.
      const inMarquee = multiSelectedIds.size > 1 && multiSelectedIds.has(id);
      const el = elements.find((e) => e.id === id);
      const grouped = !!el && isBoxed(el) && !!el.groupId;
      if (inMarquee && onMultiContextMenu) {
        onMultiContextMenu(sx, sy);
        return;
      }
      if (grouped && onMultiContextMenu) {
        onSelect(id);
        onMultiContextMenu(sx, sy);
        return;
      }
      onSelect(id);
      onElementContextMenu?.(id, sx, sy);
    },
    [onSelect, onElementContextMenu, onMultiContextMenu, elements, multiSelectedIds],
  );

  // Stable wrapper for the arrow click flow. Same rationale as
  // handleElementContextSelect: a per-arrow inline arrow at the
  // call site would defeat ArrowView's memo on every render of the
  // Canvas. Mirrors BoxedElementView's shift-modifier semantics so
  // an arrow can join a marquee multi-selection via plain click
  // (when one is active) or Shift-click. Reading the latest
  // `multiSelectedIds` through a ref keeps this callback stable
  // even as the selection set changes.
  const multiSelectedIdsRef = useRef(multiSelectedIds);
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

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
  const handleArrowSelect = useCallback(
    (id: string, e: ReactPointerEvent) => {
      const set = multiSelectedIdsRef.current;
      const isMember = set.has(id);
      if (e.shiftKey || (set.size > 0 && !isMember)) {
        onShiftSelect(id);
        return;
      }
      onSelect(id);
    },
    [onSelect, onShiftSelect],
  );

  // Isometric tilt fragment, appended innermost to the wrapper transform.
  // The pivot (content centre relative to the wrapper centre) makes the
  // tilt rotate around the diagram rather than the wrapper centre, so the
  // content tilts in place and stays centred as the camera orbits. The
  // wrapper's unscaled size = the main canvas rect (it's `absolute inset-0`
  // and untransformed itself), read here rather than tracked in state
  // because the transform recomputes on every pan / orbit render anyway.
  let isoFragment = '';
  if (canvasTool === 'isometric') {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    const rect = node?.getBoundingClientRect();
    const pivot = rect
      ? isoPivot(isoContentCenter, { width: rect.width, height: rect.height })
      : null;
    isoFragment = ` ${isoTransform(isoCamera.azimuth, isoCamera.elevation, pivot ?? undefined)}`;
  }

  return (
    <main
      ref={mainRef}
      tabIndex={-1}
      onPointerMove={handlePointerMoveCanvas}
      onPointerLeave={handlePointerLeaveCanvas}
      onDragOver={paletteDrop.onDragOver}
      onDrop={paletteDrop.onDrop}
      onPointerDownCapture={(e) => {
        // Pointer-downs that land on a floating panel (palette, context
        // panel, ...) are UI interactions, not canvas gestures. The
        // panels live inside <main> for layout, so their bubble-phase
        // stopPropagation can't stop this ancestor capture handler from
        // firing first. Without this guard, clicking a palette button
        // while a draw is armed lets the draw-to-size intercept below
        // start a gesture at the click point and drop the pending shape
        // behind the panel. Bail before any canvas gesture starts.
        if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) return;
        // Spotlight tool (spec/09): a non-editing presenter mode. Left-click
        // grows the light; right-click shrinks it (the shrink itself runs in
        // onContextMenuCapture below). Handled in the capture phase so it
        // wins over an element's own select/drag — and we MUST swallow the
        // secondary button too, not just the primary: arrow hit-bands set
        // `pointer-events: stroke`, which re-enables them despite the layer's
        // `pointer-events: none`, and their pointerdown selects on ANY button,
        // so a right-click would otherwise select the arrow under the cursor.
        // Middle-mouse (button 1) is the exception — it falls through to pan.
        // Space-held also falls through so it can pan.
        if (canvasTool === 'spotlight' && !spaceHeldRef.current && e.button !== 1) {
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          e.preventDefault();
          e.stopPropagation();
          if (e.button === 0) spotlight.grow();
          return;
        }
        // Eraser tool (spec/09): a primary-button press deletes whatever
        // it lands on and starts a drag-to-erase gesture. Handled in the
        // capture phase so it wins over an element's own select/drag and
        // the background marquee/pan; useCanvasEraser tracks the rest of
        // the gesture via window listeners.
        if (e.button === 0 && canvasTool === 'eraser') {
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          e.preventDefault();
          e.stopPropagation();
          props.onEraseStart?.(e.clientX, e.clientY);
          return;
        }
        // Middle-mouse drag pans from anywhere on the canvas — empty
        // space OR over elements — regardless of the active tool. The
        // capture phase runs before the element + background
        // pointerdown handlers, so it wins over selection / drag.
        // Mirrors Figma + the browser's own middle-drag scroll.
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          setPan({
            startClientX: e.clientX,
            startClientY: e.clientY,
            startOffsetX: viewportOffset.x,
            startOffsetY: viewportOffset.y,
            movedRef: { current: false },
          });
          return;
        }
        // Draw-to-size intercept must run in the capture phase so a
        // queued draw can begin ON TOP of an existing element. An
        // element's own bubble-phase pointerdown selects / drags it and
        // stops propagation, which would otherwise make it impossible
        // to draw a new element over another. Capturing here lets the
        // draw win regardless of what's under the pointer; the
        // background bubble handlers still cover the rect-less edge
        // case where this returns false.
        if (e.button === 0 && pendingDraw) {
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          if (beginPendingDrawGesture(e)) e.stopPropagation();
        }
      }}
      onContextMenuCapture={(e) => {
        // Spotlight tool (spec/09): right-click shrinks the light instead of
        // opening any menu. Capture phase + stopPropagation so it intercepts
        // right-clicks ANYWHERE — including over an element, whose own
        // onContextMenu would otherwise open the element menu. The bubble
        // handler below also bails in spotlight as a belt-and-braces guard.
        if (canvasTool !== 'spotlight') return;
        e.preventDefault();
        e.stopPropagation();
        spotlight.shrink();
      }}
      onContextMenu={(e) => {
        // BoxedElementView's onContextMenu calls e.stopPropagation()
        // for right-clicks on elements, so we only reach here for
        // canvas background clicks. Suppress the browser context
        // menu and open a tab-level context menu instead.
        e.preventDefault();
        // Spotlight suppresses all context menus (right-click is its
        // shrink gesture, handled in onContextMenuCapture). Isometric
        // (spec/45) likewise: right-click-drag orbits the camera, so the
        // canvas / tab menu must never open in that tool or it interrupts
        // the orbit gesture.
        if (canvasTool === 'spotlight' || canvasTool === 'isometric') return;
        onCanvasContextMenu?.(e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        // Touch press-and-hold on the empty canvas opens the context menu
        // (touch has no right-click). Armed before the marquee / pan logic;
        // a finger that moves cancels it, so it never fights a drag.
        canvasLongPress.onPointerDown(e);
        // Isometric (spec/45): holding the RIGHT button and dragging orbits
        // the camera too — a mouse-only alternative to Shift-drag / the orbit
        // button. The canvas / tab context menu is suppressed wholesale while
        // the isometric tool is active (see onContextMenu above), so a
        // right-press starts an orbit without ever popping a menu.
        if (canvasTool === 'isometric' && e.button === 2) {
          isoCamera.startOrbit(e.clientX, e.clientY);
          return;
        }
        // Primary button only. A right- (or middle-) click must fall
        // through to onContextMenu untouched: it opens the menu, and if
        // we also armed a marquee here the matching pointerup would fire
        // onDeselect (sub-4px "drag") and close the menu the same instant
        // it appeared. PointerEvent.button is 0 for touch / pen contact
        // too, so this only filters non-primary mouse buttons.
        if (e.button !== 0) return;
        // Focus the canvas surface so subsequent Cmd/Ctrl+V dispatches
        // a `paste` event the editor-page-level handler can read. The
        // browser only fires `paste` when something focusable is
        // currently focused; tabIndex={-1} below makes <main> a valid
        // focus target, but a click on a tabIndex=-1 element doesn't
        // auto-focus it (mouse focus is restricted to inputs / hrefs /
        // tabIndex>=0). Calling `.focus()` here closes that loop so
        // clipboard-image paste works after the user has interacted
        // with the canvas at least once.
        const node = mainRef && 'current' in mainRef ? mainRef.current : null;
        node?.focus({ preventScroll: true });
        // Draw-to-size intercept: when an intent is pending, this
        // pointer-down starts the size-drag instead of falling
        // through to pan / marquee. Coords convert immediately to
        // canvas coords so the rest of the gesture (the window-
        // level move + up listeners above) operates in one space.
        // Usually the capture-phase intercept above has already started
        // the gesture (and stopped propagation); this is the fallback
        // for the rect-less edge case where it didn't.
        if (pendingDraw && beginPendingDrawGesture(e)) return;
        // Auto-fit on load can scale the wrapper below 1, which
        // shrinks its hit region inside `main`. Without this mirror
        // handler, clicks in the "outside the shrunken wrapper but
        // still on the canvas" gap would never start a marquee.
        // Restrict to direct hits on `main` so element clicks (which
        // bubble up here) don't also trigger.
        //
        // Laser is grouped with pan here (matching the inner wrapper
        // handler below): mid-presentation a click-drag is far more
        // often "reposition the canvas" than "multi-select", and a
        // pan is the safe no-op when the presenter is just steadying
        // their hand. Without this, a laser-mode drag in the outer
        // gap would silently draw a marquee selection box.
        //
        // Touch is the explicit exception (spec/09): a finger drag
        // in laser mode MUST draw the laser, not pan, because touch
        // has no hover. Pan-on-drag would pin the dot in canvas
        // coords (the canvas slides under the finger), defeating
        // the presenter mode entirely on phones / tablets.
        if (e.target !== e.currentTarget) return;
        // Isometric (spec/45): Shift-drag orbits the camera (spin + tilt)
        // instead of panning, so the plain drag stays a pan. Self-contained
        // in the camera hook; take it before the pan branch below.
        if (canvasTool === 'isometric' && e.shiftKey) {
          isoCamera.startOrbit(e.clientX, e.clientY);
          return;
        }
        const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
        // Touch + Laser is a pure draw gesture: no pan, no marquee.
        // pointermove on <main> keeps broadcasting laser samples via
        // onCanvasPointerMove. Without this short-circuit the drag
        // would fall into the marquee branch below and paint a
        // selection rectangle while the user is presenting.
        if (laserOnTouch) return;
        const wantsPan =
          spaceHeldRef.current ||
          canvasTool === 'pan' ||
          canvasTool === 'laser' ||
          canvasTool === 'isometric';
        if (wantsPan) {
          setPan({
            startClientX: e.clientX,
            startClientY: e.clientY,
            startOffsetX: viewportOffset.x,
            startOffsetY: viewportOffset.y,
            movedRef: { current: false },
          });
        } else {
          setMarquee({
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
          });
        }
      }}
      className={`relative flex-1 touch-none select-none overflow-hidden outline-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] ${
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
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          // Primary button only — see the outer handler: a right-click
          // must reach onContextMenu without arming a marquee whose
          // pointerup would deselect and close the menu instantly.
          if (e.button !== 0) return;
          // Focus the canvas surface so subsequent Cmd/Ctrl+V
          // dispatches a paste event (see the outer pointerdown
          // handler above for the full rationale). Same call from
          // the inner wrapper so click-on-canvas-content (which
          // doesn't bubble through the outer onPointerDown's
          // currentTarget gate) still leaves the canvas focused.
          const node = mainRef && 'current' in mainRef ? mainRef.current : null;
          node?.focus({ preventScroll: true });
          // Draw-to-size intercept (mirror of the outer handler).
          // beginPendingDrawGesture branches on `freehand` internally:
          // a freehand intent seeds the polyline accumulator, every
          // other intent seeds the box / line drag. (An earlier inline
          // version always started a drawDrag, so a pen click landed
          // BOTH a penPoints state and a drawDrag and mis-routed into
          // createImage; the shared helper has the single correct
          // branch.) Usually the capture-phase intercept has already
          // handled this; kept as the rect-less fallback.
          if (pendingDraw && beginPendingDrawGesture(e)) return;
          // Tool decides the gesture:
          //  - Pan tool / Space / Laser tool → drag scrolls. Laser
          //    drags pan because mid-presentation a click-drag is far
          //    more often "I want to reposition the canvas" than "I
          //    want to multi-select", and a pan is the safe no-op
          //    when the presenter is just steadying their hand. The
          //    trail keeps capturing pointer-moves throughout, so
          //    the pan reads as a sweeping laser to peers.
          //  - Touch + Laser is the exception (spec/09): a finger
          //    drag in laser mode draws the laser, not panning,
          //    because touch has no hover and pan-on-drag would pin
          //    the dot in canvas-coords.
          //  - Select tool → drag draws a marquee for multi-select.
          const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
          // Touch + Laser: pure draw, no pan, no marquee. Falls
          // through so pointermove on <main> can keep broadcasting
          // laser samples. See the outer handler above for the
          // matching short-circuit.
          if (laserOnTouch) return;
          const wantsPan =
            spaceHeldRef.current ||
            canvasTool === 'pan' ||
            canvasTool === 'laser' ||
            canvasTool === 'isometric';
          if (wantsPan) {
            setPan({
              startClientX: e.clientX,
              startClientY: e.clientY,
              startOffsetX: viewportOffset.x,
              startOffsetY: viewportOffset.y,
              movedRef: { current: false },
            });
          } else {
            setMarquee({
              startX: e.clientX,
              startY: e.clientY,
              currentX: e.clientX,
              currentY: e.clientY,
            });
          }
        }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const rect = wrapperRef.current?.getBoundingClientRect();
          if (!rect) return;
          // rect is post-transform; click position relative to wrapper top-left
          // is in scaled pixels — divide by zoom to recover canvas-coords.
          const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
          onCanvasDoubleClick(sx, sy);
        }}
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
      {/* Lazy per-tab load (spec/13). Last child + z-[var(--z-modal)] so it covers the
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
