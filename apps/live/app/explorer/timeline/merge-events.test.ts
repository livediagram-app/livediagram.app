import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@livediagram/ui';
import { mergeEvents, purgeEventsForSource, reconcileEvents } from './merge-events';

function event(id: string, occurredAt: number, over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id,
    sourceType: 'diagram',
    sourceId: `d-${id}`,
    eventType: 'diagram_updated',
    title: id,
    description: null,
    occurredAt,
    snapshot: {},
    ...over,
  } as TimelineEvent;
}

// What the re-read on returning to a tab (spec/138 §2.4a) and the
// calendar's period fetch both rely on.
describe('mergeEvents', () => {
  it('brings new events in at the head without dropping loaded pages', () => {
    const loaded = [event('b', 20), event('c', 10)];
    const merged = mergeEvents(loaded, [event('a', 30), event('b', 20)]);
    expect(merged.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the list newest-first when the incoming range is older', () => {
    // The calendar paged back to March while the feed holds August.
    const loaded = [event('aug', 800)];
    const merged = mergeEvents(loaded, [event('mar', 300), event('feb', 200)]);
    expect(merged.map((e) => e.id)).toEqual(['aug', 'mar', 'feb']);
  });

  it('dedupes by id, since a re-read returns the page it already gave', () => {
    const loaded = [event('a', 30), event('b', 20)];
    expect(mergeEvents(loaded, [event('a', 30), event('b', 20)])).toBe(loaded);
  });

  it('returns the same array when nothing is new, so the feed does not re-render', () => {
    const loaded = [event('a', 30)];
    expect(mergeEvents(loaded, [])).toBe(loaded);
  });

  it('populates an empty feed, which is how a failed first read recovers', () => {
    expect(mergeEvents([], [event('a', 30)]).map((e) => e.id)).toEqual(['a']);
  });
});

// The first-page re-read after the reader's own write (spec/138 §2.4b):
// authoritative for the stretch it covers, hands off below it.
describe('reconcileEvents', () => {
  it('drops a loaded event the page no longer holds inside its window', () => {
    // The reader deleted diagram b; the worker's cascade took its card.
    const loaded = [event('a', 30), event('b', 20), event('c', 10)];
    const next = reconcileEvents(loaded, { events: [event('a', 30), event('c', 10)] });
    expect(next.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('keeps loaded events older than the page when there is a next page', () => {
    // Page one ends at 20 with more behind it; the 10 the reader had
    // paged to can't be judged from this read.
    const loaded = [event('a', 30), event('b', 20), event('old', 10)];
    const next = reconcileEvents(loaded, {
      events: [event('a', 30), event('b', 20)],
      nextCursor: '20:b',
    });
    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'old']);
  });

  it('keeps a loaded event that shares the floor instant, since ties may sit on the next page', () => {
    const loaded = [event('a', 30), event('b', 20), event('b2', 20)];
    const next = reconcileEvents(loaded, {
      events: [event('a', 30), event('b', 20)],
      nextCursor: '20:b',
    });
    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'b2']);
  });

  it('treats a page with no next cursor as the whole feed', () => {
    const loaded = [event('a', 30), event('gone', 5)];
    const next = reconcileEvents(loaded, { events: [event('a', 30)] });
    expect(next.map((e) => e.id)).toEqual(['a']);
  });

  it('takes the pages copy of an event the worker upserted in place', () => {
    // The coalesced edit event walks forward through the day.
    const loaded = [event('edit', 20, { snapshot: { saves: 1 } })];
    const next = reconcileEvents(loaded, {
      events: [event('edit', 25, { snapshot: { saves: 2 } })],
    });
    expect(next[0]!.occurredAt).toBe(25);
    expect(next[0]!.snapshot).toEqual({ saves: 2 });
  });

  it('adds what is new and stays newest-first', () => {
    const loaded = [event('b', 20)];
    const next = reconcileEvents(loaded, { events: [event('a', 30), event('b', 20)] });
    expect(next.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('returns the same array when the page matches what is loaded', () => {
    const loaded = [event('a', 30), event('b', 20)];
    expect(reconcileEvents(loaded, { events: [event('a', 30), event('b', 20)] })).toBe(loaded);
  });
});

// The client half of the delete cascade (spec/138 §3.5): the same
// predicate as markTimelineEventsDeletedBySource.
describe('purgeEventsForSource', () => {
  it('drops events keyed on the id and events whose snapshot references it', () => {
    const loaded = [
      event('created', 30, { sourceId: 'd-9' }),
      // A comment: its own id as the source, the diagram in the snapshot.
      event('comment', 20, { sourceId: 'c-1', snapshot: { diagramId: 'd-9' } }),
      event('other', 10, { sourceId: 'd-2', snapshot: { diagramId: 'd-2' } }),
    ];
    expect(purgeEventsForSource(loaded, 'diagram', 'd-9').map((e) => e.id)).toEqual(['other']);
  });

  it('scopes the purge to one source type', () => {
    const loaded = [event('team', 30, { sourceType: 'team', sourceId: 'd-9' })];
    expect(purgeEventsForSource(loaded, 'diagram', 'd-9')).toBe(loaded);
  });

  it('returns the same array when nothing matched', () => {
    const loaded = [event('a', 30)];
    expect(purgeEventsForSource(loaded, 'diagram', 'nope')).toBe(loaded);
  });
});
