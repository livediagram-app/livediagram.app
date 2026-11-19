// Seen rows (seen.ts) and the notice on screen (center.ts), inbox-notices.md "How a notice goes away": marks kept per
// person and heard across tabs, pruning and the cap; grouping, the timer and holding it, dismissal and forgetting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoticeCenter, NOTICE_SHOW_MS } from './center';
import type { NoticeRow } from './rows';
import { SEEN_MAX, createSeenStore, seenStorageKey, seenStoreFor } from './seen';

function memory() {
  const store = new Map<string, string>();
  return {
    store,
    storage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
}

describe('seen rows', () => {
  it('starts this browser’s watch now, and keeps it', () => {
    const m = memory();
    const a = createSeenStore('u1', { storage: m.storage, now: () => 50, win: null });
    expect(a.since()).toBe(50);
    const b = createSeenStore('u1', { storage: m.storage, now: () => 99, win: null });
    expect(b.since()).toBe(50);
    // Another person here has a watch of their own.
    expect(createSeenStore('u2', { storage: m.storage, now: () => 99, win: null }).since()).toBe(
      99,
    );
  });

  it('marks rows seen, and gone when dismissed or read, never lowering a time', () => {
    const m = memory();
    const s = createSeenStore('u1', { storage: m.storage, now: () => 1, win: null });
    const heard = vi.fn();
    s.subscribe(heard);
    s.mark([{ key: 'a', at: 10 }]);
    expect(s.has({ key: 'a', at: 10 })).toBe(true);
    expect(s.has({ key: 'a', at: 11 })).toBe(false);
    expect(s.gone({ key: 'a', at: 10 })).toBe(false);
    s.mark([{ key: 'a', at: 5 }]);
    expect(s.has({ key: 'a', at: 10 })).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    s.mark([{ key: 'a', at: 10 }], true);
    expect(s.gone({ key: 'a', at: 10 })).toBe(true);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('starts from what another tab stored, and hears its writes', () => {
    const m = memory();
    const listeners = new Set<(e: StorageEvent) => void>();
    const win = {
      addEventListener: (_t: string, l: (e: StorageEvent) => void) => void listeners.add(l),
      removeEventListener: (_t: string, l: (e: StorageEvent) => void) => void listeners.delete(l),
    } as never;
    const here = createSeenStore('u1', { storage: m.storage, now: () => 1, win });
    const there = createSeenStore('u1', { storage: m.storage, now: () => 1, win: null });
    there.mark([{ key: 'b', at: 3 }], true);
    here.mark([{ key: 'c', at: 4 }]);
    expect(here.has({ key: 'b', at: 3 })).toBe(true);
    const heard = vi.fn();
    const stop = here.subscribe(heard);
    there.mark([{ key: 'd', at: 5 }], true);
    const fire = (key: string, newValue: string | null) =>
      listeners.forEach((l) => l({ key, newValue } as StorageEvent));
    fire('other', null);
    fire(seenStorageKey('u1'), 'not json');
    fire(seenStorageKey('u1'), JSON.stringify({ since: 'x' }));
    expect(heard).not.toHaveBeenCalled();
    fire(seenStorageKey('u1'), m.store.get(seenStorageKey('u1'))!);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(here.gone({ key: 'd', at: 5 })).toBe(true);
    stop();
    expect(listeners.size).toBe(0);
  });

  it('lets go of rows the Inbox no longer lists, and keeps at most SEEN_MAX', () => {
    const m = memory();
    const s = createSeenStore('u1', { storage: m.storage, now: () => 1, win: null });
    s.mark(
      [
        { key: 'a', at: 1 },
        { key: 'b', at: 2 },
      ],
      true,
    );
    s.prune(new Set(['a', 'b']));
    s.prune(new Set(['b']));
    expect(s.has({ key: 'a', at: 1 })).toBe(false);
    expect(s.gone({ key: 'b', at: 2 })).toBe(true);
    s.mark(Array.from({ length: SEEN_MAX + 5 }, (_, i) => ({ key: `k${i}`, at: 100 + i })));
    const held = JSON.parse(m.store.get(seenStorageKey('u1'))!) as { seen: Record<string, number> };
    expect(Object.keys(held.seen)).toHaveLength(SEEN_MAX);
    // The oldest went.
    expect(held.seen.b).toBeUndefined();
    expect(held.seen.k0).toBeUndefined();
  });

  it('keeps its marks in memory when storage refuses', () => {
    const refusing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const s = createSeenStore('u1', { storage: refusing, now: () => 7, win: null });
    expect(s.since()).toBe(7);
    s.mark([{ key: 'a', at: 1 }]);
    expect(s.has({ key: 'a', at: 1 })).toBe(true);
    // A stored value of another shape reads as none.
    const odd = memory();
    odd.store.set(
      seenStorageKey('u3'),
      JSON.stringify({ since: 3, seen: { a: 'x', b: 2 }, gone: null }),
    );
    const read = createSeenStore('u3', { storage: odd.storage, now: () => 9, win: null });
    expect(read.since()).toBe(3);
    expect(read.has({ key: 'b', at: 2 })).toBe(true);
    expect(read.has({ key: 'a', at: 0 })).toBe(false);
  });

  it('is one store per person on the page', () => {
    expect(seenStoreFor('u9')).toBe(seenStoreFor('u9'));
    expect(seenStoreFor('u9')).not.toBe(seenStoreFor('u8'));
  });
});

const row = (key: string, at: number): NoticeRow => ({
  key,
  at,
  kind: 'mention',
  app: 'livediagram',
  who: 'Priya',
  verb: 'mentioned you',
  quote: null,
  place: 'Roadmap',
  detail: null,
  href: '/explorer/inbox',
});

describe('the notice', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('groups rows arriving close together, newest first, and restarts its time', () => {
    const c = createNoticeCenter();
    const heard = vi.fn();
    c.subscribe(heard);
    c.offer([row('a', 1)]);
    const id = c.current()!.id;
    vi.advanceTimersByTime(NOTICE_SHOW_MS - 1000);
    c.offer([row('b', 3), row('a', 1)]);
    expect(c.current()).toMatchObject({ id, rows: [{ key: 'b' }, { key: 'a' }] });
    // Nothing new: nothing changes.
    c.offer([row('a', 1)]);
    expect(heard).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(NOTICE_SHOW_MS - 1);
    expect(c.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(c.current()).toBeNull();
  });

  it('a row that changed replaces its older self', () => {
    const c = createNoticeCenter();
    c.offer([row('a', 1), row('b', 2)]);
    c.offer([row('a', 5)]);
    expect(c.current()!.rows.map((r) => [r.key, r.at])).toEqual([
      ['a', 5],
      ['b', 2],
    ]);
  });

  it('holds while the pointer or focus is on it, then has its full time again', () => {
    const c = createNoticeCenter();
    c.offer([row('a', 1)]);
    c.hold(true);
    c.hold(true);
    vi.advanceTimersByTime(NOTICE_SHOW_MS * 3);
    expect(c.current()).not.toBeNull();
    c.hold(false);
    vi.advanceTimersByTime(NOTICE_SHOW_MS - 1);
    expect(c.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(c.current()).toBeNull();
  });

  it('dismisses, and forgets rows seen elsewhere, closing once none is left', () => {
    const c = createNoticeCenter();
    c.forget(() => true);
    c.dismiss();
    c.offer([row('a', 1), row('b', 2)]);
    c.forget(() => false);
    expect(c.current()!.rows).toHaveLength(2);
    c.forget((r) => r.key === 'a');
    expect(c.current()!.rows.map((r) => r.key)).toEqual(['b']);
    c.forget(() => true);
    expect(c.current()).toBeNull();
    c.offer([row('c', 3)]);
    const stop = c.subscribe(() => {});
    c.dismiss();
    expect(c.current()).toBeNull();
    stop();
  });
});
