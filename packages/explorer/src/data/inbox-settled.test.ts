// The Inbox rows done from the pane, kept across a reload (inbox-settled.ts, Work Tracker 1316): held per person at
// the row's time, shared by every tab through localStorage, bounded, and let go after the hold.
import { describe, expect, it, vi } from 'vitest';
import {
  SETTLED_HOLD_MS,
  SETTLED_MAX,
  createSettledStore,
  settledStorageKey,
  settledStoreFor,
} from './inbox-settled';

const NOW = 1_800_000_000_000;

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    store,
  };
}

describe('the settled store', () => {
  it('holds a row at its time, for a reload (a new store over the same storage) too', () => {
    const storage = memoryStorage();
    const a = createSettledStore('u1', { storage, now: () => NOW, win: null });
    const listener = vi.fn();
    a.subscribe(listener);
    const before = a.current();
    a.add({ key: 't:1', at: 5 });
    expect(a.current().get('t:1')).toBe(5);
    expect(a.current()).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    // The same mark again changes nothing.
    const held = a.current();
    a.add({ key: 't:1', at: 5 });
    expect(a.current()).toBe(held);
    expect(listener).toHaveBeenCalledTimes(1);
    const reloaded = createSettledStore('u1', { storage, now: () => NOW + 1000, win: null });
    expect(reloaded.current().get('t:1')).toBe(5);
    // Another person's store holds none of it.
    expect(createSettledStore('u2', { storage, now: () => NOW, win: null }).current().size).toBe(0);
  });

  it('lets a mark go after the hold, and keeps the newest SETTLED_MAX', () => {
    const storage = memoryStorage();
    let now = NOW;
    const s = createSettledStore('u1', { storage, now: () => now, win: null });
    for (let i = 0; i <= SETTLED_MAX; i++) {
      now = NOW + i;
      s.add({ key: `t:${i}`, at: i });
    }
    expect(s.current().size).toBe(SETTLED_MAX);
    expect(s.current().has('t:0')).toBe(false);
    expect(s.current().has(`t:${SETTLED_MAX}`)).toBe(true);
    // Marked at NOW + i: an hour past NOW + 100, the first hundred have gone.
    now = NOW + 100 + SETTLED_HOLD_MS;
    expect(createSettledStore('u1', { storage, now: () => now, win: null }).current().size).toBe(
      SETTLED_MAX - 100,
    );
  });

  it('reads nothing from a broken or foreign value, and keeps marks in memory when storage throws', () => {
    for (const text of ['{', 'null', '{"t:1":5}', '{"t:1":[5]}']) {
      const storage = memoryStorage();
      storage.setItem(settledStorageKey('u1'), text);
      expect(createSettledStore('u1', { storage, now: () => NOW, win: null }).current().size).toBe(
        0,
      );
    }
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    const s = createSettledStore('u1', { storage: throwing, now: () => NOW, win: null });
    s.add({ key: 't:1', at: 5 });
    expect(s.current().get('t:1')).toBe(5);
    const none = createSettledStore('u1', { storage: null, now: () => NOW, win: null });
    none.add({ key: 't:2', at: 1 });
    expect(none.current().get('t:2')).toBe(1);
  });

  it("hears another tab's marks, listening only while someone does", () => {
    const storage = memoryStorage();
    const handlers = new Set<(e: StorageEvent) => void>();
    const win = {
      addEventListener: vi.fn((_: string, h: (e: StorageEvent) => void) => void handlers.add(h)),
      removeEventListener: vi.fn(
        (_: string, h: (e: StorageEvent) => void) => void handlers.delete(h),
      ),
    } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>;
    const here = createSettledStore('u1', { storage, now: () => NOW, win });
    const other = createSettledStore('u1', { storage, now: () => NOW, win: null });
    const listener = vi.fn();
    const off = here.subscribe(listener);
    here.subscribe(() => {})();
    other.add({ key: 't:9', at: 3 });
    const fire = (key: string) =>
      handlers.forEach((h) =>
        h({ key, newValue: storage.getItem(settledStorageKey('u1')) } as StorageEvent),
      );
    fire('something-else');
    expect(listener).not.toHaveBeenCalled();
    fire(settledStorageKey('u1'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(here.current().get('t:9')).toBe(3);
    off();
    expect(handlers.size).toBe(0);
  });

  it('starts from what storage holds when someone first listens, a store cleared meanwhile included', () => {
    const storage = memoryStorage();
    const s = createSettledStore('u1', { storage, now: () => NOW, win: null });
    s.add({ key: 't:1', at: 5 });
    const held = s.current();
    s.subscribe(() => {})();
    expect(s.current()).toBe(held);
    storage.store.clear();
    s.subscribe(() => {});
    expect(s.current().size).toBe(0);
  });

  it("is one store a person on the page, over the browser's own storage", () => {
    localStorage.clear();
    const s = settledStoreFor('u-page');
    expect(settledStoreFor('u-page')).toBe(s);
    s.add({ key: 't:1', at: 1 });
    expect(localStorage.getItem(settledStorageKey('u-page'))).toContain('t:1');
    const off = s.subscribe(() => {});
    off();
    localStorage.clear();
  });
});
