import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeBlobBatch } from '@livedesign/api-schema';
import { blobIdOf } from '@livedesign/photo-engine';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// The photo blob store's routes (docs/specs/031-photo/photo-store.md "The routes"): the access
// gates (the index's grants) are stubbed, as they have their own tests; the refs are a real SQLite with the
// design's schema, the bytes and the designs' markers an in-memory R2.

const { db, access, index } = vi.hoisted(() => ({
  db: { designHasTab: vi.fn() },
  access: { gateRead: vi.fn(), gateEdit: vi.fn() },
  index: { requestGrant: vi.fn() },
}));
vi.mock('../db/tabs', async (importOriginal) => ({ ...(await importOriginal<object>()), ...db }));
vi.mock('./context', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...access,
}));
vi.mock('../index-service', async (importOriginal) => {
  const original = await importOriginal<typeof import('../index-service')>();
  return { ...original, indexService: { ...original.indexService, ...index } };
});

import { handlePhotoBlobRoutes } from './photo-blob-routes';

const PNG = (n: number) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

function r2() {
  const store = new Map<string, { bytes: Uint8Array; type: string }>();
  return {
    store,
    put: vi.fn(
      async (key: string, bytes: Uint8Array, opts?: { httpMetadata: { contentType: string } }) => {
        store.set(key, { bytes: new Uint8Array(bytes), type: opts?.httpMetadata.contentType ?? '' });
      },
    ),
    get: vi.fn(async (key: string) => {
      const v = store.get(key);
      return v ? { body: v.bytes, httpMetadata: { contentType: v.type } } : null;
    }),
    delete: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
    }),
    list: vi.fn(async ({ prefix, limit }: { prefix: string; limit?: number }) => ({
      objects: [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .slice(0, limit ?? 1000)
        .map((key) => ({ key })),
    })),
  };
}

let env: Env;
let bucket: ReturnType<typeof r2>;
let sql: ReturnType<typeof sqliteD1>['sql'];

beforeEach(() => {
  bucket = r2();
  const made = sqliteD1({ PHOTO_BLOBS: bucket } as unknown as Partial<Env>);
  env = made.env;
  sql = made.sql;
  for (const fn of [...Object.values(db), ...Object.values(access), ...Object.values(index)])
    fn.mockReset();
  db.designHasTab.mockResolvedValue(true);
  access.gateRead.mockResolvedValue(true);
  access.gateEdit.mockResolvedValue(true);
  index.requestGrant.mockResolvedValue({ ok: false, status: 404 });
});

const ctx = (method: string, path: string, opts: Parameters<typeof makeTestRouteContext>[2] = {}) =>
  makeTestRouteContext(method, path, { owner: 'owner-1', env, ...opts });

async function upload(
  blobs: { bytes: Uint8Array; type: 'image/png' | 'image/jpeg' }[],
  tab = 't1',
  id?: (i: number) => Promise<string>,
) {
  const entries = await Promise.all(
    blobs.map(async (b, i) => ({
      id: id ? await id(i) : await blobIdOf(b.bytes),
      type: b.type,
      bytes: b.bytes,
    })),
  );
  const body = encodeBlobBatch(entries);
  const c = ctx('POST', `/api/designs/d1/tabs/${tab}/photo-blobs`);
  const request = new Request(c.request.url, {
    method: 'POST',
    body,
    headers: { 'Content-Length': String(body.length) },
  });
  return { res: (await handlePhotoBlobRoutes({ ...c, request }))!, ids: entries.map((e) => e.id) };
}

