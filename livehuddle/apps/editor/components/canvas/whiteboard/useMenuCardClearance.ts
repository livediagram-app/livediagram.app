'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

// How far a top-docked Draw dock starts from the canvas's left edge (docs/specs/023-draw-mode/draw-mode.md "Where the
// dock sits"): 8px past the right edge of the menu card at the top left (`[data-toolbar-menu]`), whatever that card
// holds. The card carries the menu button, the editor mode switch (named, or its icon alone on a phone) and, on a
// computer, the tab's name, so its width is measured rather than assumed. In the dock's own CSS pixels: the dock
// draws at the toolbar UI scale (`scale`), so a screen length is divided by it. Null until measured (and where there
// is no card), when the dock's class fallbacks hold.
export const MENU_CARD_GAP_PX = 8;

export function menuCardClearance(card: DOMRect, container: DOMRect, scale: number): number {
  return (card.right - container.left + MENU_CARD_GAP_PX) / (scale > 0 ? scale : 1);
}

export function useMenuCardClearance(
  dock: RefObject<HTMLElement | null>,
  scale: number,
  active: boolean,
): number | null {
  const [clearance, setClearance] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const own = dock.current;
    const card = document.querySelector<HTMLElement>('[data-toolbar-menu]');
    const container = own?.offsetParent ?? own?.parentElement;
    if (!own || !card || !container) return;
    const measure = () => {
      const next = Math.round(
        menuCardClearance(card.getBoundingClientRect(), container.getBoundingClientRect(), scale),
      );
      setClearance((prev) => (prev === next ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // The card changes width when the tab is renamed or the switch's form changes: one observer, no per-frame work.
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [dock, scale, active]);
  return active ? clearance : null;
}
