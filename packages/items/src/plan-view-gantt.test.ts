import { describe, expect, it } from 'vitest';
import { GANTT_MIN_DAYS, ganttAt, ganttModel } from './plan-view-gantt';
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
