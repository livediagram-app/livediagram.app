import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import { createEraseFrameReader } from '@/lib/erase-frame';
import { useLatest } from '@/hooks/ui/useLatest';
import { peerPushTarget } from '@/lib/avatar-walk';
import { avatarScale, parseAvatarConfig } from '@/lib/avatar-config';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import type { useIsometricCamera } from '@/hooks/canvas/useIsometricCamera';
import type { useSpotlight } from '@/hooks/canvas/useSpotlight';
import type { useAvatarWalk } from '@/hooks/canvas/useAvatarWalk';
import { useLongPress } from '@/hooks/ui/useLongPress';
import { useRightClickRelease } from '@/hooks/canvas/useRightClickRelease';
import { isHeldPenIntent } from '@/lib/draw-mode';
import { markPenSeen, penSeen } from '@/lib/pen-seen';
import { whiteboardPointerRoute } from '@/lib/whiteboard-tool';
import { debugLog } from '@/lib/debug-log';
import { isPanThrough } from '@/hooks/canvas/pan-through';

type PanAndMarquee = ReturnType<typeof useCanvasPanAndMarquee>;

// The bottom-right cluster (Undo / Redo, Layers, Theme & Canvas, Zoom) is chrome, never canvas.
// Its buttons stop the press only in the bubble phase, after the capture intercept: without this,
// a held Draw mode marker inked a dot under Undo and the click then undid that dot instead of the
// stroke the person meant (and an armed eraser, shape or spotlight acted under the button too).
const inCornerCluster = (target: EventTarget | null): boolean =>
  !!(target as Element | null)?.closest?.('[data-zoom-cluster]');

