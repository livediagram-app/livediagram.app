'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react';
import {
  anchorFromPaneView,
  fitView,
  panBy,
  paneViewFromAnchor,
  zoomAbout,
  type CanvasAnchor,
  type PaneView,
} from '@/lib/split-pane-view';
import type { TabSvg } from './useTabSvg';

// What the split frame reads off a pane when the editor moves into it: where its canvas sits, so
// the editor can take over the exact view.
export type TabSvgViewportHandle = { anchor: () => CanvasAnchor | null };

// The static pane's canvas (docs/specs/007-editor/split-view.md "The other pane"): the tab's
// drawing on its own paper and pattern, laid out in canvas space the way the editor lays it out.
// Scroll pans, Ctrl or Cmd + scroll (and a trackpad pinch) zooms about the pointer. It opens on
// `initialAnchor` (the view the editor had when it left this tab) or, without one, fitted; until
// the person moves it, it stays fitted as the drawing grows.
export function TabSvgViewport({
  svg,
  fitNonce,
  initialAnchor = null,
  backdrop,
  handleRef,
  children,
}: {
  svg: TabSvg;
  // Bumped by the Fit button.
  fitNonce: number;
  initialAnchor?: CanvasAnchor | null;
  // The paper and pattern for a canvas whose origin sits at `origin` (pane px) at zoom `k`.
  backdrop?: (origin: { x: number; y: number }, k: number) => CSSProperties;
  handleRef?: Ref<TabSvgViewportHandle>;
  children?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<PaneView | null>(null);
  const touched = useRef(false);

  useImperativeHandle(
    handleRef,
    () => ({
      anchor: () => {
        const host = hostRef.current;
        if (!host || !view) return null;
        return anchorFromPaneView(view, host.getBoundingClientRect(), svg.origin);
      },
    }),
    [view, svg.origin],
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setBox({ w: host.clientWidth, h: host.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // The first view: the editor's, handed over, so the drawing doesn't move as the editor leaves.
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (placed.current || !initialAnchor || !hostRef.current) return;
    placed.current = true;
    touched.current = true;
    setView(paneViewFromAnchor(initialAnchor, hostRef.current.getBoundingClientRect(), svg.origin));
  }, [initialAnchor, svg.origin]);

  // Refit on a new pane size, a Fit press, or (until the person moves it) a drawing that changed size.
  const lastFit = useRef(fitNonce);
  useLayoutEffect(() => {
    if (box.w === 0 || box.h === 0) return;
    const forced = lastFit.current !== fitNonce;
    lastFit.current = fitNonce;
    if (forced) touched.current = false;
    if (touched.current && !forced) return;
    setView(fitView(box, { w: svg.width, h: svg.height }));
  }, [box, svg.width, svg.height, fitNonce]);

  // A drawing whose canvas origin moved (a shape added above or left of everything grows the SVG
  // that way) keeps every element where it was on screen.
  const lastOrigin = useRef(svg.origin);
  useLayoutEffect(() => {
    const prev = lastOrigin.current;
    lastOrigin.current = svg.origin;
    if (prev === svg.origin || !touched.current) return;
    const dx = svg.origin.x - prev.x;
    const dy = svg.origin.y - prev.y;
    if (dx || dy) setView((v) => (v ? panBy(v, dx * v.k, dy * v.k) : v));
  }, [svg.origin]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    touched.current = true;
    const rect = hostRef.current!.getBoundingClientRect();
    setView((v) => {
      if (!v) return v;
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinches arrive as ctrl + small deltas; a wheel notch as ~100.
        const factor = Math.exp(-e.deltaY * 0.0025);
        return zoomAbout(v, factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      return panBy(v, -e.deltaX, -e.deltaY);
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Not passive: the page must not scroll (or the browser zoom) under the pane.
    host.addEventListener('wheel', onWheel, { passive: false });
    return () => host.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // Where canvas point (0, 0) sits in the pane, for the world-space pattern.
  const canvasOrigin = view
    ? { x: view.x - view.k * svg.origin.x, y: view.y - view.k * svg.origin.y }
    : { x: 0, y: 0 };

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full overflow-hidden"
      style={backdrop ? backdrop(canvasOrigin, view?.k ?? 1) : { backgroundColor: svg.background }}
    >
      {view ? (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 origin-top-left [&>svg]:block [&>svg>rect:first-of-type]:hidden"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
          // The export renderer's own markup: every piece of text in it is escaped there. Its own
          // background rect is hidden: the pane paints the paper (and pattern) edge to edge.
          dangerouslySetInnerHTML={{ __html: svg.markup }}
        />
      ) : null}
      {children}
    </div>
  );
}
