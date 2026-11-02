import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import { isDoubleTapZoomPointer } from '@liveworkspace/workbench/lib/double-tap-zoom';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import type { useSpotlight } from '@liveworkspace/workbench/hooks/canvas/useSpotlight';
import { useLongPress } from '@liveworkspace/workbench/hooks/ui/useLongPress';
import { useRightClickRelease } from '@liveworkspace/workbench/hooks/canvas/useRightClickRelease';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isPanThrough, panThroughTap } from '@liveworkspace/workbench/hooks/canvas/pan-through';

type PanAndMarquee = ReturnType<typeof useCanvasPanAndMarquee>;

// The bottom-right cluster (Undo / Redo, Layers, Theme & Canvas, Zoom) is chrome, never canvas.
// Its buttons stop the press only in the bubble phase, after the capture intercept: without this,
// a held marker inked a dot under Undo and the click then undid that dot instead of the
// stroke the person meant (and an armed eraser, shape or spotlight acted under the button too).
const inCornerCluster = (target: EventTarget | null): boolean =>
  !!(target as Element | null)?.closest?.('[data-zoom-cluster]');

// How presses on the bare canvas surface route between the tools
// (docs/specs/008-canvas/canvas-and-palette.md), lifted out of Canvas's JSX: the capture-phase
// intercepts (spotlight grow / shrink, eraser, middle-mouse pan,
// draw-to-size), the background context menu, and the outer <main> +
// inner wrapper pointerdowns that arm the long-press menu and the
// pan-vs-marquee choice. Canvas mounts the
// returned handlers verbatim; every piece of state they drive stays
// owned by its existing hook (pan / marquee, spotlight,
// the draw gesture).
export function useCanvasSurfaceGestures({
  canvasTool,
  middleMousePan,
  pendingDraw,
  viewportOffset,
  viewportZoom,
  mainRef,
  wrapperRef,
  spaceHeldRef,
  setPan,
  setMarquee,
  spotlight,
  beginPendingDrawGesture,
  interceptPress,
  onEraseStart,
  onCanvasContextMenu,
  onDeselect,
  onCanvasDoubleClick,
}: {
  canvasTool: CanvasProps['canvasTool'];
  // Settings › Controls: middle-button drag pans the canvas (default on).
  middleMousePan: boolean;
  pendingDraw: CanvasProps['pendingDraw'];
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  mainRef: CanvasProps['mainRef'];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  spaceHeldRef: PanAndMarquee['spaceHeldRef'];
  setPan: PanAndMarquee['setPan'];
  setMarquee: PanAndMarquee['setMarquee'];
  spotlight: ReturnType<typeof useSpotlight>;
  // Starts the queued draw-to-size / freehand gesture; true when it
  // claimed the press (see useCanvasDrawGesture).
  beginPendingDrawGesture: (e: ReactPointerEvent) => boolean;
  // A mode that owns every primary press on the canvas while it is open (a path's edit mode,
  // docs/specs/023-draw-mode/path-tool.md "Editing"); true when it claimed the press.
  interceptPress?: (e: ReactPointerEvent) => boolean;
  onEraseStart?: CanvasProps['onEraseStart'];
  onCanvasContextMenu?: (x: number, y: number) => void;
  onDeselect: () => void;
  // `byFinger`: the double press was a finger's (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom").
  onCanvasDoubleClick: (x: number, y: number, byFinger: boolean) => void;
}) {
  // What pressed last, for the double-click that follows: a dblclick event says nothing of the pointer, and a
  // finger's double-tap zooms where a mouse's double-click drops text.
  const lastPointerType = useRef<string | null>(null);
  const focusCanvas = () => {
    const node = mainRef && 'current' in mainRef ? mainRef.current : null;
    node?.focus({ preventScroll: true });
  };

  // Drop a marquee / pan the press armed. Their release handlers deselect on
  // a sub-4px "drag", and deselecting closes the context menu, so a press
  // that turned out to open the menu must not leave one live.
  const cancelPressGesture = () => {
    setMarquee(null);
    setPan(null);
  };

  // The shared tail of both pointerdown handlers: tool decides the
  // gesture.
  //  - Pan tool / Space / Laser tool → drag scrolls. Laser drags pan
  //    because mid-presentation a click-drag is far more often "I want
  //    to reposition the canvas" than "I want to multi-select", and a
  //    pan is the safe no-op when the presenter is just steadying their
  //    hand. The trail keeps capturing pointer-moves throughout, so the
  //    pan reads as a sweeping laser to peers.
  //  - Touch + Laser is the exception (docs/specs/008-canvas/canvas-and-palette.md): a finger drag in laser
  //    mode draws the laser, not panning, because touch has no hover
  //    and pan-on-drag would pin the dot in canvas-coords (the canvas
  //    slides under the finger), defeating presenter mode on phones.
  //    Falls through so pointermove on <main> keeps broadcasting laser
  //    samples.
  //  - Select tool → drag draws a marquee for multi-select.
  const startPan = (e: ReactPointerEvent, onTap?: () => void) =>
    setPan({
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: viewportOffset.x,
      startOffsetY: viewportOffset.y,
      movedRef: { current: false },
      ...(onTap ? { onTap } : {}),
    });

  const routePanOrMarquee = (e: ReactPointerEvent) => {
    const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
    if (laserOnTouch) return;
    const wantsPan = spaceHeldRef.current || canvasTool === 'pan' || canvasTool === 'laser';
    if (wantsPan) {
      startPan(e);
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
    lastPointerType.current = e.pointerType;
    // Pointer-downs that land on a floating panel (palette, context
    // panel, ...) are UI interactions, not canvas gestures. The
    // panels live inside <main> for layout, so their bubble-phase
    // stopPropagation can't stop this ancestor capture handler from
    // firing first. Without this guard, clicking a palette button
    // while a draw is armed lets the draw-to-size intercept below
    // start a gesture at the click point and drop the pending shape
    // behind the panel. Bail before any canvas gesture starts.
    if ((e.target as Element | null)?.closest?.('[data-floating-panel]')) return;
    // The bottom-right cluster is chrome too (see inCornerCluster).
    if (inCornerCluster(e.target)) return;
    // Same for anything rendered through a PORTAL — the palette's category
    // dropdown, a context menu, a dialog. React routes events through the
    // component tree rather than the DOM tree, so a click inside a portal whose
    // owner lives under <main> still reaches this handler, and the guard above
    // can't see it: the portal's DOM is elsewhere entirely. If the press didn't
    // land inside <main>, it isn't a canvas gesture.
    const surface = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (surface && e.target instanceof Node && !surface.contains(e.target)) return;
    // A path's edit mode keeps the rest of the canvas inert: its presses are all its own. Held
    // Space still pans, and the other buttons keep their meaning.
    if (e.button === 0 && !spaceHeldRef.current && interceptPress?.(e)) {
      focusCanvas();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Spotlight tool (docs/specs/008-canvas/canvas-and-palette.md): a non-editing presenter mode. Left-click
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
    // Eraser tool (docs/specs/008-canvas/canvas-and-palette.md): a primary-button press deletes whatever
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
    // Mirrors Figma + the browser's own middle-drag scroll. Switchable
    // from Settings › Controls: off leaves the middle button to the
    // browser (some users drive autoscroll with it).
    if (e.button === 1 && middleMousePan) {
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
    // Spotlight tool (docs/specs/008-canvas/canvas-and-palette.md): right-click shrinks the light instead of
    // opening any menu. Capture phase + stopPropagation so it intercepts
    // right-clicks ANYWHERE — including over an element, whose own
    // onContextMenu would otherwise open the element menu. The bubble
    // handler below also bails in spotlight as a belt-and-braces guard.
    if (canvasTool !== 'spotlight') return;
    e.preventDefault();
    e.stopPropagation();
    spotlight.shrink();
  };

  // Right-clicking (or long-pressing) the empty canvas deselects, then opens
  // the canvas menu (docs/specs/008-canvas/canvas-and-palette.md "Selection"). The
  // deselect lands first: it closes any open menu, and the canvas menu then opens.
  const openCanvasMenu = (x: number, y: number) => {
    debugLog('[canvas-menu] deselect + open', x, y);
    onDeselect();
    onCanvasContextMenu?.(x, y);
  };

  // Touch has no right-click, so a press-and-hold on the empty canvas opens
  // the tab / canvas context menu (the same one desktop reaches via
  // right-click). Element presses stopPropagation in their own pointerdown,
  // so this only arms for the bare canvas. Movement (pan / marquee) cancels it.
  //
  // The same press also armed a marquee (or a pan), still live under the
  // finger when the hold fires. Its release reads as a sub-4px "drag", which
  // deselects, and deselecting closes the context menu: the menu flashed
  // open on the hold and vanished on the lift (iPhone / iPad). The hold has
  // claimed the press, so drop whatever the press started.
  const canvasLongPress = useLongPress((x, y) => {
    cancelPressGesture();
    openCanvasMenu(x, y);
  });

  // The tab menu opens on RELEASE, like an element's, through the same hook:
  // it copes with contextmenu arriving before the release (macOS / X11) OR
  // after it (Windows), which the old arm-then-wait ref here did not.
  const rightClick = useRightClickRelease(
    (e) => openCanvasMenu(e.clientX, e.clientY),
    // The canvas is the last stop for a right-click; nothing above it cares.
    { stopPropagation: false },
  );

  const onContextMenu = (e: ReactMouseEvent) => {
    // BoxedElementView's onContextMenu calls e.stopPropagation()
    // for right-clicks on elements, so we only reach here for
    // canvas background clicks. Suppress the browser context
    // menu and open a tab-level context menu instead.
    e.preventDefault();
    // Spotlight suppresses all context menus (right-click is its
    // shrink gesture, handled in onContextMenuCapture).
    if (canvasTool === 'spotlight') return;
    // A macOS Ctrl+click is a context click on the PRIMARY button, so its
    // pointerdown already armed a marquee (or pan) whose release would
    // deselect, and deselecting closes the menu this click is opening.
    // The press is a context click now, not a select: drop it.
    cancelPressGesture();
    rightClick.onContextMenu(e);
  };

  const onContextMenuPointerUp = rightClick.onPointerUp;

  const onPointerDown = (e: ReactPointerEvent) => {
    // A press inside a portal (a row's ⋯ menu from the phone's photo Layers sheet, which lives under <main> in the
    // React tree) reaches here through React's tree, not the DOM's. It is not the canvas's: focusing the canvas
    // pulled focus out of the menu, which closed it before its item's click, so Rename on a layer did nothing.
    const surface = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (surface && e.target instanceof Node && !surface.contains(e.target)) return;
    // A finger on a board's empty space, or on an element too big for the screen, pans, whatever the tool, and
    // never opens the canvas menu (@liveworkspace/workbench/hooks/canvas/pan-through.ts).
    if (isPanThrough(e)) {
      startPan(e, panThroughTap(e));
      return;
    }
    // Touch press-and-hold on the empty canvas opens the context menu
    // (touch has no right-click). Armed before the marquee / pan logic;
    // a finger that moves cancels it, so it never fights a drag.
    canvasLongPress.onPointerDown(e);
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
    // for the rect-less edge case where it didn't. A press on the corner cluster's strip frames
    // (which don't stop it) bubbles here, and is chrome, not a draw.
    if (pendingDraw && !inCornerCluster(e.target) && beginPendingDrawGesture(e)) return;
    // Auto-fit on load can scale the wrapper below 1, which
    // shrinks its hit region inside `main`. Without this mirror
    // handler, clicks in the "outside the shrunken wrapper but
    // still on the canvas" gap would never start a marquee.
    // Restrict to direct hits on `main` so element clicks (which
    // bubble up here) don't also trigger.
    if (e.target !== e.currentTarget) return;
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

  const pressedByFinger = () => isDoubleTapZoomPointer(lastPointerType.current);

  // The double press's canvas point. The wrapper's rect is post-transform, so a client position relative to its
  // top-left is in scaled pixels: divide by the zoom to recover canvas coords. Linear, so it holds outside the
  // wrapper's rect too.
  const doublePressAt = (e: ReactMouseEvent) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return rect ? pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom) : null;
  };

  const onWrapperDoubleClick = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget) return;
    const at = doublePressAt(e);
    if (at) onCanvasDoubleClick(at.x, at.y, pressedByFinger());
  };

  // The bare surface around the content layer: the layer is scaled with the zoom, so zoomed out (a phone's usual
  // view) most of the empty canvas is <main> itself. Only a finger's double-tap means anything there: it zooms
  // (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom"). The tools that make the layer inert
  // (Spotlight) give every press on <main> a meaning of their own.
  const onSurfaceDoubleClick = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget || !pressedByFinger()) return;
    if (canvasTool === 'spotlight') return;
    const at = doublePressAt(e);
    if (at) onCanvasDoubleClick(at.x, at.y, true);
  };

  return {
    canvasLongPress,
    onPointerDownCapture,
    onContextMenuCapture,
    onContextMenu,
    onContextMenuPointerUp,
    onPointerDown,
    onWrapperPointerDown,
    onWrapperDoubleClick,
    onSurfaceDoubleClick,
    pressedByFinger,
  };
}