// How presses on the bare canvas surface route between the tools
// (docs/specs/008-canvas/canvas-and-palette.md + docs/specs/008-canvas/isometric-view.md), lifted out of Canvas's JSX: the capture-phase
// intercepts (spotlight grow / shrink, eraser, middle-mouse pan,
// draw-to-size), the background context menu, and the outer <main> +
// inner wrapper pointerdowns that arm the long-press menu, the
// isometric orbit, and the pan-vs-marquee choice. Canvas mounts the
// returned handlers verbatim; every piece of state they drive stays
// owned by its existing hook (pan / marquee, spotlight, iso camera,
// the draw gesture).
export function useCanvasSurfaceGestures({
  canvasTool,
  middleMousePan,
  pendingDraw,
  whiteboard = false,
  viewportOffset,
  viewportZoom,
  mainRef,
  wrapperRef,
  spaceHeldRef,
  setPan,
  setMarquee,
  spotlight,
  avatar,
  peerAvatars,
  onPushPeer,
  isoCamera,
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
  // The active tab is a whiteboard (docs/specs/023-draw-mode/draw-mode.md "Touch and pen input").
  whiteboard?: boolean;
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  mainRef: CanvasProps['mainRef'];
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  spaceHeldRef: PanAndMarquee['spaceHeldRef'];
  setPan: PanAndMarquee['setPan'];
  setMarquee: PanAndMarquee['setMarquee'];
  spotlight: ReturnType<typeof useSpotlight>;
  avatar: ReturnType<typeof useAvatarWalk>;
  // Peers' characters on this tab (docs/specs/008-canvas/avatar-mode.md), so a click can land on one.
  peerAvatars: CanvasProps['remoteAvatars'];
  // Shove a peer: fired once our character has walked up to theirs.
  onPushPeer?: (targetId: string, dx: number, dy: number) => void;
  isoCamera: ReturnType<typeof useIsometricCamera>;
  // Starts the queued draw-to-size / freehand gesture; true when it
  // claimed the press (see useCanvasDrawGesture).
  beginPendingDrawGesture: (e: ReactPointerEvent) => boolean;
  // A mode that owns every primary press on the canvas while it is open (a path's edit mode,
  // docs/specs/023-draw-mode/path-tool.md "Editing"); true when it claimed the press.
  interceptPress?: (e: ReactPointerEvent) => boolean;
  onEraseStart?: CanvasProps['onEraseStart'];
  onCanvasContextMenu?: (x: number, y: number) => void;
  onDeselect: () => void;
  onCanvasDoubleClick: (x: number, y: number) => void;
}) {
  // The live view, for an erase sweep's frame reader (lib/erase-frame): read per sample, after
  // any pan or zoom since the press.
  const viewRef = useLatest({ offset: viewportOffset, zoom: viewportZoom });
  // Which peer's character a click landed on, plus where to stand and which way
  // to shove. The decision itself is pure (see peerPushTarget); this only feeds
  // it the peers as the presence packets describe them.
  const peerAvatarAt = (point: { x: number; y: number }) =>
    peerPushTarget(
      peerAvatars.map((peer) => ({
        id: peer.id,
        feet: { x: peer.avatar.x, y: peer.avatar.y },
        lift: peer.avatar.lift,
        scale: avatarScale(parseAvatarConfig(peer.avatar.config).size),
      })),
      point,
      avatar.pos,
    );

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
  const startPan = (e: ReactPointerEvent) =>
    setPan({
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: viewportOffset.x,
      startOffsetY: viewportOffset.y,
      movedRef: { current: false },
    });

  const routePanOrMarquee = (e: ReactPointerEvent) => {
    const laserOnTouch = canvasTool === 'laser' && e.pointerType === 'touch';
    if (laserOnTouch) return;
    const wantsPan =
      spaceHeldRef.current ||
      canvasTool === 'pan' ||
      canvasTool === 'laser' ||
      canvasTool === 'isometric';
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
    // A maximised or tab-filling Plan board covers the canvas (docs/specs/026-plan/plan-board.md "Maximised board"):
    // a press on it, or on the cover around it, is the board's or nothing, never a canvas gesture.
    if ((e.target as Element | null)?.closest?.('[data-canvas-cover]')) return;
    // Same for anything rendered through a PORTAL — the palette's category
    // dropdown, a context menu, a dialog. React routes events through the
    // component tree rather than the DOM tree, so a click inside a portal whose
    // owner lives under <main> still reaches this handler, and the guard above
    // can't see it: the portal's DOM is elsewhere entirely. In Avatar mode that
    // meant picking a palette category walked the character off behind the
    // palette. If the press didn't land inside <main>, it isn't a canvas
    // gesture.
    const surface = mainRef && 'current' in mainRef ? mainRef.current : null;
    if (surface && e.target instanceof Node && !surface.contains(e.target)) return;
    // Whiteboard (docs/specs/023-draw-mode/draw-mode.md "Touch and pen input"): once a pen has been
    // used, a single finger pans instead of inking, so a resting palm never
    // draws. The pen itself, and a mouse, always ink.
    if (whiteboard && e.button === 0) {
      if (e.pointerType === 'pen') markPenSeen();
      const inking = canvasTool === 'eraser' || isHeldPenIntent(pendingDraw);
      const route = whiteboardPointerRoute({
        pointerType: e.pointerType,
        penSeen: penSeen(),
        inking,
      });
      if (route === 'pan') {
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
    }
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
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md): a non-editing presenter mode where a primary
    // click means "walk over there". Handled in the capture phase for the
    // same reason as Spotlight: the canvas layer is pointer-inert, but arrow
    // hit-bands re-enable themselves via `pointer-events: stroke` and select
    // on ANY button, so we swallow the secondary button too. Middle-mouse
    // (pan) and held-Space (temporary pan) fall through untouched.
    if (canvasTool === 'avatar' && !spaceHeldRef.current && e.button !== 1) {
      focusCanvas();
      e.preventDefault();
      e.stopPropagation();
      const rect = wrapperRef.current?.getBoundingClientRect();
      const point = rect ? pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom) : null;
      if (!point) return;
      // Left-click walks there; right-click ON the character changes who it
      // is (male / female), and a right-click anywhere else is swallowed —
      // the context menu stays shut in this mode either way.
      if (e.button === 0) {
        // Seated (docs/specs/009-elements/chair.md): a double-click is one of the two deliberate ways
        // out of a chair. A single click deliberately does nothing — walkTo
        // refuses while seated, so you cannot be dragged out by a stray click
        // — which left no pointer-only way out at all until this.
        if (avatar.seatedOn && e.detail >= 2) {
          avatar.standUp();
          return;
        }
        // Clicking someone ELSE's character walks over and pushes them
        // (docs/specs/008-canvas/avatar-mode.md), rather than walking to the spot they're standing on.
        const peer = peerAvatarAt(point);
        if (peer) {
          avatar.walkTo(peer.standAt, () => onPushPeer?.(peer.id, peer.dx, peer.dy));
        } else {
          avatar.walkTo(point);
        }
      } else if (e.button === 2) avatar.toggleLookAt(point);
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
      onEraseStart?.(
        e.clientX,
        e.clientY,
        createEraseFrameReader(
          () => viewRef.current,
          () => wrapperRef.current?.getBoundingClientRect(),
        ),
      );
      return;
    }
    // Whiteboard, Select in hand (docs/specs/023-draw-mode/draw-mode.md "Selecting"): Shift + press always
    // drags a selection box that adds to the selection, even when it starts on an element, and a
    // Shift-click on an element toggles it. A handle keeps its own Shift behaviour.
    if (
      whiteboard &&
      e.button === 0 &&
      e.shiftKey &&
      canvasTool === 'select' &&
      !pendingDraw &&
      !spaceHeldRef.current
    ) {
      const target = e.target as HTMLElement;
      const onCanvas = target === e.currentTarget || !!wrapperRef.current?.contains(target);
      if (onCanvas && !target.closest('[data-canvas-handle]')) {
        focusCanvas();
        e.preventDefault();
        e.stopPropagation();
        setMarquee({
          startX: e.clientX,
          startY: e.clientY,
          currentX: e.clientX,
          currentY: e.clientY,
          additive: true,
          clickTarget: target.closest('[data-element-id]')?.getAttribute('data-element-id') ?? null,
        });
        return;
      }
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
    // shrink gesture, handled in onContextMenuCapture). Isometric
    // (docs/specs/008-canvas/isometric-view.md) likewise: right-click-drag orbits the camera, so the
    // canvas / tab menu must never open in that tool or it interrupts
    // the orbit gesture. Avatar mode (docs/specs/008-canvas/avatar-mode.md) is read-only and mid-
    // narration: a menu popping open would interrupt the tour.
    if (canvasTool === 'spotlight' || canvasTool === 'isometric' || canvasTool === 'avatar') return;
    // A macOS Ctrl+click is a context click on the PRIMARY button, so its
    // pointerdown already armed a marquee (or pan) whose release would
    // deselect, and deselecting closes the menu this click is opening.
    // The press is a context click now, not a select: drop it.
    cancelPressGesture();
    rightClick.onContextMenu(e);
  };

  const onContextMenuPointerUp = rightClick.onPointerUp;

  const onPointerDown = (e: ReactPointerEvent) => {
    // A finger on a board's empty space pans, whatever the tool, and never opens the canvas menu
    // (hooks/canvas/pan-through.ts).
    if (isPanThrough(e)) {
      startPan(e);
      return;
    }
    // Touch press-and-hold on the empty canvas opens the context menu
    // (touch has no right-click). Armed before the marquee / pan logic;
    // a finger that moves cancels it, so it never fights a drag.
    canvasLongPress.onPointerDown(e);
    // Isometric (docs/specs/008-canvas/isometric-view.md): holding the RIGHT button and dragging orbits
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
    // Isometric (docs/specs/008-canvas/isometric-view.md): Shift-drag orbits the camera (spin + tilt)
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
    canvasLongPress,
    onPointerDownCapture,
    onContextMenuCapture,
    onContextMenu,
    onContextMenuPointerUp,
    onPointerDown,
    onWrapperPointerDown,
    onWrapperDoubleClick,
  };
}
