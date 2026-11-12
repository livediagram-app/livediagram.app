import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceVisit } from '@livehuddle/api-schema';
import { clockTime, dayLabel, groupVisitsByDay, visitLength, visitTimes } from './tab-attendance';

// What a tab's Attendance dialog shows (docs/specs/012-collaboration/tab-attendance.md "Where it shows"): the visits
// by the reader's local day, and each one's times and length. The clock is pinned: the days are "Today" and
// "Yesterday" from it.

const NOW = new Date(2026, 10, 11, 15, 30).getTime();
const at = (day: number, hour: number, minute = 0, month = 10, year = 2026) =>
  new Date(year, month, day, hour, minute).getTime();
const visit = (id: number, joinedAt: number, leftAt: number | null): AttendanceVisit => ({
  id,
  name: `P${id}`,
  color: '#0ea5e9',
  guest: false,
  self: false,
  joinedAt,
  leftAt,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('days', () => {
  it('names today, yesterday, then the date, with the year when it is another', () => {
    expect(dayLabel(at(11, 9), NOW)).toBe('Today');
    expect(dayLabel(at(10, 23, 59), NOW)).toBe('Yesterday');
    expect(dayLabel(at(9, 12), NOW)).toBe('Mon 9 Nov');
    expect(dayLabel(at(31, 12, 0, 11, 2025), NOW)).toBe('Wed 31 Dec 2025');
  });

  it('groups visits by the day each started, keeping their order', () => {
    const days = groupVisitsByDay(
      [
        visit(3, at(11, 14), null),
        visit(2, at(11, 9), at(11, 10)),
        visit(1, at(10, 9), at(10, 9, 30)),
      ],
      NOW,
    );
    expect(days.map((d) => [d.label, d.visits.map((v) => v.id)])).toEqual([
      ['Today', [3, 2]],
      ['Yesterday', [1]],
    ]);
    expect(groupVisitsByDay([], NOW)).toEqual([]);
  });
});

describe('a visit', () => {
  it('says how long it lasted, short and in words', () => {
    expect(visitLength(visit(1, at(11, 9), at(11, 9, 0) + 30_000), NOW)).toEqual({
      short: 'Under a minute',
      spoken: 'under a minute',
    });
    expect(visitLength(visit(1, at(11, 9), at(11, 9, 1)), NOW)).toEqual({
      short: '1 min',
      spoken: '1 minute',
    });
    expect(visitLength(visit(1, at(11, 9), at(11, 9, 45)), NOW).short).toBe('45 min');
    expect(visitLength(visit(1, at(11, 9), at(11, 10)), NOW)).toEqual({
      short: '1 hr',
      spoken: '1 hour',
    });
    expect(visitLength(visit(1, at(11, 9), at(11, 11, 5)), NOW)).toEqual({
      short: '2 hr 5 min',
      spoken: '2 hours 5 minutes',
    });
    // Still open: counted up to now.
    expect(visitLength(visit(1, at(11, 15), null), NOW).short).toBe('30 min');
    // A clock skew never shows a negative length.
    expect(visitLength(visit(1, NOW + 5_000, NOW), NOW).short).toBe('Under a minute');
  });

  it('says when it began and ended, naming the day when it ran past midnight', () => {
    expect(clockTime(at(11, 14, 2))).toBe('14:02');
    expect(visitTimes(visit(1, at(11, 14, 2), at(11, 14, 47)))).toBe('Joined 14:02 · Left 14:47');
    expect(visitTimes(visit(1, at(11, 14, 2), null))).toBe('Joined 14:02');
    expect(visitTimes(visit(1, at(10, 23, 30), at(11, 0, 15)))).toBe(
      'Joined 23:30 · Left Wed 11 Nov, 00:15',
    );
  });
});
