// A column carried by its head (docs/specs/026-plan/plan-board.md "Drag a column"): the geometry, pure. The board's
// columns are read once as the drag starts (each one's left edge and width in layout px, within the grid), and every
// frame after that is arithmetic over those numbers: where the carried column may go, which place its middle has
// reached, and how far each other column steps aside to open the gap.

// How far a press moves before it picks the column up (blueprint DEFAULTS D80): under it a press stays a press, so
// the head's buttons and a tap keep working.
export const COLUMN_DRAG_START_PX = 4;
// How the carried column lifts: raised a little and a touch wider, on the column move's shadow.
export const COLUMN_DRAG_RISE_PX = 2;
export const COLUMN_DRAG_SCALE = 1.02;

// One column's span across the grid, in layout px.
export type ColumnSpan = { left: number; width: number };

// Whether a press has moved far enough (screen px) to become a drag.
export function pastColumnDragStart(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= COLUMN_DRAG_START_PX;
}

// The carried column's offset, kept inside the grid: it never leaves the board's first or last edge.
export function clampColumnOffset(
  dx: number,
  spans: readonly ColumnSpan[],
  from: number,
  gridWidth: number,
): number {
  const span = spans[from];
  if (!span) return 0;
  const min = 0 - span.left;
  const max = Math.max(min, gridWidth - span.left - span.width);
  return Math.min(max, Math.max(min, dx));
}

// The place the carried column (`from`, moved by `dx`) lands in: past another column's middle, it takes that
// column's place.
export function columnDropIndex(spans: readonly ColumnSpan[], from: number, dx: number): number {
  const span = spans[from];
  if (!span) return from;
  const centre = span.left + span.width / 2 + dx;
  let to = from;
  for (let j = from + 1; j < spans.length; j++)
    if (centre > spans[j]!.left + spans[j]!.width / 2) to = j;
  for (let j = from - 1; j >= 0; j--) if (centre < spans[j]!.left + spans[j]!.width / 2) to = j;
  return to;
}

// How far column `j` steps aside while the column at `from` would land at `to`: the carried column's width and one
// gap, toward the place it left.
export function columnShift(j: number, from: number, to: number, room: number): number {
  if (from < to && j > from && j <= to) return -room;
  if (to < from && j >= to && j < from) return room;
  return 0;
}

// What a reorder says (a drag let go, Alt+Shift+Arrows, Move Left or Right).
export function columnMovedMessage(name: string, index: number, total: number): string {
  return `Moved ${name} to position ${index + 1} of ${total}`;
}

// What a refused keyboard move says.
export function columnEdgeMessage(name: string, step: -1 | 1): string {
  return `${name} is already the ${step < 0 ? 'first' : 'last'} column`;
}

// The attribute an Editor's column head carries (its column's id), so focus can find it again after a move.
export const COLUMN_HEAD_ATTR = 'data-plan-column-head';

// A column head as its column's handle: where it is, a press that may become a drag, and a keyboard move.
export type ColumnReorder = {
  position: number;
  total: number;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onMoveKey: (step: -1 | 1) => void;
};

// Alt+Shift+Left or Right on a column head: the step it moves, else null.
export function columnMoveKey(e: {
  key: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): -1 | 1 | null {
  if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return null;
  return e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : null;
}
