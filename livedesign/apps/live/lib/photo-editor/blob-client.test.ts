import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeBlobBatch, type PhotoBlobEntry } from '@livedesign/api-schema';

// docs/specs/031-photo/photo-store.md "The routes" and "Offline Mode documents": the blob store's calls,
// to the api for a stored document and to this browser for an Offline Mode one.
const offline = new Set<string>();
vi.mock('../offline/offline-ids', () => ({
  isOfflineId: async (id: string) => offline.has(id),
}));
vi.mock('../api/core', () => ({
  API_BASE: 'https://api.test/api',
  apiFetch: (...a: Parameters<typeof fetch>) => fetch(...a),
  apiHeaders: async (owner: string, o: { share?: string | null; body?: boolean } = {}) => ({
    'X-Owner-Id': owner,
    ...(o.share ? { 'X-Share-Code': o.share } : {}),
    ...(o.body ? { 'Content-Type': 'application/json' } : {}),
  }),
}));

const { adoptBlobs, blobsHeld, fetchBlob, PhotoBlobError, uploadBlobs } =
  await import('./blob-client');
const { offlineBlobsFor } = await import('./offline-blobs');

const scope = { ownerId: 'p_owner', documentId: 'doc 1', shareCode: 'CODE' };
const entry = (id: string, n: number): PhotoBlobEntry => ({
  id,
  type: 'image/png',
  bytes: new Uint8Array([n, n + 1, n + 2]),
});

function answer(status: number, body: unknown, asBlob = false) {
  const res = asBlob
    ? new Response(new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }), { status })
    : new Response(body === undefined ? null : JSON.stringify(body), { status });
  const spy = vi.fn(async () => res);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  offline.clear();
});

describe('the photo blob client', () => {
  it('asks which blobs the tab holds, by its document and tab', async () => {
    const f = answer(200, { has: ['b1'] });
    expect(await blobsHeld(scope, 'tab/1', ['b1', 'b2'])).toEqual(new Set(['b1']));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.test/api/documents/doc%201/tabs/tab%2F1/photo-blobs-held');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ ids: ['b1', 'b2'] });
    expect((init.headers as Record<string, string>)['X-Share-Code']).toBe('CODE');
  });

  it('asks nothing for no ids', async () => {
    const f = answer(200, {});
    expect(await blobsHeld(scope, 't', [])).toEqual(new Set());
    await uploadBlobs(scope, 't', []);
    expect(await adoptBlobs(scope, 't', { documentId: 'd2', tabId: 't2' }, [])).toEqual(new Set());
    expect(f).not.toHaveBeenCalled();
  });

  it('uploads a batch as one binary body', async () => {
    const f = answer(204, undefined);
    const ids = ['b1', 'b2'].map((k) => k.padEnd(22, 'x'));
    await uploadBlobs(scope, 't', [entry(ids[0]!, 1), entry(ids[1]!, 4)]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/photo-blobs$/);
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/octet-stream');
    const sent = decodeBlobBatch(init.body as Uint8Array);
    if (sent === 'bad_batch') throw new Error(sent);
    expect(sent.map((e) => e.id)).toEqual(ids);
  });

  it('adopts another tab’s blobs', async () => {
    const f = answer(200, { adopted: ['b1'] });
    expect(await adoptBlobs(scope, 't', { documentId: 'd2', tabId: 't2' }, ['b1', 'b9'])).toEqual(
      new Set(['b1']),
    );
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      fromDocument: 'd2',
      fromTab: 't2',
      ids: ['b1', 'b9'],
    });
  });

  it('reads a blob, or null when the store has none', async () => {
    answer(200, undefined, true);
    const got = await fetchBlob(scope, 't', 'b1');
    expect(got?.size).toBe(3);
    answer(404, { error: 'not_found' });
    expect(await fetchBlob(scope, 't', 'b1')).toBeNull();
  });

  it('throws the status and the api’s error code, or no code when the body is empty', async () => {
    answer(403, { error: 'forbidden' });
    const err = await blobsHeld(scope, 't', ['b1']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PhotoBlobError);
    expect(err).toMatchObject({
      status: 403,
      code: 'forbidden',
      message: 'photo blobs: 403 forbidden',
    });
    answer(500, undefined);
    await expect(uploadBlobs(scope, 't', [entry('b1', 1)])).rejects.toMatchObject({
      status: 500,
      code: null,
    });
    answer(413, { error: 'too_large' });
    await expect(
      adoptBlobs(scope, 't', { documentId: 'd', tabId: 't' }, ['x']),
    ).rejects.toMatchObject({ code: 'too_large' });
    answer(500, {});
    await expect(fetchBlob(scope, 't', 'x')).rejects.toMatchObject({ status: 500, code: null });
  });

  it('keeps an Offline Mode document’s blobs in this browser', async () => {
    const f = answer(500, {});
    offline.add('doc 1');
    await uploadBlobs(scope, 't', [entry('o1', 1), entry('o2', 4)]);
    expect(await blobsHeld(scope, 't', ['o1', 'o3'])).toEqual(new Set(['o1']));
    const blob = await fetchBlob(scope, 't', 'o2');
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(new Uint8Array([4, 5, 6]));
    expect(blob!.type).toBe('image/png');
    expect(await fetchBlob(scope, 't', 'missing')).toBeNull();
    // Adoption needs nothing in this browser: every blob is shared already.
    expect(await adoptBlobs(scope, 't', { documentId: 'x', tabId: 'y' }, ['o1'])).toEqual(
      new Set(['o1']),
    );
    const all = await offlineBlobsFor(['o1', 'missing', 'o2']);
    expect(all.map((e) => e.id)).toEqual(['o1', 'o2']);
    expect(f).not.toHaveBeenCalled();
  });
});
