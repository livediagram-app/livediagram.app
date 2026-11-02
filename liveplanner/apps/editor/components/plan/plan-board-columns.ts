// A board's column tracks (docs/specs/026-plan/plan-board.md "The board set-up", "Maximised board"). On the canvas
// every slot shares the board's width, never narrower than PLAN_COLUMN_MIN_PX. Maximised (or filling its tab) a slot
// is a fifth of the board's body (MAXIMISED_BOARD_SLOTS), so a busy board scrolls sideways rather than squeezing
// its columns; the floor still wins on a narrow screen. A column `width` wide takes that many slots and the gaps
// between them. On a phone ("On a phone") a board that scrolls on its own (maximised, filling its tab or in a Dashboard
// slot) gives each column the body's width less PHONE_COLUMN_PEEK_PX, whatever its width, so one column reads at a time
// and, centred, its neighbours peek in at both edges. Pure.
import { PLAN_COLUMN_MIN_PX, type PlanColumn } from '@liveplanner/items';

// A Dashboard slot's compact board (docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified"): each column
// at least this wide, sharing the rest, before its columns scroll sideways (blueprint DEFAULTS D57), 8 px apart.
export const SLOT_COLUMN_MIN_PX = 160;
export const SLOT_COLUMN_GAP_PX = 8;

// How many column slots a maximised board shows across its body before it scrolls (blueprint DEFAULTS).
export const MAXIMISED_BOARD_SLOTS = 5;
// The gap between columns (the grid's `gap-3`).
export const PLAN_COLUMN_GAP_PX = 12;
// How much of its neighbours a phone shows beside the centred column, both gaps included (blueprint DEFAULTS).
export const PHONE_COLUMN_PEEK_PX = 64;

// A phone column's width (the body is the size container), whatever the column's own width: also its snap marker's.
export const PHONE_COLUMN_WIDTH = `max(${PLAN_COLUMN_MIN_PX}px, calc(100cqw - ${PHONE_COLUMN_PEEK_PX}px))`;

// A collapsed column's strip (docs/specs/026-plan/plan-board.md "Collapse Column"): room for its chevron, its count and
// its name written top to bottom (blueprint DEFAULTS D60).
export const COLLAPSED_COLUMN_PX = 40;

const NONE_COLLAPSED: ReadonlySet<string> = new Set();

// How a board lays its columns out: sharing the canvas element's width, five slots across while it covers the canvas,
// one a screen on a phone, or compact in a Dashboard slot.
export type BoardColumnLayout = 'canvas' | 'maximised' | 'phone' | 'slot';

// `collapsed` (column ids) are strips, COLLAPSED_COLUMN_PX wide, on the canvas and maximised; the open columns share
// the rest, and a maximised board's five slots are measured from what the strips leave. A phone and a slot board draw
// every column open.
export function boardColumnTemplate(
  columns: readonly (Pick<PlanColumn, 'width'> & { id?: string })[],
  layout: BoardColumnLayout,
  collapsed: ReadonlySet<string> = NONE_COLLAPSED,
): string {
  if (layout === 'phone') return columns.map(() => PHONE_COLUMN_WIDTH).join(' ');
  if (layout === 'slot')
    return columns
      .map((c) => `minmax(${SLOT_COLUMN_MIN_PX * (c.width ?? 1)}px, ${c.width ?? 1}fr)`)
      .join(' ');
  const maximised = layout === 'maximised';
  const gaps = (MAXIMISED_BOARD_SLOTS - 1) * PLAN_COLUMN_GAP_PX;
  const shut = (c: { id?: string }) => c.id !== undefined && collapsed.has(c.id);
  const strips = columns.filter(shut).length;
  // The body less each strip and its gap.
  const room = strips
    ? `(100cqw - ${strips * (COLLAPSED_COLUMN_PX + PLAN_COLUMN_GAP_PX)}px - ${gaps}px)`
    : `(100cqw - ${gaps}px)`;
  return columns
    .map((c) => {
      if (shut(c)) return `${COLLAPSED_COLUMN_PX}px`;
      const w = c.width ?? 1;
      const floor = `${PLAN_COLUMN_MIN_PX * w}px`;
      if (!maximised) return `minmax(${floor}, ${w}fr)`;
      // A slot is a fifth of the body (100cqw, the body is the size container) less its share of the gaps.
      const slot = `calc(${room} / ${MAXIMISED_BOARD_SLOTS} * ${w} + ${(w - 1) * PLAN_COLUMN_GAP_PX}px)`;
      return `minmax(max(${floor}, ${slot}), ${w}fr)`;
    })
    .join(' ');
}
