// The keys of a gallery's tiles (docs/specs/026-plan/board-widgets.md "Keyboard", item-types.md "Fields and Tabs": Add
// Field), shared by Add a Widget and Add Field: the arrow keys move between tiles in reading order (left and right
// one, up and down a row, by where the tiles sit when laid out), Home and End to the first and last, and Up from the
// top row back to the search.
import type { KeyboardEvent } from 'react';

const MOVES = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];

/**
 * The index an arrow key moves to from `at`: the next or previous in reading order, or the nearest tile in the row
 * below or above (two to a row when the tiles have no size, as in a test). -1 for Up from the top row.
 */
export function stepFrom(cards: readonly HTMLElement[], at: number, key: string): number {
  const clamp = (i: number) => Math.min(cards.length - 1, Math.max(0, i));
  if (key === 'ArrowRight') return clamp(at + 1);
  if (key === 'ArrowLeft') return clamp(at - 1);
  const down = key === 'ArrowDown';
  const here = cards[at]!.getBoundingClientRect();
  if (here.height === 0) {
    const to = at + (down ? 2 : -2);
    return down ? clamp(to) : to < 0 ? -1 : to;
  }
  let best = at;
  let bestScore = Infinity;
  cards.forEach((c, i) => {
    if (i === at) return;
    const r = c.getBoundingClientRect();
    const dy = down ? r.top - here.bottom : here.top - r.bottom;
    if (dy < -1) return;
    const score = dy * 1000 + Math.abs(r.left - here.left);
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return !down && best === at ? -1 : best;
}

/** Moves focus among `tiles` for an arrow, Home or End key pressed on one of them; Up from the top row to `search`. */
export function moveAmongTiles(
  e: KeyboardEvent,
  tiles: readonly HTMLElement[],
  search: HTMLElement | null,
): void {
  if (!MOVES.includes(e.key)) return;
  const at = tiles.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  let next: HTMLElement | null | undefined;
  if (e.key === 'Home') next = tiles[0];
  else if (e.key === 'End') next = tiles[tiles.length - 1];
  else {
    const to = stepFrom(tiles, at, e.key);
    next = to < 0 ? search : tiles[to];
  }
  if (!next) return;
  e.preventDefault();
  next.focus();
}
