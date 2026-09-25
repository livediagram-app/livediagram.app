import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import { flushDiagramSavesBeacon } from './tabs';
import * as offlineStore from '../offline/offline-store';

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineIdSync: vi.fn(() => false),
  offlineSaveTab: vi.fn(async () => {}),
  offlineDeleteTab: vi.fn(async () => {}),
  offlineSaveDiagramMeta: vi.fn(async () => {}),
}));

// flushDiagramSavesBeacon is the beforeunload flush (spec/13), now a pure
// function at the persistence boundary instead of inline raw fetch in
// useAutosave. These lock the wire behaviour the extraction had to
// preserve: keepalive on every write, X-Allow-Empty gated by loaded
// tabs, and the meta PUT only when order/name changed.

function makeTab(id: string, extra: Partial<Tab> = {}): Tab {
  return { id, name: id, elements: [], ...extra } as Tab;
}

type FetchCall = { url: string; init: RequestInit };

describe('flushDiagramSavesBeacon', () => {
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
    diagramId: 'diag-1',
    shareCode: null,
    loadedTabIds: new Set<string>(),
    orderChanged: false,
    nameChanged: false,
    name: 'My diagram',
  };

  it('flushes an offline rename / reorder to IndexedDB, not just its tabs', () => {
    vi.mocked(offlineStore.isOfflineIdSync).mockReturnValueOnce(true);
    flushDiagramSavesBeacon({
      ...base,
      nameChanged: true,
      changedTabs: [],
      deletedIds: [],
      tabs: [makeTab('t1', { folder: 'f' }), makeTab('t2')],
    });
    expect(offlineStore.offlineSaveDiagramMeta).toHaveBeenCalledWith(
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
    flushDiagramSavesBeacon({
      ...base,
      changedTabs: [makeTab('t1')],
      deletedIds: [],
      tabs: [makeTab('t1')],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('/api/diagrams/diag-1/tabs/t1');
    expect(calls[0]!.init.method).toBe('PUT');
    expect(calls[0]!.init.keepalive).toBe(true);
    expect((calls[0]!.init.headers as Record<string, string>)['X-Owner-Id']).toBe('owner-1');
  });

  it('sends X-Allow-Empty only for tabs whose content was authoritatively loaded', () => {
    flushDiagramSavesBeacon({
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

  it('DELETEs removed tabs and only PUTs diagram meta when order/name changed', () => {
    flushDiagramSavesBeacon({
      ...base,
      orderChanged: true,
      changedTabs: [],
      deletedIds: ['gone'],
      tabs: [makeTab('t1')],
    });
    const del = calls.find((c) => c.init.method === 'DELETE')!;
    expect(del.url).toBe('/api/diagrams/diag-1/tabs/gone');
    expect(del.init.keepalive).toBe(true);
    const meta = calls.find((c) => c.url === '/api/diagrams/diag-1')!;
    expect(meta.init.method).toBe('PUT');
    expect(meta.init.keepalive).toBe(true);
  });

  it('carries the share code header when present', () => {
    flushDiagramSavesBeacon({
      ...base,
      shareCode: 'abc',
      changedTabs: [makeTab('t1')],
      deletedIds: [],
      tabs: [makeTab('t1')],
    });
    expect((calls[0]!.init.headers as Record<string, string>)['X-Share-Code']).toBe('abc');
  });
});
