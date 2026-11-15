'use client';

// The canvas zoom, for the parts of an element that are counter-scaled to stay a constant size on
// screen: grips, badges, hit bands, the edit toolbar (docs/specs/008-canvas/canvas-performance.md).
// A zoom re-renders those consumers only; the element views around them, which take no zoom, keep
// their last render. Outside a provider the zoom is 1.
//
// Two lighter ways to follow the zoom exist for the parts a large board carries by the thousand (a vote dot on
// every note): `useSettledZoomSelector` re-renders only when what it derives from the zoom changes, and asks only once
// the zoom stops, and `ZoomFollowing` keeps a counter-scale without rendering at all, and without touching its element
// on each step: it rides with the board while the zoom moves and settles to its size on screen when the zoom stops. A
// vote open on 2,000 notes cost about 70 ms more per zoom frame in Chromium while each dot rendered and re-scaled on
// every step (Work Tracker 778), and asking its 4,000 selectors on each step was most of what remained (Work Tracker
// 885). `useCanvasZoomSelector` asks on every step, for the few parts that change shape mid-zoom.

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';

// The zoom as something to subscribe to, so a part can read it without being rendered for each step.
type ZoomStore = {
  zoom: number;
  listeners: Set<() => void>;
  settled: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
};

// How long the zoom stands still before the parts that follow it by settling take their size.
export const ZOOM_SETTLE_MS = 120;
const ZoomStoreContext = createContext<ZoomStore | null>(null);
const CanvasZoomContext = createContext(1);

// A zoom step, told to the store: what to draw at now, then the listeners, then (once the zoom stands still) the
// parts that settle. Plain functions on the store, so the provider only calls them.
function readZoom(store: ZoomStore, zoom: number): void {
  store.zoom = zoom;
}

function announceZoom(store: ZoomStore): void {
  for (const listener of [...store.listeners]) listener();
  if (store.timer !== null) clearTimeout(store.timer);
  store.timer = setTimeout(() => {
    store.timer = null;
    for (const listener of [...store.settled]) listener();
  }, ZOOM_SETTLE_MS);
}

function stopSettling(store: ZoomStore): void {
  if (store.timer !== null) clearTimeout(store.timer);
}

export function CanvasZoomProvider({ zoom, children }: { zoom: number; children: ReactNode }) {
  const [store] = useState<ZoomStore>(() => ({
    zoom,
    listeners: new Set(),
    settled: new Set(),
    timer: null,
  }));
  // Read while rendering, so a part mounted by this very render draws at this zoom; the listeners hear of it once
  // it commits.
  readZoom(store, zoom);
  useLayoutEffect(() => announceZoom(store), [store, zoom]);
  useLayoutEffect(() => () => stopSettling(store), [store]);
  return (
    <ZoomStoreContext.Provider value={store}>
      <CanvasZoomContext.Provider value={zoom}>{children}</CanvasZoomContext.Provider>
    </ZoomStoreContext.Provider>
  );
}

export function useCanvasZoom(): number {
  return useContext(CanvasZoomContext);
}

/**
 * Something derived from the zoom (a boolean, a string), read without rendering for every zoom step: the part
 * renders again only when `select`'s answer changes. `select` must be cheap and pure, as it runs for each part on
 * each step.
 */
export function useCanvasZoomSelector<T extends string | number | boolean | null>(
  select: (zoom: number) => T,
): T {
  const store = useContext(ZoomStoreContext);
  const subscribe = useCallback(
    (onChange: () => void) => {
      store?.listeners.add(onChange);
      return () => {
        store?.listeners.delete(onChange);
      };
    },
    [store],
  );
  return useSyncExternalStore(
    subscribe,
    () => select(store?.zoom ?? 1),
    () => select(1),
  );
}

/**
 * Like `useCanvasZoomSelector`, but asked only once the zoom has stood still for ZOOM_SETTLE_MS, never on a zoom
 * step: for the parts a board carries by the thousand, which ride with the board while the zoom moves
 * (`ZoomFollowing`) and so change shape when they take their size on screen, not mid-pinch. A zoom step then walks
 * none of them (a vote open on 2,000 notes asked 4,000 selectors on every step; Work Tracker 885).
 */
export function useSettledZoomSelector<T extends string | number | boolean | null>(
  select: (zoom: number) => T,
): T {
  const store = useContext(ZoomStoreContext);
  const subscribe = useCallback(
    (onChange: () => void) => {
      store?.settled.add(onChange);
      return () => {
        store?.settled.delete(onChange);
      };
    },
    [store],
  );
  return useSyncExternalStore(
    subscribe,
    () => select(store?.zoom ?? 1),
    () => select(1),
  );
}

// A div counter-scaled to keep its size on screen. It reads the zoom itself, so whatever renders it
// takes no zoom and does not render for one.
export function CounterScaled({ style, ...props }: ComponentProps<'div'>) {
  const zoom = useCanvasZoom();
  return <div {...props} style={{ ...style, transform: `scale(${1 / zoom})` }} />;
}

// A div counter-scaled like `CounterScaled`, that follows the zoom by writing its own transform and never renders for
// it: for the parts a board carries by the thousand. The transform is set before the first paint and again when the
// zoom has stood still for ZOOM_SETTLE_MS, so while a pinch or a wheel moves it the part rides with the board and
// costs nothing per frame (re-scaling 2,000 parts every frame cost about 30 ms of the browser's own work).
export function ZoomFollowing({ ref: outer, ...props }: ComponentProps<'div'>) {
  const store = useContext(ZoomStoreContext);
  const own = useRef<HTMLDivElement | null>(null);
  // The caller's ref (a stepper's, to find its buttons) and this one's both reach the element.
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      own.current = el;
      if (typeof outer === 'function') outer(el);
      else if (outer) outer.current = el;
    },
    [outer],
  );
  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return;
    const apply = () => {
      el.style.transform = `scale(${1 / (store?.zoom ?? 1)})`;
    };
    apply();
    store?.settled.add(apply);
    return () => {
      store?.settled.delete(apply);
    };
  }, [store]);
  return <div {...props} ref={setRef} />;
}
