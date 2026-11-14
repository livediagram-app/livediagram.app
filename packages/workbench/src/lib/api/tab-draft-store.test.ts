import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TabDraftRecord } from './tab-drafts';
import { TAB_DRAFT_READ_TIMEOUT_MS, createTabDraftStore } from './tab-draft-store';

const TAB_DRAFTS_DB = 'test-drafts';
const tabDraftStore = createTabDraftStore(TAB_DRAFTS_DB);
const resetTabDraftStoreForTests = () => tabDraftStore.reset();

// The drafts' IndexedDB store (each product's docs/specs/006-*/delta-saves.md "Drafts of unsaved changes"): reads, writes and
// removes on one kept connection, and an editor that works on when IndexedDB does not.

const record: TabDraftRecord = {
  v: 1,
  baseRev: 3,
  tab: '{"id":"t1"}',
  changed: null,
  removed: null,
};
const idle = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetTabDraftStoreForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(TAB_DRAFTS_DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe('tabDraftStore', () => {
  it('writes before any read has opened it, reads back, and removes', async () => {
    tabDraftStore.write('k', record);
    await idle();
    expect(await tabDraftStore.read('k')).toEqual(record);
    // Now on the kept connection.
    tabDraftStore.write('k2', record);
    tabDraftStore.remove('k');
    await idle();
    expect(await tabDraftStore.read('k')).toBeUndefined();
    expect(await tabDraftStore.read('k2')).toEqual(record);
  });

  it('lets go of its connection for a newer version elsewhere, then keeps no drafts', async () => {
    tabDraftStore.write('k', record);
    await idle();
    expect(await tabDraftStore.read('k')).toEqual(record);
    // Another tab on newer code upgrades: this connection lets go at once, so the upgrade is never blocked.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(TAB_DRAFTS_DB, 2);
      req.onblocked = () => reject(new Error('blocked'));
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
    });
    // This older build cannot open the newer database: no draft, no throw.
    expect(await tabDraftStore.read('k')).toBeUndefined();
  });

  it('keeps no drafts, and throws nothing, without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(() => tabDraftStore.write('k', record)).not.toThrow();
    expect(() => tabDraftStore.remove('k')).not.toThrow();
    expect(await tabDraftStore.read('k')).toBeUndefined();
  });

  it('answers nothing when the open fails or is blocked, or a request does', async () => {
    const failing = (event: 'onerror' | 'onblocked') => ({
      open: () => {
        const req: Record<string, unknown> = {};
        setTimeout(() => (req[event] as () => void)());
        return req;
      },
    });
    for (const event of ['onerror', 'onblocked'] as const) {
      resetTabDraftStoreForTests();
      vi.stubGlobal('indexedDB', failing(event));
      expect(await tabDraftStore.read('k')).toBeUndefined();
    }
    // A connection whose transactions throw: the write is logged and dropped, the read answers nothing.
    resetTabDraftStoreForTests();
    const broken = {
      transaction: () => {
        throw new Error('closing');
      },
      close: () => {},
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: Record<string, unknown> = { result: broken };
        setTimeout(() => (req.onsuccess as () => void)());
        return req;
      },
    });
    expect(await tabDraftStore.read('k')).toBeUndefined();
    expect(() => tabDraftStore.write('k', record)).not.toThrow();
    // A get that errors.
    resetTabDraftStoreForTests();
    const erring = {
      transaction: () => ({
        objectStore: () => ({
          get: () => {
            const req: Record<string, unknown> = {};
            setTimeout(() => (req.onerror as () => void)());
            return req;
          },
        }),
      }),
      close: () => {
        throw new Error('already closed');
      },
    };
    vi.stubGlobal('indexedDB', {
      open: () => {
        const req: Record<string, unknown> = { result: erring };
        setTimeout(() => (req.onsuccess as () => void)());
        return req;
      },
    });
    expect(await tabDraftStore.read('k')).toBeUndefined();
    // Closing a connection that is already gone is fine.
    expect(() => resetTabDraftStoreForTests()).not.toThrow();
  });

  it('opens again after the browser closes its connection', async () => {
    let opens = 0;
    const conn: Record<string, unknown> = {
      transaction: () => ({
        objectStore: () => ({
          get: () => {
            const req: Record<string, unknown> = { result: record };
            setTimeout(() => (req.onsuccess as () => void)());
            return req;
          },
        }),
      }),
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
    expect(await tabDraftStore.read('k')).toEqual(record);
    (conn.onclose as () => void)();
    expect(await tabDraftStore.read('k')).toEqual(record);
    expect(opens).toBe(2);
  });

  it('a read that never answers gives up after its time, so the load goes on', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('indexedDB', { open: () => ({}) });
    const read = tabDraftStore.read('k');
    await vi.advanceTimersByTimeAsync(TAB_DRAFT_READ_TIMEOUT_MS);
    expect(await read).toBeUndefined();
  });
});
