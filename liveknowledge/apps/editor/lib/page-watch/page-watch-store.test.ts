import { describe, expect, it, vi } from 'vitest';
import type { PageWatchResponse } from '@liveknowledge/api-schema';
import { createPageWatchStore, withOwnWatch } from './page-watch-store';

// docs/specs/030-knowledgebase/watching.md "Where it shows": read once, shown at once, put back on a refusal, and a
// change marks the knowledgebase's other pages to be read again.
const WHO = { ownerId: 'user_a', shareCode: null };
const watch = (over: Partial<PageWatchResponse> = {}): PageWatchResponse => ({
  watching: null,
  through: null,
  watchers: 2,
  section: true,
  ...over,
});

function storeWith(
  read = vi.fn(async () => watch()),
  set = vi.fn(async () => watch({ watching: 'page', watchers: 3 })),
) {
  return { store: createPageWatchStore({ read, set }), read, set };
}

describe('withOwnWatch', () => {
  it('moves the count only when the person’s cover starts or ends', () => {
    expect(withOwnWatch(watch(), 'page')).toMatchObject({ watching: 'page', watchers: 3 });
    expect(withOwnWatch(watch({ watching: 'page', watchers: 3 }), 'section').watchers).toBe(3);
    expect(withOwnWatch(watch({ watching: 'page', watchers: 3 }), null).watchers).toBe(2);
    // Covered through a section either way: no change.
    const through = watch({ through: { tab: 'p', name: 'P' }, watchers: 1 });
    expect(withOwnWatch(through, 'page').watchers).toBe(1);
    expect(withOwnWatch(watch({ watching: 'page', watchers: 0 }), null).watchers).toBe(0);
  });
});

describe('the page watch store', () => {
  it('reads a page once, sharing one request, and says loading until then', async () => {
    const { store, read } = storeWith();
    expect(store.entryOf('kb', 'a').status).toBe('loading');
    await Promise.all([store.load(WHO, 'kb', 'a'), store.load(WHO, 'kb', 'a')]);
    await store.load(WHO, 'kb', 'a');
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.entryOf('kb', 'a')).toMatchObject({ status: 'ready', stale: false });
  });

  it('says failed when the first read fails, and keeps what it held on a later one', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('down'));
    const { store } = storeWith(read);
    await store.load(WHO, 'kb', 'a');
    expect(store.entryOf('kb', 'a').status).toBe('failed');
  });

  it('shows a press at once, takes the answer, and marks the other pages stale', async () => {
    const { store, set, read } = storeWith();
    await store.load(WHO, 'kb', 'a');
    await store.load(WHO, 'kb', 'b');
    await store.load(WHO, 'other', 'a');
    const heard = vi.fn();
    store.subscribe(heard);
    const pending = store.set(WHO, 'kb', 'a', 'page');
    expect(store.entryOf('kb', 'a').watch).toMatchObject({ watching: 'page', watchers: 3 });
    await pending;
    expect(set).toHaveBeenCalledWith(WHO, 'kb', 'a', 'page');
    expect(store.entryOf('kb', 'b').stale).toBe(true);
    expect(store.entryOf('other', 'a').stale).toBe(false);
    expect(heard).toHaveBeenCalled();
    // A stale page is read again when it next shows.
    await store.load(WHO, 'kb', 'b');
    expect(read).toHaveBeenCalledTimes(4);
    expect(store.entryOf('kb', 'b').stale).toBe(false);
  });

  it('puts a refused press back and rejects, and ignores a page not read', async () => {
    const set = vi.fn().mockRejectedValueOnce(new Error('watchers_full'));
    const { store } = storeWith(undefined, set);
    await store.set(WHO, 'kb', 'a', 'page');
    expect(set).not.toHaveBeenCalled();
    await store.load(WHO, 'kb', 'a');
    await expect(store.set(WHO, 'kb', 'a', 'page')).rejects.toThrow('watchers_full');
    expect(store.entryOf('kb', 'a').watch).toEqual(watch());
  });
});
