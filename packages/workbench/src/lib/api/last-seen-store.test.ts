import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAST_SEEN_TIMEOUT_MS, createLastSeenStore, type LastSeenRecord } from './last-seen-store';

// The last seen copies' IndexedDB store (livediagram's docs/specs/006-document/blueprints/last-seen-copy.md): two object
// stores under one key, one kept connection, and an editor that works on when IndexedDB does not.

const DB = 'test-last-seen';
const store = createLastSeenStore(DB);

const record = (over: Partial<LastSeenRecord> = {}): LastSeenRecord => ({
  v: 1,
  reader: 'user_a',
  itemId: 'd1',
  seenAt: 5,
  body: '{"item":{}}',
  ...over,
});

// A fake open whose request fires `event` with `result`.
function fakeOpen(event: 'onsuccess' | 'onerror' | 'onblocked', result?: unknown) {
  return {
    open: () => {
      const req: Record<string, unknown> = { result };
      setTimeout(() => (req[event] as () => void)());
      return req;
    },
  };
}

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  store.reset();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('createLastSeenStore', () => {
  it('writes, reads, lists, removes and clears', async () => {
    expect(await store.put('k1', record())).toBe(true);
    expect(await store.put('k2', record({ reader: 'guest_1', itemId: 'd2', seenAt: 9 }))).toBe(
      true,
    );
    expect(await store.get('k1')).toEqual(record());
    expect(await store.entries()).toEqual([
      { key: 'k1', reader: 'user_a', seenAt: 5 },
      { key: 'k2', reader: 'guest_1', seenAt: 9 },
    ]);
    await store.remove(['k1']);
    expect(await store.get('k1')).toBeUndefined();
    expect(await store.entries()).toEqual([{ key: 'k2', reader: 'guest_1', seenAt: 9 }]);
    // Removing nothing asks nothing.
    await store.remove([]);
    await store.clear();
    expect(await store.entries()).toEqual([]);
    expect(await store.get('k2')).toBeUndefined();
  });

  it('lets go of its connection for a newer version elsewhere, then answers as empty', async () => {
    await store.put('k1', record());
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB, 2);
      req.onblocked = () => reject(new Error('blocked'));
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
    });
    // This older build cannot open the newer database: nothing, no throw.
    expect(await store.get('k1')).toBeUndefined();
    expect(await store.put('k1', record())).toBe(false);
  });

  it('answers as empty, and throws nothing, without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await store.get('k1')).toBeUndefined();
    expect(await store.put('k1', record())).toBe(false);
    expect(await store.entries()).toEqual([]);
    await expect(store.remove(['k1'])).resolves.toBeUndefined();
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it('answers as empty when the open fails or is blocked', async () => {
    for (const event of ['onerror', 'onblocked'] as const) {
      store.reset();
      vi.stubGlobal('indexedDB', fakeOpen(event));
      expect(await store.get('k1')).toBeUndefined();
    }
  });

  it('answers as empty when a transaction throws, errors or aborts', async () => {
    const broken = {
      transaction: () => {
        throw new Error('closing');
      },
      close: () => {
        throw new Error('already closed');
      },
    };
    vi.stubGlobal('indexedDB', fakeOpen('onsuccess', broken));
    expect(await store.put('k1', record())).toBe(false);
    // Closing a connection that is already gone is fine.
    expect(() => store.reset()).not.toThrow();
    // A failed request errors, then the transaction aborts: answered once.
    store.reset();
    const tx: Record<string, unknown> = {
      error: new Error('quota'),
      objectStore: () => ({
        clear: () =>
          setTimeout(() => {
            (tx.onerror as () => void)();
            (tx.onabort as () => void)();
          }),
      }),
    };
    vi.stubGlobal('indexedDB', fakeOpen('onsuccess', { transaction: () => tx, close: () => {} }));
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it('opens again after the browser closes its connection', async () => {
    let opens = 0;
    const conn: Record<string, unknown> = {
      transaction: () => {
        const tx: Record<string, unknown> = {
          objectStore: () => ({
            get: () => {
              setTimeout(() => (tx.oncomplete as () => void)());
              return { result: 'copy' };
            },
          }),
        };
        return tx;
      },
      close: () => {},
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        opens += 1;
        const req: Record<string, unknown> = { result: conn };
        setTimeout(() => (req.onsuccess as () => void)());
        return req;
      },
    });
    expect(await store.get('k1')).toBe('copy');
    (conn.onclose as () => void)();
    expect(await store.get('k1')).toBe('copy');
    expect(opens).toBe(2);
  });

  it('a call that never answers gives up after its time, so sign-out and the load go on', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    const cleared = store.clear();
    const read = store.get('k1');
    await vi.advanceTimersByTimeAsync(LAST_SEEN_TIMEOUT_MS);
    await expect(cleared).resolves.toBeUndefined();
    expect(await read).toBeUndefined();
  });
});
