import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRASH_RETENTION_MS } from '@livediagram/api-schema';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from '../offline/offline-store';
import { offlineTrashDocument } from '../offline/offline-trash';
import { memBackend, testRecord } from '../offline/offline-test-utils';
import { isDocumentDeleted, markDocumentDeleted } from '../document-tombstones';
import { isDocumentTrashedError } from '../document-trashed';
import { apiDeleteDocument, apiListDocuments, apiLoadDocument } from './documents';
import { apiEmptyTrash, apiListTrash, apiPurgeDocument, apiRestoreDocument } from './trash';

// The editor's Trash calls (docs/specs/013-workspace/trash.md): one surface
// over the api's Trash and this browser's, dispatching on the offline index.

const T0 = 1_700_000_000_000;
const ROW = {
  id: 'c1',
  name: 'Cloud',
  teamId: null,
  teamName: null,
  trashedAt: T0,
  purgeAt: T0 + TRASH_RETENTION_MS,
};

type Seen = { method: string; url: string };

function stubFetch(answer: (url: string, method: string) => Response): Seen[] {
  const seen: Seen[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      seen.push({ method, url: String(url) });
      return answer(String(url), method);
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
  __setOfflineBackend(null);
});

describe('apiListTrash', () => {
  it('lists the cloud Trash and this browser’s', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'l1', name: 'Local' }));
    await offlineTrashDocument('l1', T0);
    stubFetch(() => Response.json({ trash: [ROW] }));

    const listing = await apiListTrash('owner', T0 + 1);

    expect(listing.cloud).toEqual([ROW]);
    expect(listing.local.map((r) => r.id)).toEqual(['l1']);
  });

  it('still lists this browser’s Trash when the cloud one is unreachable', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'l1' }));
    await offlineTrashDocument('l1', T0);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(() => new Response('down', { status: 503 }));

    const listing = await apiListTrash('owner', T0 + 1);

    expect(listing).toMatchObject({ cloud: null, local: [{ id: 'l1' }] });
  });

  it('purges local records past their 30 days before listing', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'l1' }));
    await offlineTrashDocument('l1', T0);
    stubFetch(() => Response.json({ trash: [] }));

    const listing = await apiListTrash('owner', T0 + TRASH_RETENTION_MS);

    expect(listing.local).toEqual([]);
    expect(await offlineGetRecord('l1')).toBeNull();
  });
});

describe('apiRestoreDocument', () => {
  it('restores a cloud document and lets this page save it again', async () => {
    __setOfflineBackend(memBackend());
    markDocumentDeleted('c1');
    const seen = stubFetch(() => Response.json({ document: { id: 'c1' } }));

    const liveDoc = await apiRestoreDocument('owner', 'c1');

    expect(seen).toEqual([{ method: 'POST', url: '/api/trash/c1/restore' }]);
    expect(liveDoc).toEqual({ id: 'c1' });
    expect(isDocumentDeleted('c1')).toBe(false);
  });

  it('restores an offline document locally, never over the network', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'l1' }));
    await offlineTrashDocument('l1', T0);
    const seen = stubFetch(() => new Response(null, { status: 500 }));

    await apiRestoreDocument('owner', 'l1');

    expect(seen).toEqual([]);
    expect((await offlineGetRecord('l1'))?.trashedAt).toBeUndefined();
  });
});

describe('apiPurgeDocument and apiEmptyTrash', () => {
  it('purge a cloud document through /api/trash', async () => {
    __setOfflineBackend(memBackend());
    const seen = stubFetch((url) =>
      url.endsWith('/trash') || url.includes('?team=')
        ? Response.json({ purged: 3 })
        : new Response(null, { status: 204 }),
    );

    await apiPurgeDocument('owner', 'c1');
    expect(await apiEmptyTrash('owner', { kind: 'personal' })).toBe(3);
    await apiEmptyTrash('owner', { kind: 'team', teamId: 't 1' });

    expect(seen).toEqual([
      { method: 'DELETE', url: '/api/trash/c1' },
      { method: 'DELETE', url: '/api/trash' },
      { method: 'DELETE', url: '/api/trash?team=t%201' },
    ]);
  });

  it('empty this browser’s Trash locally', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'l1' }));
    await offlinePutRecord(testRecord({ id: 'live' }));
    await offlineTrashDocument('l1', T0);
    const seen = stubFetch(() => new Response(null, { status: 500 }));

    expect(await apiEmptyTrash('owner', { kind: 'local' })).toBe(1);

    expect(seen).toEqual([]);
    expect(await offlineGetRecord('l1')).toBeNull();
    expect(await offlineGetRecord('live')).not.toBeNull();
  });
});

describe('deleting and loading, with a Trash', () => {
  it('moves an offline document to the local Trash on delete', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(testRecord({ id: 'l1' }));
    stubFetch(() => Response.json({ documents: [] }));

    await apiDeleteDocument('owner', 'l1');

    expect((await offlineGetRecord('l1'))?.trashedAt).toEqual(expect.any(Number));
    expect(await apiListDocuments('owner-list')).toEqual([]);
  });

  it('reads a 410 as the deleted state', async () => {
    __setOfflineBackend(memBackend());
    stubFetch(() => Response.json({ error: 'document_trashed' }, { status: 410 }));

    const err = await apiLoadDocument('owner', 'c1').catch((e: unknown) => e);

    expect(isDocumentTrashedError(err)).toBe(true);
  });
});
