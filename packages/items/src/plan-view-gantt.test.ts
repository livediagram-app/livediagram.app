import { describe, expect, it } from 'vitest';
import {
  GANTT_MIN_DAYS,
  GANTT_SCALE_DAYS,
  ganttAt,
  ganttDayAt,
  ganttDayShift,
  ganttDrag,
  ganttDrawn,
  ganttFitScale,
  ganttLanes,
  ganttLayout,
  ganttModel,
  ganttNamesWidth,
  GANTT_NAMES_MAX_PX,
  GANTT_NAMES_MIN_PX,
  ganttRescaleFrom,
  ganttStepDays,
  ganttTodayFrom,
  ganttWindow,
} from './plan-view-gantt';
import { dayNumber, dayParts, todayNumber } from './plan-view-dates';
import { item } from './test-items';

const phases = new Map([
  ['todo', 'todo' as const],
  ['done', 'done' as const],
]);
const NOW = new Date(2026, 9, 5, 12);

describe('plan view dates', () => {
  it('reads YYYY-MM-DD as a day number, and nothing else', () => {
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-13-01')).toBeUndefined();
    expect(dayNumber('5 Oct')).toBeUndefined();
    expect(dayNumber(4)).toBeUndefined();
    expect(todayNumber(NOW)).toBe(dayNumber('2026-10-05'));
    // 2026-10-05 is a Monday.
    expect(dayParts(dayNumber('2026-10-05')!).weekday).toBe(0);
  });
});

describe('gantt model', () => {
  it('makes a row per live project, with its mark and its children', () => {
    const bar = item({ title: 'Bar', start: '2026-10-01', due: '2026-10-20' }, { type: 'project' });
    const due = item({ title: 'Due', due: '2026-09-20', status: 'todo' }, { type: 'project' });
    const start = item({ title: 'Start', start: '2026-11-02' }, { type: 'project' });
    const none = item({ title: 'None' }, { type: 'project' });
    const gone = item({ title: 'Gone', archived: true }, { type: 'project' });
    const kids = [
      item({ title: 'k1', parent: bar.id, status: 'done' }),
      item({ title: 'k2', parent: bar.id }),
      item({ title: 'not a project' }),
    ];
    const m = ganttModel([none, start, bar, due, gone, ...kids], phases, NOW);
    expect(m.rows.map((r) => r.item.fields['title'])).toEqual(['Due', 'Bar', 'Start', 'None']);
    const [d, b, s, n] = m.rows;
    expect(b).toMatchObject({ mark: 'bar', done: 1, total: 2, overdue: false });
    expect(b!.to! - b!.from!).toBe(19);
    expect(d).toMatchObject({ mark: 'due', overdue: true });
    expect(s).toMatchObject({ mark: 'start', overdue: false });
    expect(n).toMatchObject({ mark: 'none' });
    expect(n!.from).toBeUndefined();
    expect(m.from).toBe(dayNumber('2026-09-13'));
    expect(m.to).toBe(dayNumber('2026-11-09'));
    expect(m.today).toBe(dayNumber('2026-10-05'));
  });

  it('draws a start after the due date from the due date, and a done project is never overdue', () => {
    const p = item(
      { title: 'P', start: '2026-09-10', due: '2026-09-01', status: 'done' },
      { type: 'project' },
    );
    const [row] = ganttModel([p], phases, NOW).rows;
    expect(row).toMatchObject({ mark: 'bar', isDone: true, overdue: false });
    expect(row!.from).toBe(dayNumber('2026-09-01'));
  });

  it('keeps the axis at least four weeks, ticking Mondays', () => {
    const m = ganttModel([], phases, NOW);
    expect(m.rows).toEqual([]);
    expect(m.to - m.from + 1).toBe(GANTT_MIN_DAYS);
    expect(m.ticks.length).toBeGreaterThanOrEqual(4);
    for (const t of m.ticks) expect(dayParts(t.day).weekday).toBe(0);
    expect(m.ticks[0]!.label).toBe('28 Sep');
    expect(ganttAt(m, m.from)).toBe(0);
    expect(ganttAt(m, m.to + 1)).toBe(1);
  });

  it('ticks months on a long axis, the first and each January with the year', () => {
    const p = item({ title: 'P', start: '2026-10-10', due: '2027-04-01' }, { type: 'project' });
    const m = ganttModel([p], phases, NOW);
    expect(m.ticks.map((t) => t.label)).toEqual([
      'Oct 2026',
      'Nov',
      'Dec',
      'Jan 2027',
      'Feb',
      'Mar',
      'Apr',
    ]);
  });
});

