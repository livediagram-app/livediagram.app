'use client';

// A swiping strip's dividers (docs/specs/007-editor/toolbar-layout.md "On a phone"): a divider
// separates two tiles, so it shows only while a tile on each side of it is at least partly in
// view. Scrolled to where the tiles after it are out of sight, it would sit alone at the rail's
// edge, beside More's own divider. Re-checked as the rail scrolls, resizes or its tiles change.
import { useLayoutEffect, type RefObject } from 'react';

// The marker the strip's dividers carry (ToolbarPalette's Divider).
export const STRIP_DIVIDER_ATTR = 'data-strip-divider';

export function useEdgeDividers(
  railRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  // Changes when the rail's items do, so a new set of dividers is checked at once.
  itemsKey: string,
) {
  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!enabled || !rail) return;
    const sync = () => {
      const left = rail.scrollLeft;
      const right = left + rail.clientWidth;
      const items = Array.from(rail.querySelectorAll<HTMLElement>('[data-rail-key]'));
      items.forEach((item, i) => {
        const divider = item.querySelector<HTMLElement>(`[${STRIP_DIVIDER_ATTR}]`);
        if (!divider) return;
        // A rail item's offsetLeft is against the rail (its nearest positioned ancestor), the
        // same frame as scrollLeft.
        const ownVisible = item.offsetLeft < right && item.offsetLeft + item.offsetWidth > left;
        const next = items[i + 1];
        const nextVisible = !!next && next.offsetLeft < right - 1;
        divider.style.visibility = ownVisible && nextVisible ? '' : 'hidden';
      });
    };
    sync();
    rail.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(rail);
    return () => {
      rail.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [railRef, enabled, itemsKey]);
}
