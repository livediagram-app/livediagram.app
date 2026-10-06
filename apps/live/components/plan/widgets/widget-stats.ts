// The numbers the board widgets read (docs/specs/026-plan/board-widgets.md "Widget kinds"), from the
// items the board shows (their status is one of its columns). Pure, so each rule is tested on its own.
import {
  DAY_MS,
  PRIORITIES,
  dayNumber,
  itemAssignee,
  itemStatus,
  itemVoteTotal,
  todayNumber,
  type Priority,
  type BoardProjection,
  type Item,
  type ItemPerson,
  type PlanBoardSetup,
} from '@livediagram/items';

// Days ahead that count as "due soon".
export const DUE_SOON_DAYS = 7;
// Days without a change before a card not yet done is stale.
export const STALE_DAYS = 14;

// The cards a board shows, as its projection placed them (so never archived on an ordinary board, every
// archived one on an Archive board, every live one on an All Cards board): what its widgets count.
export function boardItems(projection: BoardProjection): Item[] {
  const out: Item[] = [];
  for (const c of projection.columns) for (const l of c.lanes) out.push(...l.items);
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

// Cards not yet done that are past due, and due within DUE_SOON_DAYS (today included).
export function dueCounts(
  setup: PlanBoardSetup,
  items: readonly Item[],
  now: Date,
): { overdue: number; soon: number } {
  const doneStatus = setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
  const today = todayNumber(now);
  const last = today + DUE_SOON_DAYS;
  let overdue = 0;
  let soon = 0;
  for (const it of items) {
    const due = dayNumber(it.fields['due']);
    if (due === undefined || (doneStatus && itemStatus(it) === doneStatus)) continue;
    if (due < today) overdue += 1;
    else if (due <= last) soon += 1;
  }
  return { overdue, soon };
}

function doneStatusOf(setup: PlanBoardSetup): string | undefined {
  return setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
}

// Estimate points on the board, and those in its done column.
export function boardPoints(
  setup: PlanBoardSetup,
  items: readonly Item[],
): { done: number; total: number; estimated: number } {
  const doneStatus = doneStatusOf(setup);
  let done = 0;
  let total = 0;
  let estimated = 0;
  for (const it of items) {
    const e = it.fields['estimate'];
    if (typeof e !== 'number') continue;
    estimated += 1;
    total += e;
    if (doneStatus && itemStatus(it) === doneStatus) done += e;
  }
  return { done, total, estimated };
}

// Cards per priority, most urgent first, leaving out the priorities nothing has.
export function priorityCounts(items: readonly Item[]): { priority: Priority; count: number }[] {
  return PRIORITIES.map((priority) => ({
    priority,
    count: items.filter((it) => it.fields['priority'] === priority).length,
  })).filter((r) => r.count > 0);
}

export function unassignedCount(items: readonly Item[]): number {
  return items.filter((it) => !itemAssignee(it)).length;
}

// The card with the most votes (the earliest made among equals), or none before anyone votes.
export function topVoted(items: readonly Item[]): { item: Item; votes: number } | null {
  let best: { item: Item; votes: number } | null = null;
  for (const it of items) {
    const votes = itemVoteTotal(it);
    if (
      votes > 0 &&
      (!best || votes > best.votes || (votes === best.votes && it.key < best.item.key))
    )
      best = { item: it, votes };
  }
  return best;
}

// Cards not yet done that nobody has changed in STALE_DAYS.
export function staleCount(setup: PlanBoardSetup, items: readonly Item[], now: Date): number {
  const doneStatus = doneStatusOf(setup);
  const before = now.getTime() - STALE_DAYS * DAY_MS;
  return items.filter(
    (it) => it.updatedAt < before && !(doneStatus && itemStatus(it) === doneStatus),
  ).length;
}
