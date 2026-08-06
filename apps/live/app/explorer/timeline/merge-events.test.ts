import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@livediagram/ui';
import { mergeEvents } from './merge-events';

function event(id: string, occurredAt: number): TimelineEvent {
  return {
    id,
    sourceType: 'diagram',
    sourceId: `d-${id}`,
    eventType: 'diagram_updated',
    title: id,
    occurredAt,
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
