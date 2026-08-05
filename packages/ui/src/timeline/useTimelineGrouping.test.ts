import { describe, expect, it } from 'vitest';
import { dateKey, groupByDay } from './useTimelineGrouping';
import type { TimelineEvent } from './types';

const AUG_5 = Date.UTC(2026, 7, 5, 12, 0, 0);
const AUG_4 = Date.UTC(2026, 7, 4, 12, 0, 0);
const AUG_9 = Date.UTC(2026, 7, 9, 12, 0, 0);

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
  // UTC, not local: the worker builds a coalesced event's dedupe key in
  // UTC, so a client grouping in local time would put a late-evening
  // save in a bubble labelled the wrong day.
  it('is UTC', () => {
    expect(dateKey(Date.UTC(2026, 7, 5, 23, 59, 59))).toBe('2026-08-05');
    expect(dateKey(Date.UTC(2026, 7, 6, 0, 0, 0))).toBe('2026-08-06');
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