describe('dragging Gantt dates (docs/specs/026-plan/plan-views.md "Dragging dates")', () => {
  const rowOf = (fields: Record<string, string>) =>
    ganttModel([item({ title: 'P', ...fields }, { type: 'project' })], phases, NOW).rows[0]!;

  it('turns pixels into whole days along the axis', () => {
    const m = { from: 0, to: 27 };
    expect(ganttDayShift(m, 100, 280)).toBe(10);
    expect(ganttDayShift(m, -14, 280)).toBe(-1);
    expect(ganttDayShift(m, 4, 280)).toBe(0);
    expect(ganttDayShift(m, 50, 0)).toBe(0);
  });

  it('moves a bar end and writes the field it shows', () => {
    const row = rowOf({ start: '2026-10-01', due: '2026-10-20' });
    expect(ganttDrag(row, 'to', 3)?.set).toEqual({ due: '2026-10-23' });
    expect(ganttDrag(row, 'from', -2)?.set).toEqual({ start: '2026-09-29' });
  });

  it('stops an end at the other end, and changes nothing for no move', () => {
    const row = rowOf({ start: '2026-10-01', due: '2026-10-05' });
    expect(ganttDrag(row, 'from', 30)).toMatchObject({ set: { start: '2026-10-05' } });
    expect(ganttDrag(row, 'to', -30)).toMatchObject({ set: { due: '2026-10-01' } });
    expect(ganttDrag(row, 'to', 0)).toBeNull();
    const flat = rowOf({ start: '2026-10-05', due: '2026-10-05' });
    expect(ganttDrag(flat, 'to', -3)).toBeNull();
  });

  it('writes the due date from the left end when the start is after it', () => {
    const row = rowOf({ start: '2026-10-20', due: '2026-10-01' });
    expect(ganttDrag(row, 'from', 1)?.set).toEqual({ due: '2026-10-02' });
    expect(ganttDrag(row, 'to', 1)?.set).toEqual({ start: '2026-10-21' });
  });

  it('moves the whole bar, both dates by the same days, keeping its length', () => {
    const row = rowOf({ start: '2026-10-01', due: '2026-10-20' });
    expect(ganttDrag(row, 'bar', 5)?.set).toEqual({ start: '2026-10-06', due: '2026-10-25' });
    expect(ganttDrag(row, 'bar', -3)).toMatchObject({ from: row.from! - 3, to: row.to! - 3 });
    expect(ganttDrag(row, 'bar', 0)).toBeNull();
    const flipped = rowOf({ start: '2026-10-20', due: '2026-10-01' });
    expect(ganttDrag(flipped, 'bar', 1)?.set).toEqual({ due: '2026-10-02', start: '2026-10-21' });
  });

  it('moves a diamond its one date, and ignores a row with none', () => {
    expect(ganttDrag(rowOf({ due: '2026-10-10' }), 'mark', -1)?.set).toEqual({ due: '2026-10-09' });
    expect(ganttDrag(rowOf({ start: '2026-10-10' }), 'mark', 2)?.set).toEqual({
      start: '2026-10-12',
    });
    expect(ganttDrag(rowOf({}), 'mark', 2)).toBeNull();
  });
});

describe('Gantt scales and windows (docs/specs/026-plan/plan-views.md "Scale")', () => {
  it('opens on the smallest scale that holds the dates, else Year', () => {
    expect(ganttFitScale({ from: 0, to: 27 })).toBe('month');
    expect(ganttFitScale({ from: 0, to: 60 })).toBe('quarter');
    expect(ganttFitScale({ from: 0, to: 200 })).toBe('year');
    expect(ganttFitScale({ from: 0, to: 900 })).toBe('year');
  });

  it('spans the scale from its start, ticking weeks or months', () => {
    const month = ganttWindow('month', dayNumber('2026-10-01')!);
    expect(month.to - month.from + 1).toBe(GANTT_SCALE_DAYS.month);
    for (const t of month.ticks) expect(dayParts(t.day).weekday).toBe(0);
    const year = ganttWindow('year', dayNumber('2026-01-01')!);
    expect(year.ticks.map((t) => t.label).slice(0, 3)).toEqual(['Jan 2026', 'Feb', 'Mar']);
  });

  it('puts today a quarter in, keeps the middle on a rescale, and steps a third', () => {
    expect(ganttTodayFrom('quarter', 100)).toBe(78);
    const from = ganttRescaleFrom(0, 'month', 'year');
    expect(from + Math.floor(GANTT_SCALE_DAYS.year / 2)).toBe(17);
    expect(ganttStepDays('month')).toBe(12);
    expect(ganttStepDays('year')).toBe(122);
  });
});

