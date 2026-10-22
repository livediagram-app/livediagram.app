// A board's column tracks (docs/specs/026-plan/plan-board.md "The board set-up", "Maximised board"). On the canvas
// every slot shares the board's width, never narrower than PLAN_COLUMN_MIN_PX. Maximised (or filling its tab) a slot
// is a fifth of the board's body (MAXIMISED_BOARD_SLOTS), so a busy board scrolls sideways rather than squeezing
// its columns; the floor still wins on a narrow screen. A column `width` wide takes that many slots and the gaps
// between them. On a phone ("On a phone") a board that scrolls on its own (maximised, filling its tab or in a Dashboard
// slot) gives each column the body's width less PHONE_COLUMN_PEEK_PX, whatever its width, so one column reads at a time
// and the next peeks in at the edge. Pure.
import { PLAN_COLUMN_MIN_PX, type PlanColumn } from '@livedesign/items';

// How many column slots a maximised board shows across its body before it scrolls (blueprint DEFAULTS).
export const MAXIMISED_BOARD_SLOTS = 5;
// The gap between columns (the grid's `gap-3`).
export const PLAN_COLUMN_GAP_PX = 12;
// How much of the next column a phone shows beside the one in view, gap included (blueprint DEFAULTS).
export const PHONE_COLUMN_PEEK_PX = 48;

// How a board lays its columns out: sharing the canvas element's width, five slots across while it covers the canvas,
// or one a screen on a phone.
export type BoardColumnLayout = 'canvas' | 'maximised' | 'phone';

export function boardColumnTemplate(
  columns: readonly Pick<PlanColumn, 'width'>[],
  layout: BoardColumnLayout,
): string {
  if (layout === 'phone') {
    const one = `max(${PLAN_COLUMN_MIN_PX}px, calc(100cqw - ${PHONE_COLUMN_PEEK_PX}px))`;
    return columns.map(() => one).join(' ');
  }
  const maximised = layout === 'maximised';
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
