// Viewport state for the canvas: pan offset, zoom level, the wrapper
// ref every measurement reads through, and the zoom-ref the drag
// hook reads each pointer-move event. Owns the two helpers that
// translate between viewport space and canvas space
// (`getViewportCenter`) and that re-fit every element into view
// (`fitToScreen`). Lifted out of editor-page.tsx so the route file
// stays focused on orchestration; same depsRef pattern as
// useEditorDrag so the helpers always read fresh tab elements
// without re-creating themselves on every parent render.

import { createViewportStore, type ViewportStore } from '@/lib/viewport-store';
import type { Selection } from '@/lib/selection-store';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { isBoxed, unionBoxedBounds, type Tab } from '@livediagram/document';
import { computeFitToScreen, computeViewportCenter } from '@/lib/viewport';
import { viewIsCentredOn } from '@/lib/focus-audience';
import { useLatest } from '@/hooks/ui/useLatest';
import { glideViewport } from '@/lib/viewport-glide';

// Breakpoint at which we initialise the viewport at 60% zoom rather
// than 100%, so a mobile visitor lands on a usable overview instead
// of a single nodes-fill-the-screen view. 30% was too far out, the
// text on every element became unreadable; 60% keeps labels legible
// while still showing a workable chunk of canvas around the
// pointer. Deliberately wider than lib/responsive's MOBILE_BREAKPOINT_PX
// (640, the "dock the panels" line): tablets in the 640–768 band keep
// the desktop layout but still benefit from the zoomed-out overview, so
// this is its own constant rather than the shared one.
const OVERVIEW_ZOOM_BREAKPOINT_PX = 768;
const MOBILE_DEFAULT_ZOOM = 0.6;
const DESKTOP_DEFAULT_ZOOM = 1;

type EditorViewportDeps = {
  activeTab: Tab;
  // The selection, read when the board changes: a freshly added element scrolls into view on mobile
  // (the add handlers select what they create, in the same event, so the store already holds it).
  readSelection: () => Selection;
};

// Screen-px margins kept clear when scrolling an element into view: room
// above for the selection toolbar + top chrome, below for the tab bar /
// dock, and a little on the sides.
const VIEW_MARGIN_TOP = 96;
const VIEW_MARGIN_BOTTOM = 88;
const VIEW_MARGIN_SIDE = 20;

// When a new element is too big to fit the visible band at the current
// zoom, scrollIntoView zooms OUT (never in) so the WHOLE element shows.
// FIT_SAFETY leaves a sliver of padding inside the margins; MIN_FIT_ZOOM
// floors how far out we'll go for a very large element.
const FIT_SAFETY = 0.95;
const MIN_FIT_ZOOM = 0.2;

type EditorViewportApi = {
  // The view (pan offset in canvas-coords, zoom multiplier; 1 = 100%), held in a store so a pan or a
  // zoom renders the canvas, not the editor (docs/specs/008-canvas/blueprints/viewport-store.md).
  viewport: ViewportStore;
  setViewportOffset: ViewportStore['setOffset'];
  setViewportZoom: ViewportStore['setZoom'];
  // Same value as `viewportZoom` but mirrored into a ref so the
  // pointer-move handlers in useEditorDrag can invert the zoom
  // without re-attaching their listeners every time zoom changes.
  zoomRef: React.RefObject<number>;
  // The view's offset now, for a move that starts from wherever the view is (a glide).
  viewportOffsetRef: React.RefObject<{ x: number; y: number }>;
  // Wrapper element the canvas renders into. Its bounding-client
  // rect is the source of truth for "where is the viewport in
  // screen space?" and every helper here reads through it.
  canvasMainRef: React.RefObject<HTMLElement | null>;
  // Canvas-coord position of the viewport centre, used as the drop
  // point for "add a shape from the palette".
  getViewportCenter: () => { x: number; y: number };
  // Re-fit every boxed element on the active tab into the
  // viewport. Idempotent (the lastFittedTabRef gate in
  // editor-page.tsx still controls WHEN this runs).
  fitToScreen: () => void;
  // Frame an ARBITRARY rectangle. Presenting a slide (docs/specs/012-collaboration/presentation-mode.md) needs this:
  // the deck decides what is on screen, so the box to fit is the slide's
  // rather than the whole tab's.
  fitToBounds: (
    bbox: { x: number; y: number; w: number; h: number },
    opts?: { maxZoom?: number },
  ) => void;
  // Pan (and zoom out if needed) until the given canvas-coord bounds
  // are fully on screen. Used by the mobile add-element reveal and the
  // keyboard traversal's focus-follows-selection (docs/specs/004-interface-design/canvas-accessibility.md). With
  // `center: true` it always centres the bounds in the visible band
  // instead of the minimal edge-pull pan; the vote-results walkthrough
  // (docs/specs/012-collaboration/session-tools.md) uses that so every reviewed pick lands mid-screen.
  scrollIntoView: (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    // `sideMargin` (screen px) widens the side band to clear the floating
    // panels, for reveals that should land in the open canvas (a grown mind
    // node, docs/specs/009-elements/mind-node.md "Following the growth"). Capped at a quarter of the
    // canvas so a narrow window still has a band to reveal into.
    opts?: { center?: boolean; sideMargin?: number },
  ) => void;
  // Centre a canvas point at somebody else's zoom (docs/specs/012-collaboration/bring-focus.md).
  centreOn: (at: { x: number; y: number }, zoom: number) => void;
  // Is that point already what this view is showing, at about that zoom?
  isCentredOn: (at: { x: number; y: number }, zoom: number) => boolean;
};

