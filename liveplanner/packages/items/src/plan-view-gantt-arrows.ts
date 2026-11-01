// The Gantt Chart's dependency arrows (docs/specs/026-plan/plan-views.md "Dependency arrows"): an arrow from each
// blocker's row to each row it blocks, through a Blocked By field (blocked-by.ts). Both must be rows the chart lays out
// with a mark. Pure: which arrows, and the elbow path each takes; the editor and the image export draw them.
import type { BlockingIndex } from './blocked-by';
import type { GanttRow } from './plan-view-gantt';
import { phaseOf, type StatusPhase } from './plan-views';

// How far an arrow steps out of the blocker's mark before it turns, and its head's length.
export const GANTT_ARROW_STEP = 8;
export const GANTT_ARROW_HEAD = 5;

// A laid-out row (ganttLayout's row entry, or the export's row and its top).
interface RowAt {
  row: GanttRow;
  top: number;
}

export interface GanttArrow {
  from: RowAt;
  to: RowAt;
  // The blocker is done: drawn fainter.
  done: boolean;
}

const marked = (r: GanttRow) => r.mark !== 'none' && r.from !== undefined && r.to !== undefined;

// Every arrow among the rows: for each row, its live blockers that are rows too, both with a mark.
export function ganttArrows(
  rows: Iterable<RowAt | { kind: string; row?: GanttRow; top: number }>,
  index: BlockingIndex,
  phases: ReadonlyMap<string, StatusPhase>,
): GanttArrow[] {
  const at = new Map<string, RowAt>();
  for (const e of rows) if (e.row && marked(e.row)) at.set(e.row.item.id, e as RowAt);
  if (at.size < 2 || index.blockers.size === 0) return [];
  const out: GanttArrow[] = [];
  for (const to of at.values())
    for (const b of index.blockers.get(to.row.item.id) ?? []) {
      const from = at.get(b.id);
      if (from) out.push({ from, to, done: phaseOf(b, phases) === 'done' });
    }
  return out;
}

// A mark's left and right ends along the axis, from `x(day)` (a day's left edge): a bar's days, a diamond's centre
// less and plus its half width.
export function ganttMarkEnds(
  row: Pick<GanttRow, 'mark' | 'from' | 'to'>,
  x: (day: number) => number,
  diamondHalf: number,
): { left: number; right: number } {
  const from = row.from ?? 0;
  const to = row.to ?? from;
  if (row.mark === 'bar') return { left: x(from), right: x(to + 1) };
  const centre = (x(from) + x(from + 1)) / 2;
  return { left: centre - diamondHalf, right: centre + diamondHalf };
}

// The elbow from the blocker's right end (`from`) to the blocked mark's left end (`to`), both at their rows' middles:
// out GANTT_ARROW_STEP, down or up, and in, its line stopping at the head. When the blocked mark starts before that
// step, it turns back along the gap between the rows (`rowH` apart) first. `head` is the arrowhead, pointing right.
export function ganttArrowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rowH: number,
): { d: string; head: string } {
  const r = (n: number) => Math.round(n * 10) / 10;
  const out = from.x + GANTT_ARROW_STEP;
  const end = to.x - GANTT_ARROW_HEAD;
  const head = `M${r(to.x)} ${r(to.y)}l${-GANTT_ARROW_HEAD} -4v8z`;
  if (end >= out) return { d: `M${r(from.x)} ${r(from.y)}H${r(out)}V${r(to.y)}H${r(end)}`, head };
  const gap = from.y + (to.y >= from.y ? rowH / 2 : -rowH / 2);
  const back = end - GANTT_ARROW_STEP;
  return {
    d: `M${r(from.x)} ${r(from.y)}H${r(out)}V${r(gap)}H${r(back)}V${r(to.y)}H${r(end)}`,
    head,
  };
}
