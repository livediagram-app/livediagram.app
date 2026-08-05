import { describe, expect, it } from 'vitest';
import { dateKey, groupByDay, timeLabel } from './useTimelineGrouping';
import type { TimelineEvent } from './types';

// Local midday, so these land on the intended calendar day in any
// timezone the suite happens to run in.
const AUG_5 = new Date(2026, 7, 5, 12).getTime();
const AUG_4 = new Date(2026, 7, 4, 12).getTime();
const AUG_9 = new Date(2026, 7, 9, 12).getTime();

let seq = 0;
function event(occurredAt: number): TimelineEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    sourceType: 'diagram',
    sourceId: `s${seq}`,
    eventType: 'diagram_edited',
    title: 'Diagram Updated',
    description: null,
    occurredAt,
    actorId: null,
    snapshot: {},
  };
}

describe('dateKey', () => {
  // LOCAL, deliberately unlike the worker's UTC coalescing key. That key
  // decides what merges and must be the same for a whole audience; this
  // decides what one person is told, and a reader in Sydney should see
  // their morning under today rather than yesterday.
  it('uses the local calendar day', () => {
    const noon = new Date(2026, 7, 5, 12, 0, 0);
    expect(dateKey(noon.getTime())).toBe('2026-08-05');
  });

  it('rolls over at local midnight, not UTC midnight', () => {
    const lastMoment = new Date(2026, 7, 5, 23, 59, 59);
    const firstMoment = new Date(2026, 7, 6, 0, 0, 0);
    expect(dateKey(lastMoment.getTime())).toBe('2026-08-05');
    expect(dateKey(firstMoment.getTime())).toBe('2026-08-06');
  });

  it('zero-pads so keys sort lexically', () => {
    expect(dateKey(new Date(2026, 0, 9, 12).getTime())).toBe('2026-01-09');
  });
});

describe('timeLabel', () => {
  // A day of twenty events is ordered but undated without this.
  it('renders an hour and minute', () => {
    expect(timeLabel(new Date(2026, 7, 5, 9, 42).getTime())).toMatch(/9[:.]42|09[:.]42/);
  });
});

describe('groupByDay', () => {
  it('groups events onto their day', () => {
    const groups = groupByDay([event(AUG_5), event(AUG_5), event(AUG_4)], AUG_5);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.events).toHaveLength(2);
    expect(groups[1]!.events).toHaveLength(1);
  });

  // A future-dated expiry event can arrive interleaved. Adjacency-based
  // grouping would emit two groups sharing a key here — a duplicate
  // React key, and half the day's bubbles silently dropped.
  it('merges same-day events that are not adjacent', () => {
    const groups = groupByDay([event(AUG_5), event(AUG_4), event(AUG_5)], AUG_5);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.events).toHaveLength(2);
    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
  });

  it('marks today and the future band', () => {
    const groups = groupByDay([event(AUG_9), event(AUG_5), event(AUG_4)], AUG_5);
    expect(groups[0]).toMatchObject({ isFuture: true, isToday: false });
    expect(groups[1]).toMatchObject({ isFuture: false, isToday: true });
    expect(groups[2]).toMatchObject({ isFuture: false, isToday: false });
  });

  // Assembled from parts because ICU 72 and below emit "Wed 5 Aug"
  // while 73+ emit "Wed, 5 Aug" — a label that differs between a
  // laptop and CI is a test that fails for no reason.
  it('formats a stable label and year', () => {
    const groups = groupByDay([event(AUG_5)], AUG_5);
    expect(groups[0]!.label).toBe('Wed, 5 Aug');
    expect(groups[0]!.year).toBe('2026');
  });

  it('preserves input order within a day', () => {
    const first = event(AUG_5);
    const second = event(AUG_5);
    const groups = groupByDay([first, second], AUG_5);
    expect(groups[0]!.events.map((e) => e.id)).toEqual([first.id, second.id]);
  });

  it('returns nothing for an empty feed', () => {
    expect(groupByDay([], AUG_5)).toEqual([]);
  });
});
