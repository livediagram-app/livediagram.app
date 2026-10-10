// The models behind the Due Calendar, Workload by Person, Status Breakdown and Priority by Status
// (docs/specs/026-plan/plan-views.md "Visualisations"), each over the document's live cards. Pure.
import type { Item, ItemPerson } from './item';
import { PRIORITIES, isPriority, type Priority } from './fields';
import { laneGroups, namedStatus, statusLabel, type SwimlaneBy } from './board';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';
import { dayNumber, dayParts, MONTH_LONG, monthStart, shiftMonth } from './plan-view-dates';
import { STATUS_PHASES, liveCards, phaseOf, type StatusPhase } from './plan-views';

const byKey = (a: Item, b: Item) => a.key - b.key;

// ---- Due Calendar ----

export interface CalendarDay {
  day: number;
  date: number;
  inMonth: boolean;
  cards: { item: Item; done: boolean }[];
}

export interface CalendarModel {
  label: string;
  // Rows of seven days, Monday first.
  weeks: CalendarDay[][];
  // Cards due in the month.
  due: number;
}

export function calendarModel(
  items: Iterable<Item>,
  phases: ReadonlyMap<string, StatusPhase>,
  year: number,
  month: number,
): CalendarModel {
  const first = monthStart(year, month);
  const next = shiftMonth(year, month, 1);
  const last = monthStart(next.year, next.month) - 1;
  const gridFrom = first - dayParts(first).weekday;
  const gridTo = last + (6 - dayParts(last).weekday);
  const byDay = new Map<number, Item[]>();
  for (const it of liveCards(items)) {
    const d = dayNumber(it.fields['due']);
    if (d === undefined || d < gridFrom || d > gridTo) continue;
    const list = byDay.get(d);
    if (list) list.push(it);
    else byDay.set(d, [it]);
  }
  const weeks: CalendarDay[][] = [];
  let due = 0;
  for (let day = gridFrom; day <= gridTo; day += 1) {
    if ((day - gridFrom) % 7 === 0) weeks.push([]);
    const inMonth = day >= first && day <= last;
    const cards = (byDay.get(day) ?? [])
      .sort(byKey)
      .map((item) => ({ item, done: phaseOf(item, phases) === 'done' }));
    if (inMonth) due += cards.length;
    weeks[weeks.length - 1]!.push({ day, date: dayParts(day).date, inMonth, cards });
  }
  return { label: `${MONTH_LONG[month]} ${year}`, weeks, due };
}

// ---- Cards by Field (was Workload by Person) ----

export interface BreakdownRow {
  key: string;
  // The row's name ("Ali", "High", "No assignee"), and its person when grouped by assignee.
  label: string;
  person: ItemPerson | null;
  // The empty group (No assignee, No priority...), always last.
  empty: boolean;
  counts: Record<StatusPhase, number>;
  total: number;
}

// A bar per value of the grouping (docs/specs/026-plan/plan-views.md "Cards by Field"), as a board's swimlanes
// group, split Not Started, In Progress and Done: busiest first for people, the field's own order otherwise, the
// empty group last.
export function breakdownModel(
  items: Iterable<Item>,
  phases: ReadonlyMap<string, StatusPhase>,
  grouping: { by: SwimlaneBy; field?: string | undefined },
  types: readonly ItemTypeDef[] = ITEM_TYPES,
  statusNames?: ReadonlyMap<string, string>,
): { rows: BreakdownRow[]; max: number; total: number } {
  const cards = liveCards(items);
  const all = new Map(cards.map((c) => [c.id, c]));
  const groups = laneGroups(grouping.by, grouping.field, cards, all, types, statusNames);
  const rows = new Map<string, BreakdownRow>(
    groups.lanes.map((l) => [
      l.key,
      {
        key: l.key,
        label: l.label || 'All cards',
        person: l.person ?? null,
        empty: l.value === null,
        counts: { todo: 0, doing: 0, done: 0 },
        total: 0,
      },
    ]),
  );
  for (const it of cards) {
    const row = rows.get(groups.laneOfItem.get(it.id) ?? '');
    if (!row) continue;
    row.counts[phaseOf(it, phases)] += 1;
    row.total += 1;
  }
  let list = [...rows.values()];
  if (groups.by === 'assignee')
    list = list.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  list = [...list.filter((r) => !r.empty), ...list.filter((r) => r.empty)];
  return { rows: list, max: Math.max(0, ...list.map((r) => r.total)), total: cards.length };
}

// ---- Status Breakdown ----

export interface StatusSlice {
  // Null is No status.
  status: string | null;
  label: string;
  count: number;
}

// Statuses in the order the boards name them, then any other by count, then No status.
export function statusMixModel(
  items: Iterable<Item>,
  statusNames?: ReadonlyMap<string, string>,
): { slices: StatusSlice[]; total: number } {
  const counts = new Map<string | null, number>();
  let total = 0;
  for (const it of liveCards(items)) {
    const s = namedStatus(it, statusNames) ?? null;
    counts.set(s, (counts.get(s) ?? 0) + 1);
    total += 1;
  }
  const order = [...(statusNames?.keys() ?? [])];
  const rank = (s: string | null) => {
    if (s === null) return Number.MAX_SAFE_INTEGER;
    const i = order.indexOf(s);
    return i < 0 ? order.length : i;
  };
  const slices = [...counts.entries()]
    .map(([status, count]) => ({
      status,
      label: status === null ? 'No status' : statusLabel(status, statusNames),
      count,
    }))
    .sort(
      (a, b) =>
        rank(a.status) - rank(b.status) || b.count - a.count || a.label.localeCompare(b.label),
    );
  return { slices, total };
}

// ---- Priority by Status ----

export interface PriorityRow {
  // Null is No Priority.
  priority: Priority | null;
  counts: Record<StatusPhase, number>;
}

export function priorityMatrixModel(
  items: Iterable<Item>,
  phases: ReadonlyMap<string, StatusPhase>,
): { rows: PriorityRow[]; max: number; total: number } {
  const rows: PriorityRow[] = [...PRIORITIES, null].map((priority) => ({
    priority,
    counts: { todo: 0, doing: 0, done: 0 },
  }));
  let total = 0;
  for (const it of liveCards(items)) {
    const p = it.fields['priority'];
    const row = rows[isPriority(p) ? PRIORITIES.indexOf(p) : PRIORITIES.length]!;
    row.counts[phaseOf(it, phases)] += 1;
    total += 1;
  }
  const max = Math.max(0, ...rows.flatMap((r) => STATUS_PHASES.map((p) => r.counts[p])));
  return { rows, max, total };
}
