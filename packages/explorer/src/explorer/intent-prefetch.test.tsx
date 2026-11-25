import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createIntentPrefetcher,
  INTENT_DELAY_MS,
  prefetchAllowed,
  type PrefetchItem,
} from './intent-prefetch';

const hover = (matches: boolean) => () => ({ matches });

describe('prefetchAllowed', () => {
  it('prefetches on a fast connection with a pointer that hovers', () => {
    expect(prefetchAllowed({ connection: { effectiveType: '4g' }, matchMedia: hover(true) })).toBe(
      true,
    );
    // No Network Information (Safari, Firefox) and no matchMedia: allowed.
    expect(prefetchAllowed({})).toBe(true);
  });

  it('never prefetches with Save-Data on', () => {
    expect(prefetchAllowed({ connection: { saveData: true, effectiveType: '4g' } })).toBe(false);
  });

  it('never prefetches on a slow connection', () => {
    for (const effectiveType of ['slow-2g', '2g', '3g'])
      expect(prefetchAllowed({ connection: { effectiveType } })).toBe(false);
  });

  it('never prefetches on a touch-only device', () => {
    expect(prefetchAllowed({ matchMedia: hover(false) })).toBe(false);
  });

  it('reads the browser by default', () => {
    expect(prefetchAllowed()).toBe(true);
    const query = vi.fn(() => ({ matches: false }) as MediaQueryList);
    vi.stubGlobal('matchMedia', query);
    try {
      expect(prefetchAllowed()).toBe(false);
      expect(query).toHaveBeenCalledWith('(any-hover: hover)');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('allows it where there is no browser to read (a server render)', () => {
    vi.stubGlobal('navigator', undefined);
    try {
      expect(prefetchAllowed()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createIntentPrefetcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // A host whose prefetches settle only when told.
  function host() {
    const pending = new Map<string, () => void>();
    const prefetch = vi.fn<PrefetchItem>(
      (href) => new Promise<void>((resolve) => pending.set(href, resolve)),
    );
    const settle = async (href: string) => {
      pending.get(href)?.();
      await Promise.resolve();
      await Promise.resolve();
    };
    return { prefetch, settle };
  }

  it('prefetches once intent has rested for the delay', () => {
    const { prefetch } = host();
    const p = createIntentPrefetcher({ prefetch, allowed: () => true });
    p.intend('/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS - 1);
    expect(prefetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(prefetch).toHaveBeenCalledWith('/document/a');
  });

  it('cancels a wait when intent leaves, or moves to another link', () => {
    const prefetch = vi.fn<PrefetchItem>(() => null);
    const p = createIntentPrefetcher({ prefetch, allowed: () => true });
    p.intend('/document/a');
    p.cancel('/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(prefetch).not.toHaveBeenCalled();
    p.intend('/document/a');
    p.intend('/document/b');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(prefetch.mock.calls).toEqual([['/document/b']]);
    // Leaving a link that is not the one waited on changes nothing.
    p.intend('/document/c');
    p.cancel('/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(prefetch).toHaveBeenCalledWith('/document/c');
  });

  it('keeps at most one prefetch in flight, starting only the latest that came due meanwhile', async () => {
    const { prefetch, settle } = host();
    const p = createIntentPrefetcher({ prefetch, allowed: () => true });
    for (const id of ['a', 'b', 'c']) {
      p.intend(`/document/${id}`);
      vi.advanceTimersByTime(INTENT_DELAY_MS);
    }
    expect(prefetch.mock.calls).toEqual([['/document/a']]);
    await settle('/document/a');
    expect(prefetch.mock.calls).toEqual([['/document/a'], ['/document/c']]);
    // A failed prefetch frees the slot too.
    prefetch.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    await settle('/document/c');
    p.intend('/document/d');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    await Promise.resolve();
    await Promise.resolve();
    p.intend('/document/e');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(prefetch).toHaveBeenLastCalledWith('/document/e');
  });

  it('asks for each address once per page, and forgets them past the cap', async () => {
    const prefetch = vi.fn<PrefetchItem>(() => Promise.resolve());
    const p = createIntentPrefetcher({ prefetch, allowed: () => true, seenMax: 2 });
    const visit = async (href: string) => {
      p.intend(href);
      vi.advanceTimersByTime(INTENT_DELAY_MS);
      await Promise.resolve();
      await Promise.resolve();
    };
    await visit('/document/a');
    await visit('/document/a');
    expect(prefetch).toHaveBeenCalledTimes(1);
    await visit('/document/b');
    await visit('/document/c');
    await visit('/document/a');
    expect(prefetch).toHaveBeenCalledTimes(4);
  });

  it('does not count an address the host fetched nothing for, nor one that threw', () => {
    const prefetch = vi.fn<PrefetchItem>(() => null);
    const p = createIntentPrefetcher({ prefetch, allowed: () => true });
    p.intend('https://elsewhere.example/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    p.intend('https://elsewhere.example/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(prefetch).toHaveBeenCalledTimes(2);
    prefetch.mockImplementation(() => {
      throw new Error('host bug');
    });
    p.intend('/document/b');
    expect(() => vi.advanceTimersByTime(INTENT_DELAY_MS)).not.toThrow();
  });

  it('does nothing while prefetching is not allowed (Save-Data, slow, touch-only)', () => {
    const { prefetch } = host();
    const p = createIntentPrefetcher({ prefetch, allowed: () => false });
    p.intend('/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS * 2);
    expect(prefetch).not.toHaveBeenCalled();
  });

  it('stops every wait and queued prefetch once disposed', async () => {
    const { prefetch, settle } = host();
    const p = createIntentPrefetcher({ prefetch, allowed: () => true });
    p.intend('/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    p.intend('/document/b');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    p.intend('/document/c');
    p.dispose();
    await settle('/document/a');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    p.intend('/document/d');
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    expect(prefetch.mock.calls).toEqual([['/document/a']]);
  });

  it('a 500-item library: sweeping the pointer across every row starts nothing, resting on rows one at a time', async () => {
    const { prefetch, settle } = host();
    const p = createIntentPrefetcher({ prefetch, allowed: () => true });
    // Moving across the grid: each row passes under the pointer for less than the delay.
    for (let i = 0; i < 500; i++) {
      p.intend(`/document/item-${i}`);
      vi.advanceTimersByTime(INTENT_DELAY_MS / 4);
    }
    vi.advanceTimersByTime(INTENT_DELAY_MS);
    // Only the row the pointer stopped on.
    expect(prefetch.mock.calls).toEqual([['/document/item-499']]);
    // Resting on every row while the first is still in flight queues one, never 500.
    for (let i = 0; i < 500; i++) {
      p.intend(`/document/rest-${i}`);
      vi.advanceTimersByTime(INTENT_DELAY_MS);
    }
    expect(prefetch).toHaveBeenCalledTimes(1);
    await settle('/document/item-499');
    expect(prefetch).toHaveBeenCalledTimes(2);
    expect(prefetch).toHaveBeenLastCalledWith('/document/rest-499');
  });
});
