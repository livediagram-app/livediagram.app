// History's pure rules: day headings, runs, the filter's kinds, the summary, and a person's colour.
import { describe, expect, it } from 'vitest';
import { PRESENCE_COLOUR_VALUES } from '@liveworkspace/settings/presence';
import { makeEvent } from '../test/fakeClient';
import {
  buildHistory,
  eventCountLabel,
  filterHistory,
  historyCategories,
  historyDayLabel,
  personColour,
  summariseHistory,
} from './history';

// Sunday 25 October 2026, mid-afternoon, local time.
const NOW = new Date(2026, 9, 25, 15, 0).getTime();
const at = (daysAgo: number, hour = 12) => new Date(2026, 9, 25 - daysAgo, hour).getTime();

// The reader's locale words a day; these say what it must hold, in whatever order the locale gives.
const dayIn = (y: number, m: number, d: number, year = false) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  }).format(new Date(y, m - 1, d));

describe('historyDayLabel', () => {
  it('says Today, Yesterday, the weekday within a week, then the date', () => {
    expect(historyDayLabel('2026-10-25', NOW)).toBe('Today');
    expect(historyDayLabel('2026-10-24', NOW)).toBe('Yesterday');
    expect(historyDayLabel('2026-10-21', NOW)).toBe('Wednesday');
    expect(historyDayLabel('2026-10-19', NOW)).toBe('Monday');
    expect(historyDayLabel('2026-10-18', NOW)).toBe(dayIn(2026, 10, 18));
    expect(historyDayLabel('2025-12-30', NOW)).toBe(dayIn(2025, 12, 30, true));
    // Never a forced locale: the reader's own words for the day.
    expect(historyDayLabel('2025-12-30', NOW)).toMatch(/30/);
    expect(historyDayLabel('2025-12-30', NOW)).toMatch(/2025/);
  });
});

describe('buildHistory', () => {
  it('groups by local day and folds consecutive same-kind events by one person', () => {
    const events = [
      makeEvent(1, { id: 'a', type: 'renamed', occurredAt: at(0, 14) }),
      makeEvent(1, { id: 'b', type: 'renamed', occurredAt: at(0, 13) }),
      makeEvent(1, { id: 'c', type: 'renamed', occurredAt: at(0, 12), actorId: 'ada' }),
      makeEvent(1, { id: 'd', type: 'renamed', occurredAt: at(0, 11) }),
      // Same kind and person as the last, but another day: a run never crosses a day.
      makeEvent(1, { id: 'e', type: 'renamed', occurredAt: at(1, 11) }),
    ];
    const days = buildHistory(events, NOW);
    expect(days.map((d) => [d.label, d.count])).toEqual([
      ['Today', 4],
      ['Yesterday', 1],
    ]);
    expect(days[0]!.runs.map((r) => r.events.map((e) => e.id))).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('works out 10,000 loaded events well inside a frame budget', () => {
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeEvent(1, {
        id: `e${i}`,
        type: i % 3 ? 'edited' : 'renamed',
        actorId: `u${i % 4}`,
        occurredAt: NOW - i * 600_000,
      }),
    );
    const t = performance.now();
    const days = buildHistory(events, NOW);
    historyCategories(events);
    summariseHistory(events);
    const ms = performance.now() - t;
    expect(days.reduce((n, d) => n + d.count, 0)).toBe(10_000);
    expect(ms).toBeLessThan(150);
  });
});

describe('filters and summary', () => {
  const events = [
    makeEvent(1, { id: 'a', type: 'edited', actorId: 'me' }),
    makeEvent(1, { id: 'b', type: 'shared', actorId: 'ada' }),
    makeEvent(1, { id: 'c', type: 'unshared', actorId: 'me' }),
    makeEvent(1, { id: 'd', type: 'moved', actorId: null }),
  ];

  it('offers each kind present once, in the fixed order, with counts', () => {
    expect(historyCategories(events)).toEqual([
      { category: 'edits', count: 1 },
      { category: 'sharing', count: 2 },
      { category: 'filing', count: 1 },
    ]);
    expect(filterHistory(events, 'sharing').map((e) => e.id)).toEqual(['b', 'c']);
    expect(filterHistory(events, null)).toBe(events);
  });

  it('counts the people who took part, newest first', () => {
    const summary = summariseHistory(events);
    expect(summary.count).toBe(4);
    expect(summary.people.map((e) => e.actorId)).toEqual(['me', 'ada']);
    expect(eventCountLabel(1, false)).toBe('1 event');
    expect(eventCountLabel(30, true)).toBe('30+ events');
  });

  it('gives each person one colour from the presence palette', () => {
    expect(personColour('user_ada')).toBe(personColour('user_ada'));
    expect(PRESENCE_COLOUR_VALUES).toContain(personColour('user_ada'));
    const spread = new Set(Array.from({ length: 50 }, (_, i) => personColour(`user_${i}`)));
    expect(spread.size).toBeGreaterThan(5);
  });
});
