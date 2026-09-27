'use client';

// Measures the canvas, the chrome and the quick style panel, and places the
// panel (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): docked under the Palette in the
// Floating layout, on the right edge otherwise, clear of the chrome either way.
// Re-runs when the chrome moves or resizes, coalesced to one run per frame;
// never on a timer.

import { useLayoutEffect, useState, type RefObject } from 'react';
import {
  placeQuickStylePanel,
  type QuickStyleLayout,
  type Rect,
} from '@/lib/quick-style-placement';

const AREA_SELECTOR = 'main[data-canvas-a11y-root]';
// The floating Palette panel: the one the Floating layout docks under. In the
// Toolbar layout the same id marks the strip, which the layout rule ignores.
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
  // Docked under the Palette, the panel takes the Palette's width.
  width: number | null;
  // Docked into too short a space, the panel caps its height and scrolls.
  maxHeight: number | null;
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
        layout,
        area: toRect(area.getBoundingClientRect()),
        panel: { width: width ?? box.width, height: natural },
        obstacles,
        anchor,
      });
      if (placed.fallback) {
        console.debug('[quick-style] placement fallback', { layout, obstacles: obstacles.length });
      }
      const maxHeight = placed.maxHeight ?? null;
      setSpot((prev) =>
        prev &&
        prev.left === placed.left &&
        prev.top === placed.top &&
        prev.width === width &&
        prev.maxHeight === maxHeight
          ? prev
          : { left: placed.left, top: placed.top, width, maxHeight },
      );
      // Watch whatever chrome exists now; a panel that mounts later arrives
      // with a pointer or key gesture, which re-runs this.
      resizeObserver.disconnect();
      for (const el of [area, panel, ...obstacleEls()]) resizeObserver.observe(el);
      // A dragged Palette moves by its inline style: follow it live.
      mutationObserver.disconnect();
      if (palette)
        mutationObserver.observe(palette, {
          attributes: true,
          attributeFilter: ['style', 'class'],
        });
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
    const captured = ['pointerup', 'keyup', 'transitionend'] as const;
    for (const ev of captured) window.addEventListener(ev, schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      for (const ev of events) window.removeEventListener(ev, schedule);
      for (const ev of captured) window.removeEventListener(ev, schedule, true);
    };
  }, [active, panelRef, layout]);

  return spot;
}
