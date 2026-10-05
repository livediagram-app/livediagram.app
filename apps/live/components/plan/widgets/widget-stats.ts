// The numbers the board widgets read (docs/specs/025-plan/board-widgets.md "Widget kinds"), from the
// items the board shows (their status is one of its columns). Pure, so each rule is tested on its own.
import {
  itemAssignee,
  itemStatus,
  type BoardProjection,
  type Item,
  type ItemPerson,
  type PlanBoardSetup,
} from '@livediagram/items';

// Days ahead that count as "due soon".
export const DUE_SOON_DAYS = 7;

export function boardItems(setup: PlanBoardSetup, items: Iterable<Item>): Item[] {
  const statuses = new Set(setup.columns.map((c) => c.status));
  const out: Item[] = [];
  for (const it of items) {
    const s = itemStatus(it);
    if (s !== undefined && statuses.has(s)) out.push(it);
  }
  return out;
}

// The people assigned cards on the board, most cards first, then by name.
export function boardPeople(items: readonly Item[]): ItemPerson[] {
  const counts = new Map<string, { person: ItemPerson; n: number }>();
  for (const it of items) {
    const p = itemAssignee(it);
    if (!p) continue;
    const row = counts.get(p.id);
    if (row) row.n += 1;
    else counts.set(p.id, { person: p, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.person.name.localeCompare(b.person.name))
    .map((r) => r.person);
}

// Cards per type, in the catalogue's order.
export function boardTypeCounts(
  items: readonly Item[],
  typeOrder: readonly string[],
): { type: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  const rank = (t: string) => {
    const i = typeOrder.indexOf(t);
    return i < 0 ? typeOrder.length : i;
  };
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => rank(a.type) - rank(b.type) || a.type.localeCompare(b.type));
}

export function overWipColumns(projection: BoardProjection): number {
  return projection.columns.filter((c) => c.overLimit).length;
}

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Cards not yet done that are past due, and due within DUE_SOON_DAYS (today included).
export function dueCounts(
  setup: PlanBoardSetup,
  items: readonly Item[],
  now: Date,
): { overdue: number; soon: number } {
  const doneStatus = setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
  const today = isoDay(now);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + DUE_SOON_DAYS);
  const last = isoDay(horizon);
  let overdue = 0;
  let soon = 0;
  for (const it of items) {
    const due = it.fields['due'];
    if (typeof due !== 'string' || (doneStatus && itemStatus(it) === doneStatus)) continue;
    if (due < today) overdue += 1;
    else if (due <= last) soon += 1;
  }
  return { overdue, soon };
}
