'use client';

// Measures the canvas, the chrome and the quick style panel, and places the
// panel (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the left edge, vertically centred,
// clear of the chrome.
// Re-runs when the chrome moves or resizes, coalesced to one run per frame;
// never on a timer, and never while the chrome is still.

import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  placeQuickStylePanel,
  type QuickStyleLayout,
  type Rect,
} from '@/lib/quick-style-placement';
import { debugLog } from '@/lib/debug-log';

const AREA_SELECTOR = 'main[data-canvas-a11y-root]';
// The floating Palette panel, whose width the Floating layout's panel wears.
const PALETTE_SELECTOR = '[data-tour-id="palette"][data-floating-panel]';
// The Palette in each of its forms, every other floating panel or dock
// popover, the Toolbar strip's More popover and the bottom-right cluster.
const OBSTACLE_SELECTOR =
  '[data-tour-id="palette"], [data-toolbar-more], [data-floating-panel], [data-zoom-cluster]';

const toRect = (r: DOMRect): Rect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});

export type QuickStyleSpot = {
  left: number;
  top: number;
  // In the Floating layout, the panel takes the Palette's width.
  width: number | null;
};

export function useQuickStylePlacement(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
  layout: QuickStyleLayout,
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
    const paletteEl = () =>
      layout === 'floating' ? document.querySelector<HTMLElement>(PALETTE_SELECTOR) : null;

    const measure = () => {
      const obstacles = obstacleEls()
        .map((el) => toRect(el.getBoundingClientRect()))
        .filter((r) => r.width > 0 && r.height > 0);
      const palette = paletteEl();
      const anchorRect = palette ? toRect(palette.getBoundingClientRect()) : null;
      const anchor = anchorRect && anchorRect.width > 0 ? anchorRect : null;
      const box = panel.getBoundingClientRect();
      // The NATURAL height, not the capped one: measuring a scrolling panel
      // as if that were its size would lift the cap, and the next pass put
      // it back, forever.
      const body = panel.querySelector<HTMLElement>('[data-quick-style-body]');
      const natural = body ? box.height - body.clientHeight + body.scrollHeight : box.height;
      const width = anchor ? anchor.width : null;
      const placed = placeQuickStylePanel({
        area: toRect(area.getBoundingClientRect()),
        panel: { width: width ?? box.width, height: natural },
        obstacles,
      });
      if (placed.fallback) {
        debugLog('[quick-style] placement fallback', { layout, obstacles: obstacles.length });
      }
      setSpot((prev) =>
        prev && prev.left === placed.left && prev.top === placed.top && prev.width === width
          ? prev
          : { left: placed.left, top: placed.top, width },
      );
      // Watch whatever chrome exists now; a panel that mounts later arrives
      // with a pointer or key gesture, which re-runs this. Only newly seen
      // elements are observed: observe() always delivers an initial
      // notification, so re-observing every pass would re-run this forever.
      watchResizes(new Set<Element>([area, panel, ...obstacleEls()]));
      // A dragged Palette moves by its inline style: follow it live.
      if (palette !== watchedPalette) {
        mutationObserver.disconnect();
        watchedPalette = palette;
        if (palette)
          mutationObserver.observe(palette, {
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
      }
    };

    let resizeWatched = new Set<Element>();
    let watchedPalette: HTMLElement | null = null;
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
    const mutationObserver = new MutationObserver(schedule);
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
      mutationObserver.disconnect();
      for (const ev of events) window.removeEventListener(ev, schedule);
      for (const ev of captured) window.removeEventListener(ev, schedule, true);
      window.removeEventListener('transitionend', onTransitionEnd, true);
    };
  }, [active, panelRef, layout]);

  return spot;
}
