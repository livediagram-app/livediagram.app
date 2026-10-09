'use client';

// Measures the canvas, the chrome and the quick style panel, and places the
// panel (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the left edge, vertically centred,
// clear of the chrome.
// Re-runs when the chrome moves or resizes, coalesced to one run per frame;
// never on a timer, and never while the chrome is still.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { placeQuickStylePanel, type Rect } from '@/lib/quick-style-placement';
import { debugLog } from '@/lib/debug-log';

const AREA_SELECTOR = 'main[data-canvas-a11y-root]';
// The palette strip, every panel or dock popover, the strip's More popover
// and the bottom-right cluster.
const OBSTACLE_SELECTOR =
  '[data-tour-id="palette"], [data-toolbar-more], [data-floating-panel], [data-zoom-cluster]';

const toRect = (r: DOMRect): Rect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

export type QuickStyleSpot = { left: number; top: number };

export function useQuickStylePlacement(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
): QuickStyleSpot | null {
  const [spot, setSpot] = useState<QuickStyleSpot | null>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    const area = document.querySelector(AREA_SELECTOR);
    if (!panel || !area) return;

    const obstacleEls = () =>
      Array.from(document.querySelectorAll<HTMLElement>(OBSTACLE_SELECTOR)).filter(
        (el) => el !== panel && !panel.contains(el) && !el.contains(panel),
      );

    const measure = () => {
      const obstacles = obstacleEls()
        .map((el) => toRect(el.getBoundingClientRect()))
        .filter((r) => r.width > 0 && r.height > 0);
      const box = panel.getBoundingClientRect();
      // The panel never scrolls (one compact form), so its box is its natural size.
      const placed = placeQuickStylePanel({
        area: toRect(area.getBoundingClientRect()),
        panel: { width: box.width, height: box.height },
        obstacles,
      });
      if (placed.fallback) {
        debugLog('[quick-style] placement fallback', { obstacles: obstacles.length });
      }
      // Whole pixels: a centred panel otherwise lands on a half pixel and every glyph in it blurs
      // (docs/specs/007-editor/toolbar-layout.md "Look").
      const left = Math.round(placed.left);
      const top = Math.round(placed.top);
      setSpot((prev) => (prev && prev.left === left && prev.top === top ? prev : { left, top }));
      // Watch whatever chrome exists now; a panel that mounts later arrives
      // with a pointer or key gesture, which re-runs this. Only newly seen
      // elements are observed: observe() always delivers an initial
      // notification, so re-observing every pass would re-run this forever.
      watchResizes(new Set<Element>([area, panel, ...obstacleEls()]));
    };

    let resizeWatched = new Set<Element>();
    const watchResizes = (next: Set<Element>) => {
      for (const el of resizeWatched) if (!next.has(el)) resizeObserver.unobserve(el);
      for (const el of next) if (!resizeWatched.has(el)) resizeObserver.observe(el);
      resizeWatched = next;
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    const resizeObserver = new ResizeObserver(schedule);
    measure();
    const events = ['resize', 'livediagram:panel-layout-changed'] as const;
    for (const ev of events) window.addEventListener(ev, schedule);
    const captured = ['pointerup', 'keyup'] as const;
    for (const ev of captured) window.addEventListener(ev, schedule, true);
    // A transition re-places only when it ran on the chrome itself: one ending anywhere on the
    // canvas (a fading toolbar, a hover) moves nothing this watches, and must not cost a layout
    // read mid-gesture (docs/specs/008-canvas/canvas-performance.md).
    const onTransitionEnd = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (panel.contains(target) || target.closest(OBSTACLE_SELECTOR)) schedule();
    };
    window.addEventListener('transitionend', onTransitionEnd, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      for (const ev of events) window.removeEventListener(ev, schedule);
      for (const ev of captured) window.removeEventListener(ev, schedule, true);
      window.removeEventListener('transitionend', onTransitionEnd, true);
    };
  }, [active, panelRef]);

  return spot;
}
