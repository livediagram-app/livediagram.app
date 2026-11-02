import { describe, expect, it } from 'vitest';
import { makeEvent } from '../test/fakeClient';
import {
  dayHeading,
  groupsByDay,
  groupWhatHappened,
  initials,
  peopleList,
  personName,
  verbList,
} from './whatHappened';

const noon = new Date(2026, 9, 21, 12).getTime();
const HOUR = 3_600_000;
const by = (actorId: string | null, actorName: string | null = null) => ({ actorId, actorName });

// The reader's locale words a day; these say what it must hold, in whatever order the locale gives.
const dayIn = (y: number, m: number, d: number, year = false) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  }).format(new Date(y, m - 1, d));

describe('What Happened’s rules', () => {
  it('keeps other people’s doings only, one group per item per day', () => {
    const groups = groupWhatHappened(
      [
        makeEvent(1, { ...by('sam', 'Sam Lee'), type: 'edited', occurredAt: noon }),
        makeEvent(2, { ...by('me'), type: 'renamed', occurredAt: noon - HOUR }),
        makeEvent(3, { ...by(null), type: 'shared', occurredAt: noon - HOUR }),
        makeEvent(4, { ...by('sam', 'Sam Lee'), type: 'favourited', occurredAt: noon }),
        makeEvent(5, {
          ...by('ana', 'Ana Ruiz'),
          type: 'renamed',
          itemId: makeEvent(1).itemId,
          item: makeEvent(1).item,
          occurredAt: noon - 2 * HOUR,
        }),
        makeEvent(6, {
          ...by('sam', 'Sam Lee'),
          type: 'moved',
          itemId: makeEvent(1).itemId,
          item: makeEvent(1).item,
          occurredAt: noon - 30 * HOUR,
        }),
      ],
      'me',
    );
    expect(groups.map((g) => [g.id.split(':')[1], g.actions.map((a) => a.id), g.summary])).toEqual([
      ['2026-10-21', ['ev-1', 'ev-5'], true],
      ['2026-10-20', ['ev-6'], false],
    ]);
    expect(groups[0]!.people.map((p) => p.name)).toEqual(['Sam Lee', 'Ana Ruiz']);
    expect(groups[0]!.verbs).toEqual(['edited', 'renamed']);
  });

  it('words people, verbs and days as livediagram does', () => {
    const p = (name: string) => ({ id: name, name });
    expect(peopleList([p('Priya')])).toBe('Priya');
    expect(peopleList([p('Priya'), p('Sam')])).toBe('Priya and Sam');
    expect(peopleList([p('A'), p('B'), p('C'), p('D'), p('E')])).toBe('A, B, C and 2 others');
    expect(verbList(['edited', 'renamed', 'trashed'])).toBe('edited, renamed and trashed');
    expect(personName(by('x'))).toBe('A teammate');
    expect(personName(by('deleted'))).toBe('A closed account');
    expect(initials('Sam van der Lee')).toBe('SL');
    expect(initials('A teammate')).toBeNull();
    expect(dayHeading('2026-10-21', noon)).toBe('Today');
    expect(dayHeading('2026-10-20', noon)).toBe('Yesterday');
    expect(dayHeading('2026-10-14', noon)).toBe(dayIn(2026, 10, 14));
    expect(dayHeading('2025-10-14', noon)).toBe(dayIn(2025, 10, 14, true));
  });

  it('groups a full page under its days quickly', () => {
    const events = Array.from({ length: 10_000 }, (_, i) =>
      makeEvent(i % 300, {
        id: `e${i}`,
        ...by(`p${i % 7}`, `Person ${i % 7}`),
        type: (['edited', 'renamed', 'moved'] as const)[i % 3],
        occurredAt: noon - i * 60_000,
      }),
    );
    const start = performance.now();
    const days = groupsByDay(groupWhatHappened(events, 'me'), noon);
    const ms = performance.now() - start;
    expect(days.length).toBeGreaterThan(1);
    expect(ms).toBeLessThan(200);
  });
});
