'use client';

// Measures the canvas, the chrome and the quick style panel, and places the
// panel clear of the chrome (docs/specs/008-canvas/quick-style-panel.md "Where it sits"). Re-runs when
// the chrome moves or resizes, coalesced to one run per frame; never on a timer.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { placeQuickStylePanel, type Rect } from '@/lib/quick-style-placement';

const AREA_SELECTOR = 'main[data-canvas-a11y-root]';
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

export function useQuickStylePlacement(
  panelRef: RefObject<HTMLElement | null>,
  active: boolean,
): { left: number; top: number } | null {
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null);

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
      const placed = placeQuickStylePanel({
        area: toRect(area.getBoundingClientRect()),
        panel: { width: box.width, height: box.height },
        obstacles,
      });
      if (placed.fallback) {
        console.debug('[quick-style] placement fallback', { obstacles: obstacles.length });
      }
      setSpot((prev) =>
        prev && prev.left === placed.left && prev.top === placed.top
          ? prev
          : { left: placed.left, top: placed.top },
      );
      // Watch whatever chrome exists now; a panel that mounts later arrives
      // with a pointer or key gesture, which re-runs this.
      resizeObserver.disconnect();
      for (const el of [area, panel, ...obstacleEls()]) resizeObserver.observe(el);
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
    const captured = ['pointerup', 'keyup', 'transitionend'] as const;
    for (const ev of captured) window.addEventListener(ev, schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      for (const ev of events) window.removeEventListener(ev, schedule);
      for (const ev of captured) window.removeEventListener(ev, schedule, true);
    };
  }, [active, panelRef]);

  return spot;
}
