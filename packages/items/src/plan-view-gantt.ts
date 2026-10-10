// The Gantt Chart's model (docs/specs/026-plan/plan-views.md "Gantt Chart"): a row per live card of the chart's
// card types (Project by default) with its dates, its children's progress, and the time axis they sit on. Pure; the editor
// draws it with the row fractions this gives.
import type { Item } from './item';
import {
  dayKey,
  dayNumber,
  dayParts,
  MONTH_SHORT,
  monthStart,
  todayNumber,
} from './plan-view-dates';
import { GANTT_DEFAULT_TYPES, liveCards, phaseOf, type StatusPhase } from './plan-views';
import { laneGroups, type LaneHead, type SwimlaneBy } from './board';
import type { ItemTypeDef } from './item-types';

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
  // The card types the chart draws (ganttTypesOf): Project unless the chart names others.
  types: readonly string[] = GANTT_DEFAULT_TYPES,
): GanttModel {
  const accepted = new Set(types);
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
    .filter((it) => accepted.has(it.type))
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

// What of a row's mark is dragged (docs/specs/026-plan/plan-views.md "Dragging dates"): a bar's left or right
// end, the whole bar (both dates together), or a diamond's one day.
export type GanttEdge = 'from' | 'to' | 'bar' | 'mark';

// Whole days a horizontal drag of `deltaPx` moves along an axis drawn `axisPx` wide.
export function ganttDayShift(
  model: Pick<GanttModel, 'from' | 'to'>,
  deltaPx: number,
  axisPx: number,
): number {
  if (axisPx <= 0) return 0;
  return Math.round((deltaPx * (model.to - model.from + 1)) / axisPx) || 0;
}

// A row's mark with one end moved `days`: its new ends, and the field write that makes them, or null when
// nothing changes. A bar's end stops at the other end; it writes the field that end shows (the earlier of
// start and due is the left end).
export function ganttDrag(
  row: Pick<GanttRow, 'mark' | 'from' | 'to' | 'item'>,
  edge: GanttEdge,
  days: number,
): { from: number; to: number; set: Record<string, string> } | null {
  if (row.mark === 'none' || row.from === undefined || row.to === undefined || days === 0)
    return null;
  if (row.mark !== 'bar') {
    const day = row.from + days;
    return { from: day, to: day, set: { [row.mark]: dayKey(day) } };
  }
  const startIsLeft =
    (dayNumber(row.item.fields['start']) ?? row.from) <=
    (dayNumber(row.item.fields['due']) ?? row.to);
  if (edge === 'bar' || edge === 'mark') {
    const from = row.from + days;
    const to = row.to + days;
    const [left, right] = startIsLeft ? ['start', 'due'] : ['due', 'start'];
    return { from, to, set: { [left]: dayKey(from), [right]: dayKey(to) } };
  }
  if (edge === 'to') {
    const to = Math.max(row.from, row.to + days);
    if (to === row.to) return null;
    return { from: row.from, to, set: { [startIsLeft ? 'due' : 'start']: dayKey(to) } };
  }
  const from = Math.min(row.to, row.from + days);
  if (from === row.from) return null;
  return { from, to: row.to, set: { [startIsLeft ? 'start' : 'due']: dayKey(from) } };
}

// The chart's scales (docs/specs/026-plan/plan-views.md "Scale"): how many days the window shows.
export const GANTT_SCALES = ['month', 'quarter', 'year'] as const;
export type GanttScale = (typeof GANTT_SCALES)[number];
export const GANTT_SCALE_DAYS: Record<GanttScale, number> = { month: 35, quarter: 91, year: 365 };
export const GANTT_SCALE_LABELS: Record<GanttScale, string> = {
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

// A window of the axis: inclusive day numbers and its ticks.
export type GanttWindow = Pick<GanttModel, 'from' | 'to' | 'ticks'>;

// The smallest scale that holds every date the model spans, else Year.
export function ganttFitScale(model: Pick<GanttModel, 'from' | 'to'>): GanttScale {
  const span = model.to - model.from + 1;
  return GANTT_SCALES.find((s) => GANTT_SCALE_DAYS[s] >= span) ?? 'year';
}

export function ganttWindow(scale: GanttScale, from: number): GanttWindow {
  const to = from + GANTT_SCALE_DAYS[scale] - 1;
  return { from, to, ticks: ticksFor(from, to) };
}

// Where a window starts so today sits a quarter of the way in.
export function ganttTodayFrom(scale: GanttScale, today: number): number {
  return today - Math.floor(GANTT_SCALE_DAYS[scale] / 4);
}

// A window at a new scale keeping the old window's middle.
export function ganttRescaleFrom(from: number, scale: GanttScale, next: GanttScale): number {
  const middle = from + Math.floor(GANTT_SCALE_DAYS[scale] / 2);
  return middle - Math.floor(GANTT_SCALE_DAYS[next] / 2);
}

// One step of the header's ‹ ›: a third of the window.
export function ganttStepDays(scale: GanttScale): number {
  return Math.round(GANTT_SCALE_DAYS[scale] / 3);
}

// The names column's width (docs/specs/026-plan/plan-views.md "Names column width"): never under the minimum,
// never over a share of the chart; null keeps the default `min(220px, 33%)`.
export const GANTT_NAMES_MIN_PX = 120;
export const GANTT_NAMES_MAX_SHARE = 0.6;
export const GANTT_NAMES_STEP_PX = 16;
// The widest a saved width may be, whatever the chart (a sanity bound for validation).
export const GANTT_NAMES_MAX_PX = 2000;

export function ganttNamesWidth(width: number, chartPx: number): number {
  // Never past what a saved width may be (isPlanViewSettings), however wide the chart.
  const max = Math.min(
    GANTT_NAMES_MAX_PX,
    Math.max(GANTT_NAMES_MIN_PX, Math.floor(chartPx * GANTT_NAMES_MAX_SHARE)),
  );
  return Math.round(Math.min(max, Math.max(GANTT_NAMES_MIN_PX, width)));
}

// The chart's rows grouped into swimlanes (docs/specs/026-plan/plan-views.md "Swimlanes"): the board's lanes
// (laneGroups), only those with rows, rows in the chart's order. `none` is one lane of every row, unnamed.
export interface GanttLane {
  lane: LaneHead | null;
  rows: GanttRow[];
}

export function ganttLanes(
  rows: readonly GanttRow[],
  swimlaneBy: SwimlaneBy | undefined,
  swimlaneField: string | undefined,
  items: ReadonlyMap<string, Item>,
  types?: readonly ItemTypeDef[],
  statusNames?: ReadonlyMap<string, string>,
): GanttLane[] {
  if (!swimlaneBy || swimlaneBy === 'none') return [{ lane: null, rows: [...rows] }];
  const groups = laneGroups(
    swimlaneBy,
    swimlaneField,
    rows.map((r) => r.item),
    items,
    types,
    statusNames,
  );
  if (groups.by === 'none') return [{ lane: null, rows: [...rows] }];
  return groups.lanes
    .map((lane) => ({
      lane,
      rows: rows.filter((r) => groups.laneOfItem.get(r.item.id) === lane.key),
    }))
    .filter((l) => l.rows.length > 0);
}

// Where each entry sits, top down: a lane's header (when it has a name) then its rows, unless it is collapsed.
export type GanttLayoutEntry =
  | { kind: 'lane'; lane: LaneHead; count: number; collapsed: boolean; top: number }
  | { kind: 'row'; row: GanttRow; top: number };

export function ganttLayout(
  lanes: readonly GanttLane[],
  collapsed: ReadonlySet<string>,
  rowH: number,
  laneH: number,
): { entries: GanttLayoutEntry[]; height: number } {
  const entries: GanttLayoutEntry[] = [];
  let top = 0;
  for (const { lane, rows } of lanes) {
    const shut = lane ? collapsed.has(lane.key) : false;
    if (lane) {
      entries.push({ kind: 'lane', lane, count: rows.length, collapsed: shut, top });
      top += laneH;
    }
    if (shut) continue;
    for (const row of rows) {
      entries.push({ kind: 'row', row, top });
      top += rowH;
    }
  }
  return { entries, height: top };
}

// Drawing dates on a project that has none (docs/specs/026-plan/plan-views.md "Drawing dates"): a click gives a
// bar this many days long from the day pressed; a drag gives the days it spans.
export const GANTT_NEW_BAR_DAYS = 7;

// The day under a point along the window, from its share of the axis width (0 at the left edge).
export function ganttDayAt(window: Pick<GanttModel, 'from' | 'to'>, share: number): number {
  const days = window.to - window.from + 1;
  return window.from + Math.min(days - 1, Math.max(0, Math.floor(share * days)));
}

// The start and due a draw writes: the days between `a` and `b` (either order), or a new bar from `a` when
// they are the same day (a click).
export function ganttDrawn(
  a: number,
  b: number,
): { from: number; to: number; set: Record<string, string> } {
  const from = Math.min(a, b);
  const to = a === b ? a + GANTT_NEW_BAR_DAYS - 1 : Math.max(a, b);
  return { from, to, set: { start: dayKey(from), due: dayKey(to) } };
}