export function useEditorViewport(deps: EditorViewportDeps): EditorViewportApi {
  const [viewport] = useState(() =>
    createViewportStore(
      typeof window !== 'undefined' && window.innerWidth <= OVERVIEW_ZOOM_BREAKPOINT_PX
        ? MOBILE_DEFAULT_ZOOM
        : DESKTOP_DEFAULT_ZOOM,
    ),
  );
  const { setZoom: setViewportZoom, setOffset: setViewportOffset } = viewport;
  // The view now, as read-only refs, for the readers that hold one (the drag hook, the glides).
  const [{ zoomRef, viewportOffsetRef }] = useState(() => ({
    zoomRef: {
      get current() {
        return viewport.get().zoom;
      },
    } as React.RefObject<number>,
    viewportOffsetRef: {
      get current() {
        return viewport.get().offset;
      },
    } as React.RefObject<{ x: number; y: number }>,
  }));
  const canvasMainRef = useRef<HTMLElement>(null);
  // depsRef means the helpers below can be stable across renders
  // (useCallback empty-dep) AND always read the latest activeTab.
  // The drag hook is the only consumer that holds a long-lived
  // reference; everyone else calls into the helpers fresh each
  // time, so this is mostly defensive.
  const depsRef = useLatest(deps);

  const getViewportCenter = useCallback(() => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return computeViewportCenter(rect, viewport.get().offset);
  }, [viewport]);

  // Smoothly bring an element (plus toolbar room) fully on-screen. If it
  // already fits the visible band, just pan the minimum to pull any
  // off-screen edge in. If it's too big to fit at the current zoom, zoom
  // OUT (never in) just enough that the WHOLE element shows, then centre
  // it. No-op if nothing needs to move. Used by the mobile new-element
  // scroll below. `center: true` skips the minimal-pan shortcut and
  // always centres the bounds in the band.
  const scrollIntoView = useCallback(
    (
      bx: number,
      by: number,
      bw: number,
      bh: number,
      opts?: { center?: boolean; sideMargin?: number },
    ) => {
      const rect = canvasMainRef.current?.getBoundingClientRect();
      if (!rect) return;
      const z0 = zoomRef.current;
      const off0 = viewportOffsetRef.current;
      const side = Math.min(opts?.sideMargin ?? VIEW_MARGIN_SIDE, rect.width / 4);
      // Visible band (screen px) we keep the element within.
      const visLeft = rect.left + side;
      const visRight = rect.right - side;
      const visTop = rect.top + VIEW_MARGIN_TOP;
      const visBottom = rect.bottom - VIEW_MARGIN_BOTTOM;
      const visW = Math.max(1, visRight - visLeft);
      const visH = Math.max(1, visBottom - visTop);

      // Zoom out to fit only when the element overflows the band at z0.
      const overflows = bw * z0 > visW || bh * z0 > visH;
      const z1 = overflows
        ? Math.max(MIN_FIT_ZOOM, Math.min(z0, Math.min(visW / bw, visH / bh) * FIT_SAFETY))
        : z0;

      // Canvas transform is `scale(z) translate(o)` with the scale centred
      // on the wrapper (`origin-center`, see Canvas.tsx), so a canvas point
      // p renders at screen x = rect.left + z*(p + off) + (W/2)*(1 - z). The
      // last term is 0 at z = 1 (desktop) but ~70-130px at the 0.6 mobile
      // zoom, so it MUST be included or the pan lands in the wrong place.
      // screenX / screenY map a canvas coord to screen px at a given zoom.
      const screenX = (cx: number, offX: number, z: number) =>
        rect.left + z * (cx + offX) + (rect.width / 2) * (1 - z);
      const screenY = (cy: number, offY: number, z: number) =>
        rect.top + z * (cy + offY) + (rect.height / 2) * (1 - z);

      let target: { x: number; y: number };
      if (z1 === z0 && !opts?.center) {
        // Fits at the current zoom: minimal pan to pull any off-screen edge
        // in. The centre-origin term is constant, so it cancels in the delta
        // (target = off + dxs/z) but is required for the off-screen test.
        const sl = screenX(bx, off0.x, z0);
        const st = screenY(by, off0.y, z0);
        const sr = sl + z0 * bw;
        const sb = st + z0 * bh;
        let dxs = 0;
        let dys = 0;
        if (sl < visLeft) dxs = visLeft - sl;
        else if (sr > visRight) dxs = visRight - sr;
        if (st < visTop) dys = visTop - st;
        else if (sb > visBottom) dys = visBottom - sb;
        if (dxs === 0 && dys === 0) return;
        target = { x: off0.x + dxs / z0, y: off0.y + dys / z0 };
      } else {
        // Zoomed to fit, or centring requested: centre the element in the
        // band so all of it shows. Invert screenX/screenY at z1 for the band
        // centre → the offset that puts the element centre there.
        const ecx = bx + bw / 2;
        const ecy = by + bh / 2;
        const bcx = (visLeft + visRight) / 2;
        const bcy = (visTop + visBottom) / 2;
        target = {
          x: (bcx - rect.left - (rect.width / 2) * (1 - z1)) / z1 - ecx,
          y: (bcy - rect.top - (rect.height / 2) * (1 - z1)) / z1 - ecy,
        };
        // Already centred (sub-pixel) and no zoom change: skip the animation.
        if (z1 === z0 && Math.abs(target.x - off0.x) < 0.5 && Math.abs(target.y - off0.y) < 0.5)
          return;
      }

      glideViewport(
        { zoom: z0, offset: off0 },
        { zoom: z1, offset: target },
        { zoom: setViewportZoom, offset: setViewportOffset },
      );
    },
    [setViewportOffset, setViewportZoom, viewportOffsetRef, zoomRef],
  );

  // Mobile: when a new element is added (the add handlers select it),
  // scroll it into view if it isn't fully visible. Tracks the id set so a
  // move / resize / remote change doesn't trigger it.
  const prevIdsRef = useRef<Set<string>>(new Set());
  const offFirstRunRef = useRef(true);
  // The scroll is the response, not a trigger: an effect event.
  const scrollToNew = useEffectEvent((x: number, y: number, w: number, h: number) =>
    scrollIntoView(x, y, w, h),
  );
  useEffect(() => {
    const els = deps.activeTab.elements;
    const ids = new Set(els.map((el) => el.id));
    const prev = prevIdsRef.current;
    prevIdsRef.current = ids;
    // Seed on the first run (tab load) without scrolling.
    if (offFirstRunRef.current) {
      offFirstRunRef.current = false;
      return;
    }
    if (typeof window === 'undefined' || window.innerWidth > OVERVIEW_ZOOM_BREAKPOINT_PX) return;
    const sel = deps.readSelection().selectedId;
    if (!sel || prev.has(sel) || !ids.has(sel)) return;
    const el = els.find((e) => e.id === sel);
    if (!el || !isBoxed(el)) return;
    scrollToNew(el.x, el.y, el.width, el.height);
  }, [deps.activeTab.elements, deps]);

  const fitToScreen = useCallback(() => {
    const rect = canvasMainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { activeTab } = depsRef.current;
    const boxedIds = new Set(activeTab.elements.filter(isBoxed).map((el) => el.id));
    if (boxedIds.size === 0) {
      setViewportOffset({ x: 0, y: 0 });
      setViewportZoom(1);
      return;
    }
    const bbox = unionBoxedBounds(activeTab.elements, boxedIds);
    if (!bbox) return;
    const { zoom, offset } = computeFitToScreen(rect, bbox);
    setViewportZoom(zoom);
    setViewportOffset(offset);
  }, [depsRef, setViewportOffset, setViewportZoom]);

  // Frame an ARBITRARY rectangle, which is what presenting a slide needs
  // (docs/specs/012-collaboration/presentation-mode.md): the deck decides what is on screen, so the box to fit is the
  // slide's, not the tab's. Same maths as fitToScreen, which is now the
  // special case "fit everything on this tab".
  // Centre a canvas point at a given zoom (docs/specs/012-collaboration/bring-focus.md). The zoom is somebody
  // else's, so this cannot go through fitToBounds, which derives one; the
  // point of Bring Focus is that everyone ends up seeing the same amount of
  // canvas as the person who pressed.
  const centreOn = useCallback(
    (at: { x: number; y: number }, zoom: number) => {
      const node = canvasMainRef.current;
      if (!node) return;
      // offsetWidth/Height rather than the transformed rect, for the reason
      // fitToBounds gives below.
      const rect = { width: node.offsetWidth, height: node.offsetHeight };
      setViewportZoom(zoom);
      // The offset is in CANVAS units, not screen ones: the zoom is applied
      // separately about the viewport's own centre, which is why
      // computeFitToScreen's offset has no zoom factor in it either. Multiplying
      // by the zoom here put everyone in the top-left corner of the canvas.
      setViewportOffset({ x: rect.width / 2 - at.x, y: rect.height / 2 - at.y });
    },
    [setViewportOffset, setViewportZoom],
  );

  // The inverse question: is this view ALREADY the one centreOn would give?
  // Bring Focus asks it before putting an invitation on screen, so a second
  // press re-asks the people who said no without pestering the ones who came
  // (docs/specs/012-collaboration/bring-focus.md).
  // The rule itself is shared with the presser's side of the press, which asks
  // the same thing of everyone else's published viewport.
  const isCentredOn = useCallback(
    (at: { x: number; y: number }, zoom: number) => {
      const node = canvasMainRef.current;
      if (!node) return false;
      return viewIsCentredOn(
        {
          size: { width: node.offsetWidth, height: node.offsetHeight },
          pan: viewportOffsetRef.current,
          zoom: zoomRef.current,
        },
        at,
        zoom,
      );
    },
    [viewportOffsetRef, zoomRef],
  );

  const fitToBounds = useCallback(
    (bbox: { x: number; y: number; w: number; h: number }, opts?: { maxZoom?: number }) => {
      const node = canvasMainRef.current;
      if (!node || bbox.w <= 0 || bbox.h <= 0) return;
      // offsetWidth/Height, NOT getBoundingClientRect: the latter reports the
      // TRANSFORMED box, and presenting (docs/specs/012-collaboration/presentation-mode.md) animates the canvas surface
      // with a scale on entry. Measuring mid-animation therefore fitted the
      // slide to a shrunken viewport, and it painted off-centre by exactly the
      // difference once the animation finished. The layout size is what the
      // slide will actually occupy.
      const rect = { width: node.offsetWidth, height: node.offsetHeight };
      const { zoom, offset } = computeFitToScreen(
        rect,
        { x: bbox.x, y: bbox.y, width: bbox.w, height: bbox.h },
        opts?.maxZoom,
      );
      setViewportZoom(zoom);
      setViewportOffset(offset);
    },
    [setViewportOffset, setViewportZoom],
  );

  return {
    viewport,
    setViewportOffset,
    setViewportZoom,
    zoomRef,
    viewportOffsetRef,
    canvasMainRef,
    getViewportCenter,
    fitToScreen,
    fitToBounds,
    centreOn,
    isCentredOn,
    scrollIntoView,
  };
}
