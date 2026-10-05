// The Project Gantt Chart's model (docs/specs/026-plan/plan-views.md "Project Gantt Chart"): a row per live
// Project card with its dates, its children's progress, and the time axis they sit on. Pure; the editor
// draws it with the row fractions this gives.
import type { Item } from './item';
import { dayNumber, dayParts, MONTH_SHORT, monthStart, todayNumber } from './plan-view-dates';
import { liveCards, phaseOf, type StatusPhase } from './plan-views';

// Days of axis either side of the dates, the shortest axis, and the longest that still ticks weeks.
export const GANTT_PAD_DAYS = 7;
export const GANTT_MIN_DAYS = 28;
export const GANTT_WEEK_TICKS_MAX_DAYS = 120;

export type GanttMark = 'bar' | 'due' | 'start' | 'none';

export interface GanttRow {
  item: Item;
  mark: GanttMark;
  // Inclusive day numbers: a bar's ends, or both the mark's day.
  from?: number;
  to?: number;
  // Children (cards whose parent is this project) done of all.
  done: number;
  total: number;
  // Not done and past its due date.
  overdue: boolean;
  isDone: boolean;
}

export interface GanttModel {
  rows: GanttRow[];
  // The axis, inclusive day numbers.
  from: number;
  to: number;
  today: number;
  ticks: { day: number; label: string }[];
}

function rowOf(
  project: Item,
  kids: readonly Item[],
  phases: ReadonlyMap<string, StatusPhase>,
  today: number,
): GanttRow {
  const start = dayNumber(project.fields['start']);
  const due = dayNumber(project.fields['due']);
  const isDone = phaseOf(project, phases) === 'done';
  const done = kids.filter((k) => phaseOf(k, phases) === 'done').length;
  const overdue = !isDone && due !== undefined && due < today;
  const base = { item: project, done, total: kids.length, overdue, isDone };
  if (start !== undefined && due !== undefined)
    return { ...base, mark: 'bar', from: Math.min(start, due), to: Math.max(start, due) };
  if (due !== undefined) return { ...base, mark: 'due', from: due, to: due };
  if (start !== undefined) return { ...base, mark: 'start', from: start, to: start };
  return { ...base, mark: 'none' };
}

function ticksFor(from: number, to: number): { day: number; label: string }[] {
  const ticks: { day: number; label: string }[] = [];
  if (to - from + 1 <= GANTT_WEEK_TICKS_MAX_DAYS) {
    // Mondays.
    let day = from + ((7 - dayParts(from).weekday) % 7);
    for (; day <= to; day += 7) {
      const p = dayParts(day);
      ticks.push({ day, label: `${p.date} ${MONTH_SHORT[p.month]}` });
    }
    return ticks;
  }
  let { year, month } = dayParts(from);
  if (dayParts(from).date !== 1) month += 1;
  for (;;) {
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const day = monthStart(year, month);
    if (day > to) break;
    ticks.push({
      day,
      label:
        month === 0 || ticks.length === 0 ? `${MONTH_SHORT[month]} ${year}` : MONTH_SHORT[month]!,
    });
    month += 1;
  }
  return ticks;
}

export function ganttModel(
  items: Iterable<Item>,
  phases: ReadonlyMap<string, StatusPhase>,
  now: Date,
): GanttModel {
  const live = liveCards(items);
  const today = todayNumber(now);
  const kidsOf = new Map<string, Item[]>();
  for (const it of live) {
    const parent = it.fields['parent'];
    if (typeof parent !== 'string') continue;
    const list = kidsOf.get(parent);
    if (list) list.push(it);
    else kidsOf.set(parent, [it]);
  }
  const rows = live
    .filter((it) => it.type === 'project')
    .map((p) => rowOf(p, kidsOf.get(p.id) ?? [], phases, today))
    .sort((a, b) => {
      if (a.from === undefined) return b.from === undefined ? a.item.key - b.item.key : 1;
      if (b.from === undefined) return -1;
      return a.from - b.from || a.item.key - b.item.key;
    });
  let lo = today;
  let hi = today;
  for (const r of rows) {
    if (r.from !== undefined) lo = Math.min(lo, r.from);
    if (r.to !== undefined) hi = Math.max(hi, r.to);
  }
  const from = lo - GANTT_PAD_DAYS;
  const to = Math.max(hi + GANTT_PAD_DAYS, from + GANTT_MIN_DAYS - 1);
  return { rows, from, to, today, ticks: ticksFor(from, to) };
}

// Where a day starts along the axis, 0 to 1.
export function ganttAt(model: Pick<GanttModel, 'from' | 'to'>, day: number): number {
  return (day - model.from) / (model.to - model.from + 1);
}