describe('photo blob routes', () => {
  it('passes other paths by', async () => {
    expect(await handlePhotoBlobRoutes(ctx('GET', '/api/designs/d1/tabs/t1/comments'))).toBeNull();
  });

  it('answers 503 without image storage', async () => {
    const c = makeTestRouteContext(
      'GET',
      '/api/designs/d1/tabs/t1/photo-blobs/abcdefghijklmnopqrstuv',
      { owner: 'owner-1', env: {} as Env },
    );
    expect((await handlePhotoBlobRoutes(c))!.status).toBe(503);
  });

  it('stores a batch, once by content, and serves it through the tab', async () => {
    const { res, ids } = await upload([
      { bytes: PNG(1), type: 'image/png' },
      { bytes: JPG, type: 'image/jpeg' },
    ]);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ stored: ids });
    const bytes = () => [...bucket.store.keys()].filter((k) => k.startsWith('photo/'));
    expect(bytes()).toHaveLength(2);
    // The same bytes again are the same object: stored once by content.
    await upload([{ bytes: PNG(1), type: 'image/png' }], 't2');
    expect(bytes()).toHaveLength(2);
    // And the design marks each blob it holds once (db/photo-blobs.ts).
    expect([...bucket.store.keys()].filter((k) => k.startsWith('photo-refs/'))).toHaveLength(2);
    const got = (await handlePhotoBlobRoutes(
      ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/${ids[0]}`),
    ))!;
    expect(got.status).toBe(200);
    expect(got.headers.get('Content-Type')).toBe('image/png');
    expect(got.headers.get('Cache-Control')).toContain('immutable');
    expect(got.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(PNG(1));
    // A tab that never named it reads nothing.
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t3/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(404);
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/nope`)))!.status,
    ).toBe(404);
  });

  it('says which blobs a tab holds', async () => {
    const { ids } = await upload([{ bytes: PNG(2), type: 'image/png' }]);
    const res = (await handlePhotoBlobRoutes(
      ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs-held', {
        body: { ids: [ids[0], 'abcdefghijklmnopqrstuv'] },
      }),
    ))!;
    expect(await res.json()).toEqual({ has: [ids[0]] });
    const bad = (await handlePhotoBlobRoutes(
      ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs-held', { body: { ids: ['x'] } }),
    ))!;
    expect(bad.status).toBe(400);
  });

  it('refuses a mismatched id, a wrong type, a bad frame and an unknown path', async () => {
    const mismatch = await upload(
      [{ bytes: PNG(3), type: 'image/png' }],
      't1',
      async () => 'abcdefghijklmnopqrstuv',
    );
    expect(mismatch.res.status).toBe(400);
    expect(await mismatch.res.json()).toEqual({ error: 'blob_mismatch' });
    const wrongType = await upload([{ bytes: JPG, type: 'image/png' }]);
    expect(wrongType.res.status).toBe(415);
    const c = ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs');
    const junk = await handlePhotoBlobRoutes({
      ...c,
      request: new Request(c.request.url, {
        method: 'POST',
        body: new Uint8Array([0, 0, 0, 9, 1]),
      }),
    });
    expect(junk!.status).toBe(400);
    expect(
      await handlePhotoBlobRoutes(ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs/other')),
    ).toBeNull();
    expect(
      await handlePhotoBlobRoutes(ctx('DELETE', '/api/designs/d1/tabs/t1/photo-blobs')),
    ).toBeNull();
    const huge = ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs', {
      headers: { 'Content-Length': String(100 * 1024 * 1024) },
    });
    expect((await handlePhotoBlobRoutes(huge))!.status).toBe(413);
  });

  it('holds a tab to its cap', async () => {
    env = { ...env, PHOTO_MAX_BYTES_PER_TAB: '15' };
    const first = await upload([{ bytes: PNG(4), type: 'image/png' }]);
    expect(first.res.status).toBe(200);
    const second = await upload([{ bytes: PNG(5), type: 'image/png' }]);
    expect(second.res.status).toBe(403);
    expect(await second.res.json()).toEqual({ error: 'photo_full', limit: 15, current: 11 });
    // A blob the tab already holds costs nothing more.
    expect((await upload([{ bytes: PNG(4), type: 'image/png' }])).res.status).toBe(200);
  });

  it('refuses writes from those who may not edit, and from tokens', async () => {
    access.gateEdit.mockResolvedValue(false);
    expect((await upload([{ bytes: PNG(6), type: 'image/png' }])).res.status).toBe(403);
    access.gateEdit.mockResolvedValue(true);
    const token = ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs-held', {
      body: { ids: [] },
      token: { id: 'tok' },
    });
    expect((await handlePhotoBlobRoutes(token))!.status).toBe(403);
  });

  it('refuses reads to those who may not read, and of a tab not in the design', async () => {
    const { ids } = await upload([{ bytes: PNG(7), type: 'image/png' }]);
    access.gateRead.mockResolvedValue(false);
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(404);
    access.gateRead.mockResolvedValue(true);
    db.designHasTab.mockResolvedValue(false);
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(404);
    db.designHasTab.mockResolvedValue(true);
    bucket.store.clear();
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(404);
  });

  it('adopts a readable tab’s blobs into another tab', async () => {
    const { ids } = await upload([{ bytes: PNG(8), type: 'image/png' }]);
    const res = (await handlePhotoBlobRoutes(
      ctx('POST', '/api/designs/d1/tabs/t9/photo-blobs-adopt', {
        body: { fromDesign: 'd1', fromTab: 't1', ids: [ids[0], 'abcdefghijklmnopqrstuv'] },
      }),
    ))!;
    expect(await res.json()).toEqual({ adopted: [ids[0]] });
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t9/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(200);
    access.gateRead.mockResolvedValue(false);
    const refused = (await handlePhotoBlobRoutes(
      ctx('POST', '/api/designs/d1/tabs/t8/photo-blobs-adopt', {
        body: { fromDesign: 'd1', fromTab: 't1', ids },
      }),
    ))!;
    expect(refused.status).toBe(403);
    const bad = (await handlePhotoBlobRoutes(
      ctx('POST', '/api/designs/d1/tabs/t8/photo-blobs-adopt', { body: { ids } }),
    ))!;
    expect(bad.status).toBe(400);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM photo_blob_refs').get()!.n).toBe(2);
  });

  // Another design's tab: its blobs come from that design's own store, once the index grants the caller a read of
  // that tab; a lost link or another tab's scope adopts nothing.
  it('adopts from another design the caller may read, by the index’s grant', async () => {
    const { ids } = await upload([{ bytes: PNG(9), type: 'image/png' }]);
    const adopt = () =>
      handlePhotoBlobRoutes(
        ctx('POST', '/api/designs/d2/tabs/t2/photo-blobs-adopt', {
          body: { fromDesign: 'd1', fromTab: 't1', ids },
        }),
      );
    expect((await adopt())!.status).toBe(403);
    index.requestGrant.mockResolvedValue({ ok: true, grant: { level: 'view', tabId: 't3' } });
    expect((await adopt())!.status).toBe(403);
    index.requestGrant.mockResolvedValue({ ok: true, grant: { level: 'view', tabId: null } });
    expect(await (await adopt())!.json()).toEqual({ adopted: ids });
    expect(
      sql.prepare("SELECT blob_id FROM photo_blob_refs WHERE tab_id = 't2'").all(),
    ).toEqual([{ blob_id: ids[0] }]);
  });
});
