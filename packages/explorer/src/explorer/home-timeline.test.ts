// Home's timeline and Most Used's day chart, as pure functions (one-explorer.md "Recent, a timeline", "Most Used, in
// the rail"): made and opened items merged newest first and grouped by local day, each day's heading and each row's
// clock; a day's strength against the busiest day, and the chart's sentence for a screen reader.
import { describe, expect, it } from 'vitest';
import { dayChartLabel, dayLevel } from './DayChart';
import { clockOf, dayHeading, timelineDays } from './HomeTimeline';
import { makeItem } from '../test/fakeClient';

// Tuesday 24 November 2026, 14:30 local time.
const NOW = new Date(2026, 10, 24, 14, 30).getTime();
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).getTime();

describe('timelineDays', () => {
  it('merges made and opened newest first, grouped by local day, an opened one by its last open', () => {
    const made = [makeItem(1, { createdAt: at(24, 9) }), makeItem(2, { createdAt: at(22, 18) })];
    const opened = [
      makeItem(3, { lastOpenedAt: at(24, 13), createdAt: 1 }),
      makeItem(4, { lastOpenedAt: at(23, 23, 59), createdAt: 1 }),
      // Never opened: its last change places it.
      makeItem(5, { lastOpenedAt: null, updatedAt: at(24, 8), createdAt: 1 }),
    ];
    const days = timelineDays(made, opened);
    expect(days.map((d) => d.events.map((e) => [e.item.id, e.made]))).toEqual([
      [
        ['item-3', false],
        ['item-1', true],
        ['item-5', false],
      ],
      [['item-4', false]],
      [['item-2', true]],
    ]);
  });

  it('is empty with nothing made or opened', () => {
    expect(timelineDays([], [])).toEqual([]);
  });
});

describe('dayHeading', () => {
  it('says Today, Yesterday, the weekday within the week, then the date', () => {
    expect(dayHeading(at(24, 0, 5), NOW)).toBe('Today');
    expect(dayHeading(at(23, 23), NOW)).toBe('Yesterday');
    expect(dayHeading(at(21, 12), NOW)).toBe('Saturday');
    expect(dayHeading(at(18, 12), NOW)).toBe('Wednesday');
    expect(dayHeading(at(17, 12), NOW)).toBe('Tue 17 Nov');
    // Another year's says which.
    expect(dayHeading(new Date(2025, 11, 30, 9).getTime(), NOW)).toBe('Tue 30 Dec 2025');
  });

  it('reads the clock in 24 hours, local time', () => {
    expect(clockOf(at(24, 9, 5))).toBe('09:05');
    expect(clockOf(at(24, 21, 40))).toBe('21:40');
  });
});

describe('the day chart', () => {
  it('steps each day up to the busiest across the list, leaving a day with none empty', () => {
    expect(dayLevel(0, 8)).toBe(0);
    expect(dayLevel(1, 8)).toBe(1);
    expect(dayLevel(3, 8)).toBe(2);
    expect(dayLevel(5, 8)).toBe(3);
    expect(dayLevel(8, 8)).toBe(4);
    // Nothing opened anywhere: nothing lit.
    expect(dayLevel(2, 0)).toBe(0);
  });

  it('says how many days it was opened on, and today’s opens', () => {
    const quiet = [1, 0, 0, 2, ...Array(10).fill(0)];
    expect(dayChartLabel(quiet)).toBe('Opened on 2 of the last 14 days');
    expect(dayChartLabel([...Array(13).fill(0), 1])).toBe(
      'Opened on 1 of the last 14 days, once today',
    );
  });
});
