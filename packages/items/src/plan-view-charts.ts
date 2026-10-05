// The models behind the Due Calendar, Workload by Person, Status Breakdown and Priority by Status
// (docs/specs/025-plan/plan-views.md "Visualisations"), each over the document's live cards. Pure.
import { itemAssignee, itemStatus, type Item, type ItemPerson } from './item';
import { PRIORITIES, isPriority, type Priority } from './fields';
import { statusLabel } from './board';
import { dayNumber, dayParts, MONTH_LONG, monthStart } from './plan-view-dates';
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

// The month `offset` months from `year`/`month` (0-based), normalised.
export function shiftMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const n = year * 12 + month + offset;
  return { year: Math.floor(n / 12), month: ((n % 12) + 12) % 12 };
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

// ---- Workload by Person ----

export interface WorkloadRow {
  // Null is Unassigned.
  person: ItemPerson | null;
  counts: Record<StatusPhase, number>;
  total: number;
}

export function workloadModel(
  items: Iterable<Item>,
  phases: ReadonlyMap<string, StatusPhase>,
): { rows: WorkloadRow[]; max: number; total: number } {
  const rows = new Map<string, WorkloadRow>();
  let total = 0;
  for (const it of liveCards(items)) {
    const person = itemAssignee(it) ?? null;
    const key = person?.id ?? '';
    let row = rows.get(key);
    if (!row) {
      row = { person, counts: { todo: 0, doing: 0, done: 0 }, total: 0 };
      rows.set(key, row);
    }
    row.counts[phaseOf(it, phases)] += 1;
    row.total += 1;
    total += 1;
  }
  const sorted = [...rows.values()].sort((a, b) => {
    if (!a.person) return b.person ? 1 : 0;
    if (!b.person) return -1;
    return b.total - a.total || a.person.name.localeCompare(b.person.name);
  });
  return { rows: sorted, max: Math.max(0, ...sorted.map((r) => r.total)), total };
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
  statusNames: ReadonlyMap<string, string> = new Map(),
): { slices: StatusSlice[]; total: number } {
  const counts = new Map<string | null, number>();
  let total = 0;
  for (const it of liveCards(items)) {
    const s = itemStatus(it) ?? null;
    counts.set(s, (counts.get(s) ?? 0) + 1);
    total += 1;
  }
  const order = [...statusNames.keys()];
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
