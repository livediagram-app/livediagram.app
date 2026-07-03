import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import type { useIsometricCamera } from '@/hooks/canvas/useIsometricCamera';
import type { useSpotlight } from '@/hooks/canvas/useSpotlight';
import type { useLongPress } from '@/hooks/ui/useLongPress';

type PanAndMarquee = ReturnType<typeof useCanvasPanAndMarquee>;

// How presses on the bare canvas surface route between the tools
// (spec/09 + spec/45), lifted out of Canvas's JSX: the capture-phase
// intercepts (spotlight grow / shrink, eraser, middle-mouse pan,
// draw-to-size), the background context menu, and the outer <main> +
// inner wrapper pointerdowns that arm the long-press menu, the
// isometric orbit, and the pan-vs-marquee choice. Canvas mounts the
// returned handlers verbatim; every piece of state they drive stays
// owned by its existing hook (pan / marquee, spotlight, iso camera,
// the draw gesture).
export function useCanvasSurfaceGestures({
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
  onEraseStart,
  onCanvasContextMenu,
  onCanvasDoubleClick,
}: {
  canvasTool: CanvasProps['canvasTool'];
  pendingDraw: CanvasProps['pendingDraw'];
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  mainRef: CanvasProps['mainRef'];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  spaceHeldRef: PanAndMarquee['spaceHeldRef'];
  setPan: PanAndMarquee['setPan'];
  setMarquee: PanAndMarquee['setMarquee'];
  spotlight: ReturnType<typeof useSpotlight>;
  isoCamera: ReturnType<typeof useIsometricCamera>;
  canvasLongPress: ReturnType<typeof useLongPress>;
  // Starts the queued draw-to-size / freehand gesture; true when it
  // claimed the press (see useCanvasDrawGesture).
  beginPendingDrawGesture: (e: ReactPointerEvent) => boolean;
  onEraseStart?: (x: number, y: number) => void;
  onCanvasContextMenu?: (x: number, y: number) => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
}) {
  const focusCanvas = () => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  };

  // The shared tail of both pointerdown handlers: tool decides the
  // gesture.
  //  - Pan tool / Space / Laser tool → drag scrolls. Laser drags pan
  //    because mid-presentation a click-drag is far more often "I want
  //    to reposition the canvas" than "I want to multi-select", and a
  //    pan is the safe no-op when the presenter is just steadying their
  //    hand. The trail keeps capturing pointer-moves throughout, so the
  //    pan reads as a sweeping laser to peers.
  //  - Touch + Laser is the exception (spec/09): a finger drag in laser
  //    mode draws the laser, not panning, because touch has no hover
  //    and pan-on-drag would pin the dot in canvas-coords (the canvas
  //    slides under the finger), defeating presenter mode on phones.
  //    Falls through so pointermove on <main> keeps broadcasting laser
  //    samples.
  //  - Select tool → drag draws a marquee for multi-select.
  const routePanOrMarquee = (e: ReactPointerEvent) => {
    const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
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
  };

  const onPointerDownCapture = (e: ReactPointerEvent) => {
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
      focusCanvas();
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
      focusCanvas();
      e.preventDefault();
      e.stopPropagation();
      onEraseStart?.(e.clientX, e.clientY);
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
      focusCanvas();
      if (beginPendingDrawGesture(e)) e.stopPropagation();
    }
  };

  const onContextMenuCapture = (e: ReactMouseEvent) => {
    // Spotlight tool (spec/09): right-click shrinks the light instead of
    // opening any menu. Capture phase + stopPropagation so it intercepts
    // right-clicks ANYWHERE — including over an element, whose own
    // onContextMenu would otherwise open the element menu. The bubble
    // handler below also bails in spotlight as a belt-and-braces guard.
    if (canvasTool !== 'spotlight') return;
    e.preventDefault();
    e.stopPropagation();
    spotlight.shrink();
  };

  const onContextMenu = (e: ReactMouseEvent) => {
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
  };

  const onPointerDown = (e: ReactPointerEvent) => {
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
    // currently focused; tabIndex={-1} makes <main> a valid focus
    // target, but a click on a tabIndex=-1 element doesn't
    // auto-focus it (mouse focus is restricted to inputs / hrefs /
    // tabIndex>=0). Calling `.focus()` here closes that loop so
    // clipboard-image paste works after the user has interacted
    // with the canvas at least once.
    focusCanvas();
    // Draw-to-size intercept: when an intent is pending, this
    // pointer-down starts the size-drag instead of falling
    // through to pan / marquee. Coords convert immediately to
    // canvas coords so the rest of the gesture (the window-
    // level move + up listeners) operates in one space.
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
    if (e.target !== e.currentTarget) return;
    // Isometric (spec/45): Shift-drag orbits the camera (spin + tilt)
    // instead of panning, so the plain drag stays a pan. Self-contained
    // in the camera hook; take it before the pan branch below.
    if (canvasTool === 'isometric' && e.shiftKey) {
      isoCamera.startOrbit(e.clientX, e.clientY);
      return;
    }
    routePanOrMarquee(e);
  };

  const onWrapperPointerDown = (e: ReactPointerEvent) => {
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
    focusCanvas();
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
    routePanOrMarquee(e);
  };

  const onWrapperDoubleClick = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    // rect is post-transform; click position relative to wrapper top-left
    // is in scaled pixels — divide by zoom to recover canvas-coords.
    const { x: sx, y: sy } = pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom);
    onCanvasDoubleClick(sx, sy);
  };

  return {
    onPointerDownCapture,
    onContextMenuCapture,
    onContextMenu,
    onPointerDown,
    onWrapperPointerDown,
    onWrapperDoubleClick,
  };
}
