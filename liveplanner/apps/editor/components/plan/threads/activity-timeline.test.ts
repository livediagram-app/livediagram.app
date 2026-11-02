import { describe, expect, it } from 'vitest';
import type { ItemHistoryChange, ItemHistoryEntry } from '@liveplanner/items';
import {
  ACTIVITY_RUN_GAP_MS,
  activityTimeline,
  dayHeading,
  previousValues,
} from './activity-timeline';

// The Activity tab's timeline (docs/specs/026-plan/items.md "History" "Where it shows"): day groups, runs of one
// person, and the values each change replaced.

const NOW = new Date(2026, 9, 31, 15, 0).getTime();
const SAM = { name: 'Sam', color: '#2563eb' };
const ADA = { name: 'Ada', color: '#16a34a' };
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();
const entry = (
  when: number,
  changes: ItemHistoryChange[] = [{ kind: 'flagged' }],
  extra: Partial<ItemHistoryEntry> = {},
): ItemHistoryEntry => ({ at: when, by: SAM, changes, ...extra });

describe('dayHeading', () => {
  it('reads Today, Yesterday, then the date, with the year only when it is not this one', () => {
    expect(dayHeading(at(31, 9), NOW)).toBe('Today');
    expect(dayHeading(at(30, 23), NOW)).toBe('Yesterday');
    const older = dayHeading(at(27, 9), NOW);
    expect(older).not.toMatch(/Today|Yesterday|2026/);
    expect(older).toMatch(/27/);
    expect(dayHeading(new Date(2025, 4, 2).getTime(), NOW)).toMatch(/2025/);
  });
});

describe('previousValues', () => {
  it('finds what each set or cleared field held, from the older entries', () => {
    const entries = [
      entry(at(31, 12), [{ kind: 'cleared', field: 'priority' }]),
      entry(at(31, 11), [{ kind: 'set', field: 'priority', value: 'high' }, { kind: 'flagged' }]),
      entry(at(31, 10), [{ kind: 'set', field: 'priority', value: 'low' }]),
      entry(at(31, 9), [{ kind: 'set', field: 'description' }]),
      entry(at(31, 8), [{ kind: 'set', field: 'description', value: 'x' }]),
    ];
    expect(previousValues(entries)).toEqual([
      ['high'],
      ['low', undefined],
      [undefined],
      ['x'],
      [undefined],
    ]);
  });

  it('reads a cleared field as empty, and a field named but not copied as unknown from there on', () => {
    const entries = [
      entry(at(31, 12), [{ kind: 'set', field: 'notes', value: 'b' }]),
      entry(at(31, 11), [{ kind: 'set', field: 'notes' }]),
      entry(at(31, 10), [{ kind: 'set', field: 'due', value: '2026-11-01' }]),
      entry(at(31, 9), [
        { kind: 'cleared', field: 'due' },
        { kind: 'set', field: 'notes', value: 'a' },
      ]),
    ];
    expect(previousValues(entries)).toEqual([[undefined], ['a'], [null], [undefined, undefined]]);
  });
});

describe('activityTimeline', () => {
  it('groups by day, newest first, and one person’s close entries into a run', () => {
    const entries = [
      entry(at(31, 14, 50)),
      entry(at(31, 14, 30)),
      entry(at(31, 14, 25), undefined, { by: ADA }),
      entry(at(31, 13, 0)),
      entry(at(30, 9)),
    ];
    const days = activityTimeline(entries, NOW);
    expect(days.map((d) => d.heading)).toEqual(['Today', 'Yesterday']);
    expect(days[0]!.runs.map((r) => [r.by.name, r.entries.length])).toEqual([
      ['Sam', 2],
      ['Ada', 1],
      ['Sam', 1],
    ]);
    expect(days[1]!.runs).toHaveLength(1);
  });

  it('breaks a run past the gap, across a day, between an agent and the person, and between you and others', () => {
    const gap = ACTIVITY_RUN_GAP_MS;
    const base = at(31, 14);
    const runs = (entries: ItemHistoryEntry[]) =>
      activityTimeline(entries, NOW).flatMap((d) => d.runs.map((r) => r.entries.length));
    expect(runs([entry(base), entry(base - gap)])).toEqual([2]);
    expect(runs([entry(base), entry(base - gap - 1)])).toEqual([1, 1]);
    expect(runs([entry(base), entry(base - 1, undefined, { tag: 'ai' })])).toEqual([1, 1]);
    expect(runs([entry(base), entry(base - 1, undefined, { mine: true })])).toEqual([1, 1]);
    expect(runs([entry(at(31, 0, 5)), entry(at(30, 23, 55))])).toEqual([1, 1]);
    // An undo or a form's entry stays in the person's run.
    expect(runs([entry(base), entry(base - 1, undefined, { tag: 'undo' })])).toEqual([2]);
  });

  it('marks a run as yours or an agent’s', () => {
    const [day] = activityTimeline(
      [entry(at(31, 14), undefined, { mine: true }), entry(at(31, 9), undefined, { tag: 'ai' })],
      NOW,
    );
    expect(day!.runs.map((r) => [r.mine, r.ai])).toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it('draws the first `limit` entries, reading earlier values from all of them', () => {
    const entries = [
      entry(at(31, 14), [{ kind: 'set', field: 'priority', value: 'high' }]),
      entry(at(30, 9), [{ kind: 'set', field: 'priority', value: 'low' }]),
    ];
    const days = activityTimeline(entries, NOW, 1);
    expect(days).toHaveLength(1);
    expect(days[0]!.runs[0]!.entries[0]!.previous).toEqual(['low']);
  });
});
