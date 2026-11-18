// Dependency clashes (docs/specs/026-plan/plan-views.md "Dependency clashes", "Moving the cards that follow"): a
// blocked card clashes with an open blocker when it starts on or before the day that blocker is due, its days read as
// a Gantt chart draws them. And the walk that moves the cards that follow a moved card just far enough, keeping their
// lengths: a topological pass over the Blocked By links reachable from it, linear in cards and links, that never
// reaches a card in a loop. Pure.
import type { BlockingIndex } from './blocked-by';
import { itemTitle, type Item, type ItemFieldValue } from './item';
import { BUILT_IN_DATES, type ViewDates } from './view-fields';
import { roleDay, roleDays } from './view-dates-write';
import type { ItemTypeDef } from './item-types';
import { cardRefOrKey } from './card-prefix';

// Inclusive day numbers.
export interface DaySpan {
  from: number;
  to: number;
}

// A card's days as a Gantt chart draws them: its start to its due, the earlier first; either alone is one day.
export function cardSpan(
  item: Pick<Item, 'fields'>,
  dates: ViewDates = BUILT_IN_DATES,
): DaySpan | undefined {
  const start = roleDay(item, dates, 'start');
  const due = roleDay(item, dates, 'due');
  if (start === undefined && due === undefined) return undefined;
  const a = start ?? due!;
  const b = due ?? start!;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

// How many days a blocked mark starts before its blocker's mark ends (0: the same day), or null when it does not
// clash. Either done, or either without a mark, never clashes.
export function ganttClashDays(
  blocker: { from?: number; to?: number; isDone: boolean },
  blocked: { from?: number; to?: number; isDone: boolean },
): number | null {
  if (blocker.isDone || blocked.isDone) return null;
  if (blocker.to === undefined || blocked.from === undefined) return null;
  const days = blocker.to - blocked.from;
  return days >= 0 ? days : null;
}

// "Starts 3 days before T-4 Design is due", or "Starts the day T-4 Design is due" ("#4" with no types to read its
// prefix from).
export function clashText(
  days: number,
  blocker: Pick<Item, 'key' | 'type' | 'fields'>,
  types?: readonly ItemTypeDef[],
): string {
  const named = `${cardRefOrKey(blocker, types)} ${itemTitle(blocker).trim() || 'Untitled'}`;
  if (days === 0) return `Starts the day ${named} is due`;
  return `Starts ${days} ${days === 1 ? 'day' : 'days'} before ${named} is due`;
}

export interface DependencyClash {
  blocker: Item;
  days: number;
}

// A card's clashes with its open blockers, worst (most days) first.
export function clashesOf(
  item: Item,
  index: BlockingIndex,
  isDone: (item: Item) => boolean,
  dates: ViewDates = BUILT_IN_DATES,
): DependencyClash[] {
  const blockers = index.blockers.get(item.id);
  if (!blockers?.length || isDone(item)) return [];
  const span = cardSpan(item, dates);
  if (!span) return [];
  const out: DependencyClash[] = [];
  for (const b of blockers) {
    const theirs = cardSpan(b, dates);
    const days = theirs
      ? ganttClashDays({ ...theirs, isDone: isDone(b) }, { ...span, isDone: false })
      : null;
    if (days !== null) out.push({ blocker: b, days });
  }
  return out.sort((a, b) => b.days - a.days);
}

export interface FollowingShift {
  item: Item;
  // Days later.
  days: number;
  // The write that moves it, in its fields' own shapes.
  set: Record<string, ItemFieldValue>;
}

// The cards that follow `seeds` (the cards just moved) shifted later just enough that each starts the day after its
// latest open blocker is due, down every chain, keeping each card's length. Seeds, done cards, cards without dates and
// cards this person may not change never move, though each still counts at its own dates for the cards after it; nothing moves earlier. A topological
// pass (in-degrees among the cards reached, a queue of those with none left), so a card in a loop is never taken.
export function followingShifts(
  index: BlockingIndex,
  isDone: (item: Item) => boolean,
  seeds: readonly string[],
  {
    dates = BUILT_IN_DATES,
    mayMove = () => true,
  }: {
    dates?: ViewDates;
    // Whether this person may change the card: one they can't stays, and counts at its own dates.
    mayMove?: (item: Item) => boolean;
  } = {},
): FollowingShift[] {
  const fixed = new Set(seeds);
  // The cards reached from the seeds, each once.
  const reached = new Map<string, Item>();
  const stack = [...seeds];
  while (stack.length)
    for (const next of index.blocks.get(stack.pop()!) ?? [])
      if (!fixed.has(next.id) && !reached.has(next.id)) {
        reached.set(next.id, next);
        stack.push(next.id);
      }
  if (reached.size === 0) return [];
  // Each reached card's blockers among the reached: what must be settled before it.
  const waiting = new Map<string, number>();
  for (const id of reached.keys()) {
    let n = 0;
    for (const b of index.blockers.get(id) ?? []) if (reached.has(b.id)) n += 1;
    waiting.set(id, n);
  }
  const queue = [...reached.keys()].filter((id) => waiting.get(id) === 0);
  const moved = new Map<string, DaySpan>();
  const spanOf = (it: Item) => moved.get(it.id) ?? cardSpan(it, dates);
  const out: FollowingShift[] = [];
  for (let at = 0; at < queue.length; at++) {
    const item = reached.get(queue[at]!)!;
    const span = cardSpan(item, dates);
    if (span && !isDone(item) && mayMove(item)) {
      let need: number | undefined;
      for (const b of index.blockers.get(item.id) ?? []) {
        if (isDone(b)) continue;
        const theirs = spanOf(b);
        if (theirs && (need === undefined || theirs.to + 1 > need)) need = theirs.to + 1;
      }
      if (need !== undefined && span.from < need) {
        const days = need - span.from;
        const start = roleDay(item, dates, 'start');
        const due = roleDay(item, dates, 'due');
        const set = roleDays(item, dates, {
          ...(start !== undefined ? { start: start + days } : {}),
          ...(due !== undefined ? { due: due + days } : {}),
        });
        moved.set(item.id, { from: span.from + days, to: span.to + days });
        out.push({ item, days, set });
      }
    }
    for (const next of index.blocks.get(item.id) ?? []) {
      const left = waiting.get(next.id);
      if (left === undefined) continue;
      waiting.set(next.id, left - 1);
      if (left === 1) queue.push(next.id);
    }
  }
  return out;
}
