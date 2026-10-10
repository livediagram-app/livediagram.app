import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { apiLoadTabRevisioned, apiSaveTab, flushDocumentSavesBeacon } from './tabs';
import * as offlineStore from '../offline/offline-store';

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineIdSync: vi.fn(() => false),
  offlineSaveTab: vi.fn(async () => {}),
  offlineDeleteTab: vi.fn(async () => {}),
  offlineSaveDocumentMeta: vi.fn(async () => {}),
}));

// flushDocumentSavesBeacon is the beforeunload flush (docs/specs/006-document/per-tab-storage.md), now a pure
// function at the persistence boundary instead of inline raw fetch in
// useAutosave. These lock the wire behaviour the extraction had to
// preserve: keepalive on every write, X-Allow-Empty gated by loaded
// tabs, and the meta PUT only when order/name changed.

function makeTab(id: string, extra: Partial<Tab> = {}): Tab {
  return { id, name: id, elements: [], ...extra } as Tab;
}

type FetchCall = { url: string; init: RequestInit };

describe('flushDocumentSavesBeacon', () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        calls.push({ url, init });
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const base = {
    ownerId: 'owner-1',
    documentId: 'diag-1',
    shareCode: null,
    loadedTabIds: new Set<string>(),
    orderChanged: false,
    nameChanged: false,
    name: 'My diagram',
  };

  it('flushes an offline rename / reorder to IndexedDB, not just its tabs', () => {
    vi.mocked(offlineStore.isOfflineIdSync).mockReturnValueOnce(true);
    flushDocumentSavesBeacon({
      ...base,
      nameChanged: true,
      changedTabs: [],
      deletedIds: [],
      tabs: [makeTab('t1', { folder: 'f' }), makeTab('t2')],
    });
    expect(offlineStore.offlineSaveDocumentMeta).toHaveBeenCalledWith(
      'diag-1',
      {
        name: 'My diagram',
        tabs: [
          { id: 't1', folder: 'f' },
          { id: 't2', folder: undefined },
        ],
      },
      expect.any(Number),
    );
    expect(calls).toHaveLength(0);
  });

  it('PUTs each changed tab with keepalive and the owner header', () => {
    flushDocumentSavesBeacon({
      ...base,
      changedTabs: [makeTab('t1')],
      deletedIds: [],
      tabs: [makeTab('t1')],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/documents/diag-1/tabs/t1');
    expect(calls[0]!.init.method).toBe('PUT');
    expect(calls[0]!.init.keepalive).toBe(true);
    expect((calls[0]!.init.headers as Record<string, string>)['X-Owner-Id']).toBe('owner-1');
  });

  it('keeps writes alive only while they fit the browser keepalive budget, sending the rest plainly', () => {
    const big = (id: string) =>
      makeTab(id, {
        elements: [
          { id: 'n', type: 'text', x: 0, y: 0, width: 1, height: 1, label: 'x'.repeat(40_000) },
        ] as Tab['elements'],
      });
    flushDocumentSavesBeacon({
      ...base,
      changedTabs: [big('t1'), big('t2'), makeTab('t3')],
      deletedIds: [],
      tabs: [],
    });
    // 40 KB fits, a second 40 KB would pass 60 KB, the small one after it still fits.
    expect(calls.map((c) => c.init.keepalive)).toEqual([true, false, true]);
  });

  it('skips the flush for a signed-in owner with no cached token, since every write would 401', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    flushDocumentSavesBeacon({
      ...base,
      ownerId: 'user_abc',
      changedTabs: [makeTab('t1')],
      deletedIds: ['t2'],
      tabs: [makeTab('t1')],
    });
    expect(calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[save] unload flush skipped'));
    warn.mockRestore();
  });

  it('sends X-Allow-Empty only for tabs whose content was authoritatively loaded', () => {
    flushDocumentSavesBeacon({
      ...base,
      loadedTabIds: new Set(['loaded']),
      changedTabs: [makeTab('loaded'), makeTab('placeholder')],
      deletedIds: [],
      tabs: [makeTab('loaded'), makeTab('placeholder')],
    });
    const headersFor = (id: string) =>
      calls.find((c) => c.url.endsWith(`/tabs/${id}`))!.init.headers as Record<string, string>;
    expect(headersFor('loaded')['X-Allow-Empty']).toBe('1');
    expect(headersFor('placeholder')['X-Allow-Empty']).toBeUndefined();
  });

  it('DELETEs removed tabs and only PUTs document meta when order/name changed', () => {
    flushDocumentSavesBeacon({
      ...base,
      orderChanged: true,
      changedTabs: [],
      deletedIds: ['gone'],
      tabs: [makeTab('t1')],
    });
    const del = calls.find((c) => c.init.method === 'DELETE')!;
    expect(del.url).toBe('/api/documents/diag-1/tabs/gone');
    expect(del.init.keepalive).toBe(true);
    const meta = calls.find((c) => c.url === '/api/documents/diag-1')!;
    expect(meta.init.method).toBe('PUT');
    expect(meta.init.keepalive).toBe(true);
  });

  it('carries the share code header when present', () => {
    flushDocumentSavesBeacon({
      ...base,
      shareCode: 'abc',
      changedTabs: [makeTab('t1')],
      deletedIds: [],
      tabs: [makeTab('t1')],
    });
    expect((calls[0]!.init.headers as Record<string, string>)['X-Share-Code']).toBe('abc');
  });
});

// The changeset revision (docs/specs/024-agents/agent-changesets.md "The write path" step 8): every
// save tells the api the highest changeset revision this editor has applied to the tab.
describe('the changeset seen revision', () => {
  let calls: FetchCall[];
  beforeEach(() => {
    calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        calls.push({ url, init });
        if (init?.method === undefined || init.method === 'GET') {
          return Promise.resolve(
            Response.json({
              tab: {
                id: 't1',
                name: 'T',
                elements: [],
                rev: 7,
                documentId: 'd',
                orderIndex: 0,
                updatedAt: 1,
              },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the beacon sends it per tab, and nothing for a tab without one', () => {
    flushDocumentSavesBeacon({
      ownerId: 'owner-1',
      documentId: 'diag-1',
      shareCode: null,
      loadedTabIds: new Set(),
      orderChanged: false,
      nameChanged: false,
      name: 'D',
      changedTabs: [makeTab('a'), makeTab('b')],
      deletedIds: [],
      tabs: [makeTab('a'), makeTab('b')],
      changesetSeen: new Map([['a', 4]]),
    });
    const headersFor = (id: string) =>
      calls.find((c) => c.url.endsWith(`/tabs/${id}`))!.init.headers as Record<string, string>;
    expect(headersFor('a')['X-Changeset-Seen']).toBe('4');
    expect(headersFor('b')['X-Changeset-Seen']).toBeUndefined();
  });

  it('a save sends it', async () => {
    await apiSaveTab('owner-1', 'diag-1', makeTab('a'), null, { changesetSeen: 9 });
    expect(new Headers(calls[0]!.init.headers).get('X-Changeset-Seen')).toBe('9');
  });

  // The selection reference names the revision the editor knows (docs/specs/013-workspace/blueprints/
  // workbench-embeds.md "The selection reference"): a save answers the one it wrote.
  it('a save answers the revision it wrote, or null when the answer names none', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ tab: { id: 'a', rev: 12 } }));
    expect(await apiSaveTab('owner-1', 'diag-1', makeTab('a'))).toBe(12);
    expect(await apiSaveTab('owner-1', 'diag-1', makeTab('a'))).toBeNull();
  });

  it('a revisioned load answers the tab and its revision, the revision kept out of the tab', async () => {
    const loaded = await apiLoadTabRevisioned('owner-1', 'diag-1', 't1', null);
    expect(loaded?.rev).toBe(7);
    expect(loaded?.tab).toEqual({ id: 't1', name: 'T', elements: [] });
  });
});
