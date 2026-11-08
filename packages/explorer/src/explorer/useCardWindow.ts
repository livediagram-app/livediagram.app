'use client';

// Which item cards of a long card grid are on screen, so only those (and a few rows either side) are in the DOM
// (liveworkspace/docs/specs/004-index/one-explorer.md "Long lists"). The grid's folders all draw, and so do the items
// on the row the last folder shares; from the first row of items only, every row is as tall as the one before (an
// item card's height is fixed by its preview box and its lines), so the rows on screen follow by arithmetic from
// where that run starts. Spacers stand in for the rows above and below.
//
// It reads the grid's columns and row gap from its computed style and one item card's height, once per layout
// change (a ResizeObserver on the grid), and the run's place in the viewport on each scroll frame (a capture-phase
// listener hears whichever element scrolls). Without layout (tests, server) nothing is measured and every card
// draws, as before.

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Rows kept either side of the screen: a fast flick lands on drawn cards.
export const CARD_OVERSCAN_ROWS = 3;

export type CardWindow = {
  // The items on the last folder row, always drawn: [0, shared).
  shared: number;
  // Then the run's items drawn (indices into the items, not the grid): [start, end).
  start: number;
  end: number;
  // Rows of items standing in above and below, and the height of one row plus its gap.
  rowsBefore: number;
  rowsAfter: number;
  pitch: number;
  gap: number;
};

type Metrics = { cols: number; pitch: number; gap: number };

/** The window's maths, apart from the DOM: which items of `count` draw with the run of item-only rows starting
 *  `runTop` px below the viewport's top. Exported for the tests. */
export function cardWindowOf(args: {
  folders: number;
  count: number;
  metrics: Metrics | null;
  runTop: number;
  viewport: number;
}): CardWindow {
  const { folders, count, metrics, runTop, viewport } = args;
  if (!metrics || metrics.pitch <= 0 || metrics.cols < 1)
    return { shared: 0, start: 0, end: count, rowsBefore: 0, rowsAfter: 0, pitch: 0, gap: 0 };
  const { cols, pitch, gap } = metrics;
  // The items that share the last folder row always draw; the run of item-only rows starts after them.
  const shared = Math.min(count, (cols - (folders % cols)) % cols);
  const runRows = Math.ceil((count - shared) / cols);
  const first = Math.floor(Math.max(0, -runTop) / pitch) - CARD_OVERSCAN_ROWS;
  const last = Math.ceil(Math.max(0, viewport - runTop) / pitch) + CARD_OVERSCAN_ROWS;
  const startRow = Math.max(0, Math.min(runRows, first));
  const endRow = Math.max(startRow, Math.min(runRows, last));
  return {
    shared,
    start: shared + startRow * cols,
    end: Math.min(count, shared + endRow * cols),
    rowsBefore: startRow,
    rowsAfter: runRows - endRow,
    pitch,
    gap,
  };
}

const sameWindow = (a: CardWindow, b: CardWindow) =>
  a.shared === b.shared &&
  a.start === b.start &&
  a.end === b.end &&
  a.rowsBefore === b.rowsBefore &&
  a.rowsAfter === b.rowsAfter &&
  a.pitch === b.pitch &&
  a.gap === b.gap;

/**
 * The card window for a grid (`grid`) of `folders` folder cards then `count` item cards. `runStart` finds the first
 * element of the item-only run as drawn: the spacer above it when there is one, else its first card. Item cards
 * carry `data-item-card`, which is how one is found to measure: the last drawn, which is in the run (a card on the
 * last folder row is as tall as that row, which a folder card may set).
 */
export function useCardWindow(
  grid: RefObject<HTMLElement | null>,
  folders: number,
  count: number,
  runStart: () => HTMLElement | null,
): CardWindow {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  // Where the run sat when the window last moved: kept only when the window it gives differs, so a scroll within a
  // row costs a rect read and no render.
  const [place, setPlace] = useState({ runTop: 0, viewport: 0 });
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;
  const runStartRef = useRef(runStart);
  runStartRef.current = runStart;

  // The grid's shape: its columns, its row gap and an item card's height. Read again when the grid resizes (a
  // rotation, the sidebar opening, a breakpoint) and when the cards first arrive.
  useIsoLayoutEffect(() => {
    const el = grid.current;
    if (!el || typeof window === 'undefined') return;
    const measure = () => {
      const style = getComputedStyle(el);
      const tracks = style.gridTemplateColumns.trim();
      const cols = tracks && tracks !== 'none' ? tracks.split(/\s+/).length : 0;
      const gap = parseFloat(style.rowGap) || 0;
      const drawn = el.querySelectorAll<HTMLElement>('[data-item-card]');
      const card = drawn[drawn.length - 1];
      const height = card ? card.getBoundingClientRect().height : 0;
      const next = cols > 0 && height > 0 ? { cols, pitch: height + gap, gap } : null;
      const prev = metricsRef.current;
      if (
        prev === next ||
        (prev &&
          next &&
          prev.cols === next.cols &&
          prev.pitch === next.pitch &&
          prev.gap === next.gap)
      )
        return;
      setMetrics(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [grid, count > 0]);

  const next = cardWindowOf({ folders, count, metrics, ...place });
  const last = useRef(next);
  if (!sameWindow(last.current, next)) last.current = next;

  // Where the run is, on each scroll frame and resize: a state update only when the window moves.
  useIsoLayoutEffect(() => {
    if (!metrics) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const el = runStartRef.current();
      if (!el) return;
      const at = { runTop: el.getBoundingClientRect().top, viewport: window.innerHeight || 0 };
      if (!sameWindow(cardWindowOf({ folders, count, metrics, ...at }), last.current)) setPlace(at);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [metrics, folders, count]);

  return last.current;
}
