import {
  useRef,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import { isDoubleTapZoomPointer } from '@liveworkspace/workbench/lib/double-tap-zoom';
import { createEraseFrameReader } from '@/lib/erase-frame';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { peerPushTarget } from '@liveworkspace/avatar/walk';
import { avatarScale, parseAvatarConfig } from '@liveworkspace/avatar/config';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import type { useCanvasPanAndMarquee } from '@/hooks/canvas/useCanvasPanAndMarquee';
import type { useAvatarWalk } from '@liveworkspace/avatar/hooks/useAvatarWalk';
import { useLongPress } from '@liveworkspace/workbench/hooks/ui/useLongPress';
import { useRightClickRelease } from '@liveworkspace/workbench/hooks/canvas/useRightClickRelease';
import { isHeldPenIntent } from '@/lib/draw-mode';
import { markPenSeen, penSeen } from '@/lib/pen-seen';
import { whiteboardPointerRoute } from '@/lib/whiteboard-tool';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isPanThrough, panThroughTap } from '@liveworkspace/workbench/hooks/canvas/pan-through';
import { isPieceControlPress } from '@/lib/piece-control';
import {
  avatarClickIntent,
  elementClickKind,
  isInPlacePress,
  pressPieceMain,
} from '@/lib/avatar-click-intent';
import { elementAt, onPaintedText } from '@/lib/avatar-press-target';
import { avatarDoorPress } from '@/lib/avatar-door-press';
import type { Element as CanvasElement } from '@livehuddle/document';

type PanAndMarquee = ReturnType<typeof useCanvasPanAndMarquee>;

// The bottom-right cluster (Undo / Redo, Layers, Theme & Canvas, Zoom) is chrome, never canvas.
// Its buttons stop the press only in the bubble phase, after the capture intercept: without this,
// a held Draw mode marker inked a dot under Undo and the click then undid that dot instead of the
// stroke the person meant (and an armed eraser or shape acted under the button too).
const inCornerCluster = (target: EventTarget | null): boolean =>
  !!(target as Element | null)?.closest?.('[data-zoom-cluster]');

// How presses on the bare canvas surface route between the tools
// (docs/specs/008-canvas/canvas-and-palette.md), lifted out of Canvas's JSX: the capture-phase
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
  avatar,
  peerAvatars,
  onPushPeer,
  elements,
  onToggleDoor,
  onReadElement,
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
  avatar: ReturnType<typeof useAvatarWalk>;
  // Peers' characters on this tab (docs/specs/008-canvas/avatar-mode.md), so a click can land on one.
  peerAvatars: CanvasProps['remoteAvatars'];
  // Shove a peer: fired once our character has walked up to theirs.
  onPushPeer?: (targetId: string, dx: number, dy: number) => void;
  // The tab's elements, for the Door under a walking click (lib/avatar-door-press), and the swing it may ask for:
  // false when the viewer may not swing that door (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
  elements?: readonly CanvasElement[];
  onToggleDoor?: (doorId: string) => boolean;
  // Open an element large in the reader (docs/specs/008-canvas/avatar-mode.md "The reader").
  onReadElement?: (elementId: string) => void;
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
  //  - Pan tool / Space → drag scrolls.
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
    const wantsPan = spaceHeldRef.current || canvasTool === 'pan';
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
    // A piece's own control (the Notice Board's Notes button, the Jukebox's Play) is the control's: no walk, erase,
    // marquee or draw starts on it (lib/piece-control).
    if (isPieceControlPress(e.target)) return;
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
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md): a non-editing presenter mode where a primary
    // click means "walk over there". Handled in the capture phase for the
    // same reason: the canvas layer is pointer-inert, but arrow
    // hit-bands re-enable themselves via `pointer-events: stroke` and select
    // on ANY button, so we swallow the secondary button too. Middle-mouse
    // (pan) and held-Space (temporary pan) fall through untouched.
    if (canvasTool === 'avatar' && !spaceHeldRef.current && e.button !== 1) {
      // A talker's bars are a button of their own (docs/specs/012-collaboration/proximity-audio.md): its press walks
      // over, so it is not a walk to the spot under it.
      if (e.target instanceof Element && e.target.closest('[data-talking-bars]')) return;
      // A piece with something to do in place (a Directory, an Elevator, a Notice Board): its own press opens it,
      // and the character stays put (docs/specs/008-canvas/avatar-mode.md "Clicking a piece"). Its click still
      // reaches the face; only the press is kept from the element, which would select or drag it.
      if (e.button === 0 && isInPlacePress(e.target)) {
        e.stopPropagation();
        return;
      }
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
        const { clientX, clientY } = e;
        // Seated, the walk stands you up first (docs/specs/009-elements/chair.md "Any movement stands you up").
        const walk = () => {
          // Clicking someone ELSE's character walks over and pushes them
          // (docs/specs/008-canvas/avatar-mode.md), rather than walking to the spot they're standing on.
          const peer = peerAvatarAt(point);
          if (peer) {
            // A seated character cannot be pushed (docs/specs/009-elements/chair.md "Sitting"): walk up to them only.
            const seated = peerAvatars.some((p) => p.id === peer.id && p.avatar.seatedOn);
            avatar.walkTo(
              peer.standAt,
              seated ? undefined : () => onPushPeer?.(peer.id, peer.dx, peer.dy),
            );
            return;
          }
          // A Door: next to it the click swings it where you stand; farther away (or a Viewer) it walks you to its
          // near side and swings nothing (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
          const door =
            elements && avatar.pos
              ? avatarDoorPress(elements, point, avatar.pos, viewportZoom)
              : null;
          if (door) {
            if (door.next && onToggleDoor?.(door.doorId)) return;
            avatar.walkTo(door.nearSide);
            return;
          }
          // The piece under the click, from its footprint (the layer is pointer-inert): only a `walk` kind is
          // walked to; a `use` piece does its main action (or opens in the reader when it has none right now), and a
          // `read` element opens in the reader (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
          const hit = elements
            ? elementAt(
                elements,
                point,
                (el) => el.type !== 'text' || onPaintedText(el.id, clientX, clientY),
              )
            : null;
          const intent = hit ? avatarClickIntent(elementClickKind(hit)) : 'walk';
          if (hit && intent !== 'walk') {
            if (intent === 'use' && pressPieceMain(hit.id)) return;
            onReadElement?.(hit.id);
            return;
          }
          avatar.walkTo(point);
        };
        // A finger has no middle button or Space to pan with (docs/specs/008-canvas/avatar-mode.md "Walking"):
        // its drag pans, and only a press that never moved, a tap, walks.
        if (e.pointerType === 'touch') startPan(e, walk);
        else walk();
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

  const onContextMenuCapture = (_e: ReactMouseEvent) => {};

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
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md) is read-only and mid-
    // narration: a menu popping open would interrupt the tour.
    if (canvasTool === 'avatar') return;
    // A macOS Ctrl+click is a context click on the PRIMARY button, so its
    // pointerdown already armed a marquee (or pan) whose release would
    // deselect, and deselecting closes the menu this click is opening.
    // The press is a context click now, not a select: drop it.
    cancelPressGesture();
    rightClick.onContextMenu(e);
  };

  const onContextMenuPointerUp = rightClick.onPointerUp;

  const onPointerDown = (e: ReactPointerEvent) => {
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
  // (Avatar) give every press on <main> a meaning of their own.
  const onSurfaceDoubleClick = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget || !pressedByFinger()) return;
    if (canvasTool === 'avatar') return;
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
  };
}
