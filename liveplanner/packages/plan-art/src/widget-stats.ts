// The numbers the board widgets read (docs/specs/026-plan/board-widgets.md "Widget kinds"), from the
// items the board shows (their status is one of its columns). Pure, so each rule is tested on its own.
import {
  CARD_AGE_ALERT_DAYS,
  DAY_MS,
  PRIORITIES,
  dayNumber,
  finishedStatuses,
  itemAssignee,
  itemStatus,
  itemVoteTotal,
  todayNumber,
  durationMinutes,
  isTimeSpent,
  readTimeValue,
  typeIn,
  type CustomFieldDef,
  type ItemTypeDef,
  type Priority,
  type BoardProjection,
  type Item,
  type ItemPerson,
  type PlanBoardSetup,
} from '@liveplanner/items';

// Days ahead that count as "due soon".
export const DUE_SOON_DAYS = 7;
// Days without a change before a card not yet done is stale: the day a card's Age turns red too.
export const STALE_DAYS = CARD_AGE_ALERT_DAYS;

// The share done as a whole percent, for "73% done": rounded, except that it reads 100 only when every one is done
// and 0 only when none is, so 199 of 200 is 99% and 1 of 300 is 1%, never a finished or untouched board that is not.
export function percentDone(done: number, total: number): number {
  if (total <= 0 || done <= 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.max(1, Math.round((done / total) * 100)));
}

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

// Cards not yet done (in no done column, finishedStatuses) that are past due, and due within DUE_SOON_DAYS
// (today included).
export function dueCounts(
  setup: PlanBoardSetup,
  items: readonly Item[],
  now: Date,
): { overdue: number; soon: number } {
  const finished = new Set(finishedStatuses(setup));
  const today = todayNumber(now);
  const last = today + DUE_SOON_DAYS;
  let overdue = 0;
  let soon = 0;
  for (const it of items) {
    const due = dayNumber(it.fields['due']);
    if (due === undefined || isFinished(finished, it)) continue;
    if (due < today) overdue += 1;
    else if (due <= last) soon += 1;
  }
  return { overdue, soon };
}

// Estimate points on the board, and those in its done columns.
export function boardPoints(
  setup: PlanBoardSetup,
  items: readonly Item[],
): { done: number; total: number; estimated: number } {
  const finished = new Set(finishedStatuses(setup));
  let done = 0;
  let total = 0;
  let estimated = 0;
  for (const it of items) {
    const e = it.fields['estimate'];
    if (typeof e !== 'number') continue;
    estimated += 1;
    total += e;
    if (isFinished(finished, it)) done += e;
  }
  return { done, total, estimated };
}

// The Duration field the Time widget reads on a card of `type` (docs/specs/026-plan/board-widgets.md "Time"): its
// first Time Spent field, else its first Duration field; none for a type without one.
export function timeFieldOf(type: ItemTypeDef | undefined): CustomFieldDef | undefined {
  const offered = (type?.custom ?? []).filter(
    (f) => f.kind === 'duration' && type!.fields.includes(f.id),
  );
  return offered.find((f) => isTimeSpent(f)) ?? offered[0];
}

// The board's hours: each card's time field (timeFieldOf) as minutes, how many cards hold one, and the timers
// running in those fields now.
export function boardTime(
  items: readonly Item[],
  types: readonly ItemTypeDef[],
): { minutes: number; counted: number; running: number } {
  let minutes = 0;
  let counted = 0;
  let running = 0;
  const fieldOf = new Map<string, CustomFieldDef | undefined>();
  for (const it of items) {
    if (!fieldOf.has(it.type)) fieldOf.set(it.type, timeFieldOf(typeIn(types, it.type)));
    const f = fieldOf.get(it.type);
    if (!f) continue;
    const m = durationMinutes(f, it.fields[f.id]);
    if (m !== undefined) {
      minutes += m;
      counted += 1;
    }
    if (isTimeSpent(f)) running += readTimeValue(it.fields[f.id]).running.length;
  }
  return { minutes, counted, running };
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

// Cards not yet done (in no done column) that nobody has changed in STALE_DAYS, stalest first.
export function staleItems(setup: PlanBoardSetup, items: readonly Item[], now: Date): Item[] {
  const finished = new Set(finishedStatuses(setup));
  const before = now.getTime() - STALE_DAYS * DAY_MS;
  return items
    .filter((it) => it.updatedAt < before && !isFinished(finished, it))
    .sort((a, b) => a.updatedAt - b.updatedAt);
}

export function staleCount(setup: PlanBoardSetup, items: readonly Item[], now: Date): number {
  return staleItems(setup, items, now).length;
}

// Whether a card sits in a done column.
function isFinished(finished: ReadonlySet<string>, it: Item): boolean {
  const status = itemStatus(it);
  return status !== undefined && finished.has(status);
}
