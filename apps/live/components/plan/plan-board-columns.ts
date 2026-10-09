// A board's column tracks (docs/specs/026-plan/plan-board.md "The board set-up", "Maximised board"). On the canvas
// every slot shares the board's width, never narrower than PLAN_COLUMN_MIN_PX. Maximised (or filling its tab) a slot
// is a fifth of the board's body (MAXIMISED_BOARD_SLOTS), so a busy board scrolls sideways rather than squeezing
// its columns; the floor still wins on a narrow screen. A column `width` wide takes that many slots and the gaps
// between them. Pure.
import { PLAN_COLUMN_MIN_PX, type PlanColumn } from '@livediagram/items';

// How many column slots a maximised board shows across its body before it scrolls (blueprint DEFAULTS).
export const MAXIMISED_BOARD_SLOTS = 5;
// The gap between columns (the grid's `gap-3`).
export const PLAN_COLUMN_GAP_PX = 12;

export function boardColumnTemplate(
  columns: readonly Pick<PlanColumn, 'width'>[],
  maximised: boolean,
): string {
  const gaps = (MAXIMISED_BOARD_SLOTS - 1) * PLAN_COLUMN_GAP_PX;
  return columns
    .map((c) => {
      const w = c.width ?? 1;
      const floor = `${PLAN_COLUMN_MIN_PX * w}px`;
      if (!maximised) return `minmax(${floor}, ${w}fr)`;
      // A slot is a fifth of the body (100cqw, the body is the size container) less its share of the gaps.
      const slot = `calc((100cqw - ${gaps}px) / ${MAXIMISED_BOARD_SLOTS} * ${w} + ${(w - 1) * PLAN_COLUMN_GAP_PX}px)`;
      return `minmax(max(${floor}, ${slot}), ${w}fr)`;
    })
    .join(' ');
}