describe('drawing Gantt dates (docs/specs/026-plan/plan-views.md "Drawing dates")', () => {
  it('finds the day under a point, inside the window', () => {
    const w = { from: 100, to: 134 };
    expect(ganttDayAt(w, 0)).toBe(100);
    expect(ganttDayAt(w, 0.5)).toBe(117);
    expect(ganttDayAt(w, 1)).toBe(134);
    expect(ganttDayAt(w, -0.2)).toBe(100);
  });

  it('draws the days a drag spans, either way, or a week from a click', () => {
    const d = dayNumber('2026-10-05')!;
    expect(ganttDrawn(d + 3, d).set).toEqual({ start: '2026-10-05', due: '2026-10-08' });
    expect(ganttDrawn(d, d).set).toEqual({ start: '2026-10-05', due: '2026-10-11' });
  });
});

describe('Gantt swimlanes (docs/specs/026-plan/plan-views.md "Swimlanes")', () => {
  const a = item({ title: 'A', priority: 'low', start: '2026-10-01' }, { type: 'project' });
  const b = item({ title: 'B', priority: 'urgent', start: '2026-10-02' }, { type: 'project' });
  const c = item({ title: 'C', start: '2026-10-03' }, { type: 'project' });
  const items = new Map([a, b, c].map((i) => [i.id, i]));
  const rows = ganttModel(items.values(), phases, NOW).rows;

  it('is one unnamed lane of every row without swimlanes', () => {
    expect(ganttLanes(rows, 'none', undefined, items)).toEqual([{ lane: null, rows }]);
  });

  it('groups as a board orders lanes, only lanes with rows, rows in the chart order', () => {
    const lanes = ganttLanes(rows, 'priority', undefined, items);
    expect(lanes.map((l) => l.lane?.label)).toEqual(['Urgent', 'Low', 'No priority']);
    expect(lanes.map((l) => l.rows.map((r) => r.item.fields['title']))).toEqual([
      ['B'],
      ['A'],
      ['C'],
    ]);
  });

  it('falls back to one lane for a field no type offers', () => {
    expect(ganttLanes(rows, 'field', 'c-gone', items)).toHaveLength(1);
  });

  it('lays out lane headers and rows top down, skipping a collapsed lane’s rows', () => {
    const lanes = ganttLanes(rows, 'priority', undefined, items);
    const { entries, height } = ganttLayout(lanes, new Set([lanes[0]!.lane!.key]), 30, 24);
    expect(entries.map((e) => [e.kind, e.top])).toEqual([
      ['lane', 0],
      ['lane', 24],
      ['row', 48],
      ['lane', 78],
      ['row', 102],
    ]);
    expect(height).toBe(132);
  });
});

describe('the Gantt names column width', () => {
  it('stays between the minimum and a share of the chart', () => {
    expect(ganttNamesWidth(50, 1000)).toBe(GANTT_NAMES_MIN_PX);
    expect(ganttNamesWidth(300, 1000)).toBe(300);
    expect(ganttNamesWidth(900, 1000)).toBe(600);
    expect(ganttNamesWidth(300, 100)).toBe(GANTT_NAMES_MIN_PX);
  });

  it('never passes what a saved width may be, however wide the chart', () => {
    expect(ganttNamesWidth(2400, 4000)).toBe(GANTT_NAMES_MAX_PX);
    expect(ganttNamesWidth(5000, 10000)).toBe(GANTT_NAMES_MAX_PX);
  });
});

// docs/specs/026-plan/plan-views.md "Gantt Chart": the card types a chart draws.
describe('the Gantt chart’s card types', () => {
  it('draws Projects by default, and any types the chart names instead', () => {
    const p = item({ title: 'P' }, { type: 'project' });
    const t = item({ title: 'T', start: '2026-10-01', due: '2026-10-05' }, { type: 'task' });
    const c = item({ title: 'C' }, { type: 'campaign' });
    expect(ganttModel([p, t, c], phases, NOW).rows.map((r) => r.item.fields['title'])).toEqual([
      'P',
    ]);
    const named = ganttModel([p, t, c], phases, NOW, ['task', 'campaign']).rows;
    expect(named.map((r) => r.item.fields['title'])).toEqual(['T', 'C']);
    expect(named[0]).toMatchObject({ mark: 'bar' });
  });

  it('counts a row’s children by parent whatever its type', () => {
    const t = item({ title: 'T' }, { type: 'task' });
    const kid = item({ title: 'K', parent: t.id, status: 'done' });
    expect(
      ganttModel([t, kid], phases, NOW, ['task']).rows.find((r) => r.item.id === t.id),
    ).toMatchObject({
      done: 1,
      total: 1,
    });
  });
});
