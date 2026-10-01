'use client';

// How many tiles the Toolbar strip shows, from the strip's REAL sizes
// (docs/specs/007-editor/toolbar-layout.md "Twelve tiles is enough"): the chrome around the tiles (the
// pickers, More, dividers, padding: whatever they measure today, in whatever
// category), one tile's pitch, and the room the centred strip may take (the
// window less the Explorer menu button on both sides; on a phone, the window
// less its gutters). Nothing is assumed about how wide a picker is, so a
// longer category name or a new control keeps fitting.
//
// The rail of tiles animates its width when the category changes, so the
// chrome is the strip's width LESS the rail's current width: both move
// together, and their difference is steady through the animation. Until the
// first measurement the estimated limit (`fallback`) stands in.

import { useLayoutEffect, useState, type RefObject } from 'react';
import { fitStripTiles } from './toolbar-strip-tiles';

const PHONE_GUTTERS_PX = 24;
const MENU_GAP_PX = 8;

export function useStripTileLimit(
  cardRef: RefObject<HTMLElement | null>,
  {
    fallback,
    isMobile,
    scale,
  }: {
    fallback: number;
    isMobile: boolean;
    // The UI scale (docs/specs/007-editor/ui-scale.md). Everything here is
    // measured in screen px, so a scaled strip fits itself; the scale is only
    // a dependency, because a zoom change resizes no observed box.
    scale: number;
  },
): number {
  const [measured, setMeasured] = useState<number | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const rail = card.querySelector<HTMLElement>('[data-strip-rail]');
      const tile = rail?.querySelector<HTMLElement>('[data-rail-key]');
      if (!rail || !tile) return;
      const tileWidth = tile.getBoundingClientRect().width;
      const cardWidth = card.getBoundingClientRect().width;
      // A strip with no layout (hidden in zen or the welcome flow, or not yet
      // painted) measures zero everywhere; that would collapse the count to
      // the minimum, so keep the last good answer instead.
      if (tileWidth <= 0 || cardWidth <= 0) return;
      const gap = parseFloat(getComputedStyle(tile.parentElement!).columnGap) || 0;
      const pitch = tileWidth + gap;
      // The rail's negative side margins give its ring gutter back
      // (ToolbarStripRail), so its footprint in the card is width + margins.
      const railStyle = getComputedStyle(rail);
      const railFootprint =
        rail.getBoundingClientRect().width +
        (parseFloat(railStyle.marginLeft) || 0) +
        (parseFloat(railStyle.marginRight) || 0);
      const chrome = cardWidth - railFootprint;
      const vw = window.innerWidth;
      let available = vw - PHONE_GUTTERS_PX;
      if (!isMobile) {
        const menu = document.querySelector<HTMLElement>('[data-toolbar-menu]');
        const clear = menu ? menu.getBoundingClientRect().right + MENU_GAP_PX : 0;
        available = vw - 2 * clear;
      }
      setMeasured(fitStripTiles({ available, chrome, pitch }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [cardRef, isMobile, scale]);

  return measured ?? fallback;
}
