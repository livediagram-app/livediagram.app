// At most LIVE_EMBEDS_MAX live embeds at once in a page (live-embeds.md "Loading only on screen"): the rest wait in
// the order they came on screen and take a place as one is given up.
import { describe, expect, it, vi } from 'vitest';
import { LIVE_EMBEDS_MAX, createLiveEmbedSlots, liveEmbedSlots } from './live-embed-slots';

describe('live embed slots', () => {
  it('lets in up to the cap and queues the rest in arrival order', () => {
    const slots = createLiveEmbedSlots(2);
    const granted: string[] = [];
    for (const key of ['a', 'b', 'c', 'd']) slots.request(key, () => granted.push(key));
    expect(granted).toEqual(['a', 'b']);
    expect(slots.counts()).toEqual({ live: 2, waiting: 2 });
    slots.release('a');
    expect(granted).toEqual(['a', 'b', 'c']);
    // A waiter that stops waiting is skipped.
    slots.release('d');
    slots.release('b');
    expect(granted).toEqual(['a', 'b', 'c']);
    expect(slots.counts()).toEqual({ live: 1, waiting: 0 });
  });

  it('takes a second ask as the first, and a release of nothing as nothing', () => {
    const slots = createLiveEmbedSlots(1);
    const granted = vi.fn();
    slots.request('a', granted);
    slots.request('a', granted);
    slots.request('b', granted);
    slots.request('b', granted);
    expect(granted).toHaveBeenCalledTimes(1);
    expect(slots.counts()).toEqual({ live: 1, waiting: 1 });
    slots.release('zz');
    expect(slots.counts()).toEqual({ live: 1, waiting: 1 });
  });

  it('shares one page-wide manager at the default cap', () => {
    expect(LIVE_EMBEDS_MAX).toBe(3);
    const granted = vi.fn();
    for (const key of ['1', '2', '3', '4']) liveEmbedSlots.request(key, granted);
    expect(granted).toHaveBeenCalledTimes(3);
    for (const key of ['1', '2', '3', '4']) liveEmbedSlots.release(key);
    expect(liveEmbedSlots.counts()).toEqual({ live: 0, waiting: 0 });
  });
});
