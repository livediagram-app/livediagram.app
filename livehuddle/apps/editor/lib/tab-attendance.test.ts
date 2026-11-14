import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceVisit } from '@livehuddle/api-schema';
import {
  clockTime,
  dayLabel,
  groupVisitsByDay,
  liveNamesFrom,
  liveNamesSignature,
  liveVisit,
  visitLength,
  visitTimes,
} from './tab-attendance';

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

// An open dialog follows the room's roster (Work Tracker 825): an open visit takes its person's name and colour now.
describe('liveVisit', () => {
  const open = { ...visit(1, at(11, 14), null), key: 'k1' };
  const live = liveNamesFrom(
    liveNamesSignature([
      { key: 'k1', name: 'Ada Renamed', color: '#f97316' },
      { name: 'No key', color: '#000' },
    ]),
  );

  it('lays the roster name and colour over an open visit with a key', () => {
    expect(liveVisit(open, live)).toEqual({ ...open, name: 'Ada Renamed', color: '#f97316' });
  });

  it('hands back the same visit when nothing changes, so a memoised row stays put', () => {
    const same = { ...open, name: 'Ada Renamed', color: '#f97316' };
    expect(liveVisit(same, live)).toBe(same);
    expect(liveVisit(open, undefined)).toBe(open);
    const away = { ...open, key: 'k-away' };
    expect(liveVisit(away, live)).toBe(away);
    const noKey = visit(2, at(11, 14), null);
    expect(liveVisit(noKey, live)).toBe(noKey);
  });

  it('never rewrites a closed visit, which keeps the name it ended with', () => {
    const closed = { ...visit(3, at(11, 13), at(11, 14)), key: 'k1' };
    expect(liveVisit(closed, live)).toBe(closed);
  });
});

describe('liveNamesSignature and liveNamesFrom', () => {
  it('keys the roster by collab key, the first entry winning, and skips anyone without one', () => {
    const live = liveNamesFrom(
      liveNamesSignature([
        { key: 'me', name: 'Me', color: '#111' },
        { key: 'me', name: 'Me elsewhere', color: '#222' },
        { name: 'Older client', color: '#333' },
      ]),
    );
    expect([...live]).toEqual([['me', { name: 'Me', color: '#111' }]]);
  });

  it('changes only when a key, name or colour does', () => {
    const a = liveNamesSignature([{ key: 'k', name: 'A', color: '#111' }]);
    expect(liveNamesSignature([{ key: 'k', name: 'A', color: '#111' }])).toBe(a);
    expect(liveNamesSignature([{ key: 'k', name: 'B', color: '#111' }])).not.toBe(a);
    expect(liveNamesSignature([{ key: 'k', name: 'A', color: '#222' }])).not.toBe(a);
  });
});
