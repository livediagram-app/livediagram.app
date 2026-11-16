import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyLayout, type SheetJson } from '@liveplanner/sheets';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project", the sheet store's part: a warm open's kept
// sheets show at once with nothing fetched or queued while no plan is known; the plan's own store shows them too
// until its first read of the tab answers, which drops any the server no longer holds, and is told to the copy.

const api = vi.hoisted(() => ({
  fetchSheets: vi.fn(),
  createSheet: vi.fn(),
  writeSheet: vi.fn(),
  deleteSheet: vi.fn(),
}));
vi.mock('@/lib/api/sheets', () => api);
vi.mock('@/lib/offline/offline-store', async (original) => ({
  ...(await original<typeof import('@/lib/offline/offline-store')>()),
  isOfflineIdSync: () => false,
}));
vi.stubGlobal('localStorage', undefined);

import { forgetSheetStores, sheetStoreOf } from './sheet-store-client';
import type { SheetsBridge } from '@/hooks/sheets/useSheetsBridge';

const by = { id: 'me', name: 'Me', color: '#000000' };
let r = 11;
const rand = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646;
const sheet = (id: string, tabId: string, title: string): SheetJson => ({
  id,
  tabId,
  title,
  layout: emptyLayout(rand, 3, 2),
  cells: [],
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: by,
});
const KEPT = {
  tabId: 't1',
  sheets: [sheet('s1', 't1', 'Budget'), sheet('s2', 't1', 'Gone'), sheet('sX', 't9', 'Other')],
};

const bridgeFor = (projectId: string, over: Partial<SheetsBridge> = {}) =>
  ({
    scope: { projectId, ownerId: 'o', shareCode: null, tabId: null },
    self: by,
    locale: 'en-GB',
    pushUndo: () => {},
    toast: () => {},
    canEdit: false,
    canShape: false,
    warm: [KEPT],
    ...over,
  }) as unknown as SheetsBridge;
const flush = () => new Promise((res) => setTimeout(res, 0));

beforeEach(() => {
  vi.clearAllMocks();
  forgetSheetStores();
});

describe('the sheet store, warm', () => {
  it("shows the kept tab's sheets with no plan known, fetching and queueing nothing", async () => {
    const store = sheetStoreOf(bridgeFor(''));
    expect(store.sheet('s1')?.title).toBe('Budget');
    // Only the kept tab's sheets.
    expect(store.sheet('sX')).toBeUndefined();
    await store.loadTab('t1');
    expect(api.fetchSheets).not.toHaveBeenCalled();
    expect(store.status('t1')).toBe('loading');
    expect((store as unknown as { deps: { queue: unknown } }).deps.queue).toBeNull();
    // Seeded once: the same store again adds nothing.
    const version = store.getVersion();
    sheetStoreOf(bridgeFor(''));
    expect(store.getVersion()).toBe(version);
  });

  it("seeds each kept tab's sheets, the first tab's and a Dashboard's shown Sheet's", () => {
    const shown = { tabId: 't9', sheets: [sheet('sX', 't9', 'Other')] };
    const store = sheetStoreOf(bridgeFor('', { warm: [KEPT, shown] }));
    expect(store.sheet('s1')?.title).toBe('Budget');
    expect(store.sheet('sX')?.title).toBe('Other');
  });

  it("shows them in the plan's store until its first read, which drops what the server no longer holds", async () => {
    const onTabRead = vi.fn();
    const fresh = [{ ...sheet('s1', 't1', 'Budget 2026'), rev: 2 }];
    api.fetchSheets.mockResolvedValue(fresh);
    const store = sheetStoreOf(bridgeFor('plan-1', { onTabRead }));
    expect(store.sheet('s2')?.title).toBe('Gone');
    await store.loadTab('t1');
    await flush();
    expect(api.fetchSheets).toHaveBeenCalledOnce();
    expect(store.sheet('s1')?.title).toBe('Budget 2026');
    expect(store.sheet('s2')).toBeUndefined();
    expect(store.status('t1')).toBe('ready');
    expect(onTabRead).toHaveBeenCalledExactlyOnceWith('t1', fresh);
  });

  it('leaves a sheet the store already holds, and another tab, alone', async () => {
    api.fetchSheets.mockImplementation(async (_s: unknown, q: { tabId: string }) =>
      q.tabId === 't1' ? [sheet('s1', 't1', 'Mine')] : [sheet('s7', 't2', 'Seven')],
    );
    const store = sheetStoreOf(bridgeFor('plan-2', { warm: null }));
    await store.loadTab('t1');
    store.seedWarm(KEPT);
    expect(store.sheet('s1')?.title).toBe('Mine');
    expect(store.sheet('s2')?.title).toBe('Gone');
    // A read of another tab drops no kept sheet of the kept tab.
    await store.loadTab('t2');
    expect(store.sheet('s2')?.title).toBe('Gone');
    // Nothing new to seed: no change.
    const version = store.getVersion();
    store.seedWarm({ tabId: 't1', sheets: [] });
    expect(store.getVersion()).toBe(version);
  });
});
