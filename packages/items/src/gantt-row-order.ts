// A Gantt chart's own row order (docs/specs/026-plan/plan-views.md "Row order"): the cards it names first, in its
// order, the rest after in date order; and the next order a move makes, within a row's swimlane. Pure.
import { isValidItemId } from './fields';

// The most cards a chart's order names, so the element stays small.
export const GANTT_ROW_ORDER_MAX = 2000;

// A saved order: card ids, none repeated, at most GANTT_ROW_ORDER_MAX.
export function isGanttRowOrder(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= GANTT_ROW_ORDER_MAX &&
    value.every((id) => isValidItemId(id)) &&
    new Set(value).size === value.length
  );
}

// Rows in the chart's order: those the order names first, in its sequence; the rest after, as they came (date
// order). Ids the order names that no row has are ignored.
export function ganttOrderRows<T extends { item: { id: string } }>(
  rows: readonly T[],
  order: readonly string[] | undefined,
): T[] {
  if (!order || order.length === 0) return [...rows];
  const at = new Map(order.map((id, i) => [id, i]));
  const named = rows.filter((r) => at.has(r.item.id));
  named.sort((a, b) => at.get(a.item.id)! - at.get(b.item.id)!);
  return [...named, ...rows.filter((r) => !at.has(r.item.id))];
}

// The next full order after `id` moves to `toIndex` within its lane (`laneIds`, the lane's rows as shown): taken
// out of the chart's current row ids (`rowIds`, as shown) and put before the lane's row now at `toIndex`, or after
// the lane's last row past its end, so it never leaves its lane. Only the ids given survive (stale ones drop).
// Null when nothing moves.
export function ganttReorder(
  rowIds: readonly string[],
  laneIds: readonly string[],
  id: string,
  toIndex: number,
): string[] | null {
  const from = laneIds.indexOf(id);
  if (from < 0 || !rowIds.includes(id)) return null;
  const others = laneIds.filter((x) => x !== id);
  const to = Math.max(0, Math.min(others.length, toIndex));
  if (to === from) return null;
  const rest = rowIds.filter((x) => x !== id);
  const next =
    to < others.length
      ? rest.indexOf(others[to]!)
      : others.length > 0
        ? rest.indexOf(others[others.length - 1]!) + 1
        : rest.length;
  const out = [...rest];
  out.splice(next, 0, id);
  return out.slice(0, GANTT_ROW_ORDER_MAX);
}
