'use client';

// Cards fan in when a board first shows its cards, on a tab opened or loaded (docs/specs/026-plan/plan-board.md
// "Cards fan in"): each card drops into place from a little above, turned a touch and slightly small, column by column
// and down each column, over about half a second. One Web Animations pass over the cards in view, once per board
// mount, with no React render; cards out of view, and everyone with reduced motion, simply show.
import { useEffect, useRef, type RefObject } from 'react';

const DURATION_MS = 520;
const COLUMN_STEP_MS = 70;
const ROW_STEP_MS = 45;
// The last card in view starts by then, however many there are.
const MAX_DELAY_MS = 650;
// Cards animated at most; beyond them (a very full view) the rest just show.
const MAX_CARDS = 80;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

// Cards that arrive this long after the board is ready (one added later, on a board that opened empty) just show.
const WINDOW_MS = 2000;
// A board holding more cards than this just shows them: reading where its cards land lays the whole board out in one
// task, which grows with it (measured in the dev build, Work Item 245: about 118 ms at 400 cards, about 600 ms at
// 2,000, on opening the board and on importing a tab's whole plan onto it alike). Under it the pass stays near 150 ms.
export const FAN_IN_MAX_BOARD_CARDS = 500;

export function useCardFanIn(
  gridRef: RefObject<HTMLElement | null>,
  ready: boolean,
  // The board's card count: the pass waits for the cards to arrive after the board is ready.
  count: number,
): void {
  const done = useRef(false);
  const readyAt = useRef<number | null>(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !ready || done.current) return;
    readyAt.current ??= performance.now();
    if (count === 0) return;
    done.current = true;
    if (performance.now() - readyAt.current > WINDOW_MS) return;
    if (count > FAN_IN_MAX_BOARD_CARDS) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    // A busy board builds its near runs' cards in the render after it mounts (PlanCardRun), which can follow this
    // effect: with none built yet they are read in the next frame, before it is drawn.
    if (!grid.querySelector('[data-plan-card]') && grid.querySelector('[data-plan-run]'))
      requestAnimationFrame(() => fanIn(grid));
    else fanIn(grid);
  }, [gridRef, ready, count]);
}

function fanIn(grid: HTMLElement): void {
  if (!grid.isConnected) return;
  const view = grid.getBoundingClientRect();
  const bottom = Math.min(view.bottom, window.innerHeight);
  // Only cards built (a busy board's near runs), and no more read once MAX_CARDS in view are found.
  const cards: { el: HTMLElement; box: DOMRect }[] = [];
  for (const el of grid.querySelectorAll<HTMLElement>('[data-plan-card]')) {
    const box = el.getBoundingClientRect();
    if (box.bottom > view.top && box.top < bottom) cards.push({ el, box });
    if (cards.length >= MAX_CARDS) break;
  }
  if (cards.length === 0 || typeof cards[0]!.el.animate !== 'function') return;
  // Columns by their left edge, rows by order down each column.
  const lefts = [...new Set(cards.map(({ box }) => Math.round(box.left)))].sort((a, b) => a - b);
  const rows = new Map<number, number>();
  for (const { el, box } of cards) {
    const col = lefts.indexOf(Math.round(box.left));
    const row = rows.get(col) ?? 0;
    rows.set(col, row + 1);
    const delay = Math.min(col * COLUMN_STEP_MS + row * ROW_STEP_MS, MAX_DELAY_MS);
    const turn = col % 2 === 0 ? -2.5 : 2.5;
    el.animate(
      [
        {
          opacity: 0,
          transform: `translateY(-${12 + row * 4}px) rotate(${turn}deg) scale(0.96)`,
        },
        { opacity: 1, transform: 'none' },
      ],
      { duration: DURATION_MS, delay, easing: EASE, fill: 'backwards' },
    );
  }
}
