// The gallery's columns (docs/specs/007-editor/pages-mode.md "The layout gallery"): as many as
// the measured width holds at `minTile` each with `gap` between, at least two, and each tile's
// width. Re-measured as the host resizes (a phone turning, a card growing with the zoom).
import { useLayoutEffect, useRef, useState } from 'react';

// Before the first measure (and where nothing measures, a test): two tiles of this width.
const FALLBACK_WIDTH = 168;
const MIN_COLS = 2;

/** Columns and tile width for a row `width` wide. Pure, for the tests. */
export function tileColumns(
  width: number,
  minTile: number,
  gap: number,
): { cols: number; tileWidth: number } {
  if (width <= 0) return { cols: MIN_COLS, tileWidth: FALLBACK_WIDTH };
  const cols = Math.max(MIN_COLS, Math.floor((width + gap) / (minTile + gap)));
  return { cols, tileWidth: (width - gap * (cols - 1)) / cols };
}

export function useTileWidth(minTile: number, gap: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setWidth(el.clientWidth);
    // Whole pixels only, so a sub-pixel jitter never redraws every tile.
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...tileColumns(width, minTile, gap) };
}
