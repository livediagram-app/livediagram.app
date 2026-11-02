// A board simplified in a Dashboard slot (docs/specs/026-plan/plan-tabs.md "A board in a slot is simplified"): what it
// projects and the size its cards take. Pure.
import {
  PLAN_COLUMN_MIN_PX,
  type CardSize,
  type PlanBoardSetup,
  type PlanColumn,
} from '@liveplanner/items';
import { SLOT_COLUMN_GAP_PX, SLOT_COLUMN_MIN_PX, boardColumnTemplate } from './plan-board-columns';

// The body's side padding (its `px-3`), each side.
const SLOT_BODY_PAD_PX = 12;

// The set-up a slot board projects: its swimlanes not drawn, so its cards sit in plain columns and a move changes only
// a card's column; but an All Cards board keeps its rows by status, which are its statuses rather than a set-up (its
// one column holds them all). The same object when nothing changes, so nothing downstream re-runs for it.
export function slotSetup(setup: PlanBoardSetup): PlanBoardSetup {
  if (setup.swimlaneBy === 'none' || (setup.allCards && setup.swimlaneBy === 'status'))
    return setup;
  return { ...setup, swimlaneBy: 'none' };
}

// How much of the next column shows at a too-narrow slot board's right edge, so it reads as "scroll for more" (blueprint
// DEFAULTS D59): its columns are sized so whole ones fit and this share of the next peeks in, never under the floor.
export const SLOT_COLUMN_PEEK = 0.4;

// A slot board's one-unit column width for a body this wide (a column `width` wide takes that many units and the gaps
// between them): the columns' even share while it is at least SLOT_COLUMN_MIN_PX; narrower, the widest that fits whole
// columns and a peek of the next; SLOT_COLUMN_MIN_PX when not even one and a peek fit. Null unmeasured or with no
// columns.
export function slotColumnUnit(
  bodyPx: number | null,
  columns: readonly Pick<PlanColumn, 'width'>[],
): number | null {
  if (bodyPx === null || columns.length === 0) return null;
  const units = columns.reduce((n, c) => n + (c.width ?? 1), 0);
  const room = bodyPx - 2 * SLOT_BODY_PAD_PX;
  const share = (room - (units - 1) * SLOT_COLUMN_GAP_PX) / units;
  if (share >= SLOT_COLUMN_MIN_PX) return share;
  for (let whole = units - 1; whole >= 1; whole--) {
    const unit = (room - whole * SLOT_COLUMN_GAP_PX) / (whole + SLOT_COLUMN_PEEK);
    if (unit >= SLOT_COLUMN_MIN_PX) return unit;
  }
  return SLOT_COLUMN_MIN_PX;
}

// A slot board's column tracks: shares of the body while they fit (so a scrollbar never tips them over), fixed widths
// from slotColumnUnit once they scroll; unmeasured, plan-board-columns' 'slot' template.
export function slotColumnTemplate(
  bodyPx: number | null,
  columns: readonly Pick<PlanColumn, 'width'>[],
): string {
  const unit = slotColumnUnit(bodyPx, columns);
  if (unit === null || bodyPx === null) return boardColumnTemplate(columns, 'slot');
  const units = columns.reduce((n, c) => n + (c.width ?? 1), 0);
  const fits =
    units * SLOT_COLUMN_MIN_PX + (units - 1) * SLOT_COLUMN_GAP_PX <= bodyPx - 2 * SLOT_BODY_PAD_PX;
  if (fits) return boardColumnTemplate(columns, 'slot');
  return columns
    .map((c) => {
      const w = c.width ?? 1;
      return `${Math.floor(unit * w + (w - 1) * SLOT_COLUMN_GAP_PX)}px`;
    })
    .join(' ');
}

// The size a slot board's cards take: the board's own while a one-unit column is at least PLAN_COLUMN_MIN_PX wide, so a
// Detailed card's chips have room; Minimal below that (blueprint DEFAULTS D58). Unmeasured (null), the board's own.
export function slotCardSize(
  size: CardSize | undefined,
  unit: number | null,
): CardSize | undefined {
  if (unit === null || size === 'minimal') return size;
  return unit >= PLAN_COLUMN_MIN_PX ? size : 'minimal';
}
