// A column moving left or right glides to its new place (docs/specs/026-plan/plan-board.md "A column's own
// settings"), and its neighbour glides the other way, so the move is seen rather than a jump. FLIP: the board
// notes where each column's head and cells sit just before the move (`captureColumns`), and once the move has
// laid out it plays each from its old place to its new one (`playColumnMove`). Positions are layout offsets
// (`offsetLeft`), so the canvas zoom does not skew them. Nothing plays under reduced motion.
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';

// How long the glide takes, and its curve (a quick start, a soft landing).
export const COLUMN_MOVE_MS = 240;
export const COLUMN_MOVE_EASING = 'cubic-bezier(0.2, 0, 0, 1)';

// The attribute a column's head and each of its cells carry, set to the column's id.
export const COLUMN_ATTR = 'data-plan-column';

type ColumnPositions = Map<HTMLElement, number>;

// The column moved rides above its neighbour, lifted on a soft shadow that settles as it lands.
const LIFT_SHADOW = '0 12px 28px -10px rgb(15 23 42 / 0.35)';

// Where each of the board's column parts sits now.
export function captureColumns(root: ParentNode): ColumnPositions {
  const at: ColumnPositions = new Map();
  for (const el of root.querySelectorAll<HTMLElement>(`[${COLUMN_ATTR}]`))
    at.set(el, el.offsetLeft);
  return at;
}

// Plays each part still on the board from where it was to where it is, the moved column's (`liftId`) lifted; the
// number played.
export function playColumnMove(before: ColumnPositions, liftId?: string): number {
  let played = 0;
  for (const [el, left] of before) {
    if (!el.isConnected || typeof el.animate !== 'function') continue;
    const dx = left - el.offsetLeft;
    if (!dx) continue;
    const lifted = liftId !== undefined && el.getAttribute(COLUMN_ATTR) === liftId;
    el.animate(
      lifted
        ? [
            { transform: `translateX(${dx}px)`, boxShadow: LIFT_SHADOW, zIndex: 2 },
            { transform: 'translateX(0)', boxShadow: 'none', zIndex: 2 },
          ]
        : [{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }],
      { duration: COLUMN_MOVE_MS, easing: COLUMN_MOVE_EASING },
    );
    played++;
  }
  return played;
}

// The attribute a collapsed column's strip parts carry (docs/specs/026-plan/plan-board.md "Collapse Column").
export const STRIP_ATTR = 'data-plan-strip';
// How long a strip takes to fade in: a small fade.
export const STRIP_FADE_MS = 150;

// A column collapsed or expanded (docs/specs/026-plan/plan-board.md "Collapse Column"): its neighbours glide from where
// they were, unlifted; the column's own new parts come in. Expanding, each opens out from the strip's width
// (`stripPx`) to its own, its right edge keeping pace with the neighbour beside it; collapsing, the strip fades in.
// The number played.
export function playColumnResize(
  root: ParentNode,
  before: ColumnPositions,
  columnId: string,
  stripPx: number,
): number {
  let played = playColumnMove(before);
  for (const el of root.querySelectorAll<HTMLElement>(`[${COLUMN_ATTR}]`)) {
    if (before.has(el) || el.getAttribute(COLUMN_ATTR) !== columnId) continue;
    if (typeof el.animate !== 'function') continue;
    if (el.hasAttribute(STRIP_ATTR))
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: STRIP_FADE_MS, easing: 'ease-out' });
    else
      el.animate(
        [
          { clipPath: `inset(0 ${Math.max(0, el.offsetWidth - stripPx)}px 0 0)` },
          { clipPath: 'inset(0 0 0 0)' },
        ],
        { duration: COLUMN_MOVE_MS, easing: COLUMN_MOVE_EASING },
      );
    played++;
  }
  return played;
}

// The board's half: `beforeMove(columnId)` just before a reorder is written, and the glide plays once the new order lays
// out (`order` is the columns' ids, joined). `isMoving()` is true from then until the glide ends, so the cards' own
// glide (usePlanCardFlip) holds still and the cards ride along in their cells. A change of order nobody here asked
// for (a collaborator's) jumps.
export function useColumnMoveFlip(
  grid: RefObject<HTMLElement | null>,
  order: string,
  // A collapsed column's strip width, for `beforeResize`.
  stripPx = 0,
) {
  const pending = useRef<{ at: ColumnPositions; columnId: string; resize: boolean } | null>(null);
  const moving = useRef(false);
  useLayoutEffect(() => {
    const before = pending.current;
    pending.current = null;
    if (!before) return;
    const played =
      before.resize && grid.current
        ? playColumnResize(grid.current, before.at, before.columnId, stripPx)
        : playColumnMove(before.at, before.columnId);
    if (!played) return;
    moving.current = true;
    const t = setTimeout(() => (moving.current = false), COLUMN_MOVE_MS);
    return () => {
      clearTimeout(t);
      moving.current = false;
    };
  }, [order, grid, stripPx]);
  const capture = useCallback(
    (columnId: string, resize: boolean) => {
      if (!grid.current || prefersReducedMotion()) return;
      pending.current = { at: captureColumns(grid.current), columnId, resize };
    },
    [grid],
  );
  const beforeMove = useCallback((columnId: string) => capture(columnId, false), [capture]);
  // Just before a column collapses or expands (`order` then changes too).
  const beforeResize = useCallback((columnId: string) => capture(columnId, true), [capture]);
  const isMoving = useCallback(() => moving.current || pending.current !== null, []);
  return { beforeMove, beforeResize, isMoving };
}
