import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeBlobBatch } from '@livedesign/api-schema';
import { blobIdOf } from '@livedesign/photo-engine';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';

// The photo blob store's routes (docs/specs/031-photo/photo-store.md "The routes"): the access
// gates are stubbed (they have their own tests); the rows are a real SQLite with every migration,
// the bytes an in-memory R2.

const { db, access } = vi.hoisted(() => ({
  db: {
    getDesign: vi.fn(),
    designLinksTab: vi.fn(),
    tabBelongsElsewhere: vi.fn(),
  },
  access: {
    canReadDesign: vi.fn(),
    canEditDesign: vi.fn(),
    resolveDesignGrant: vi.fn(),
  },
}));
vi.mock('../db', async (importOriginal) => ({ ...(await importOriginal<object>()), ...db }));
vi.mock('../auth/design-access', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...access,
}));

import { handlePhotoBlobRoutes } from './photo-blob-routes';

const PNG = (n: number) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

function r2() {
  const store = new Map<string, { bytes: Uint8Array; type: string }>();
  return {
    store,
    put: vi.fn(
      async (key: string, bytes: Uint8Array, opts: { httpMetadata: { contentType: string } }) => {
        store.set(key, { bytes: new Uint8Array(bytes), type: opts.httpMetadata.contentType });
      },
    ),
    get: vi.fn(async (key: string) => {
      const v = store.get(key);
      return v ? { body: v.bytes, httpMetadata: { contentType: v.type } } : null;
    }),
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
  for (const fn of [...Object.values(db), ...Object.values(access)]) fn.mockReset();
  db.getDesign.mockResolvedValue({ id: 'd1', ownerId: 'owner-1', teamId: null });
  db.designLinksTab.mockResolvedValue(true);
  db.tabBelongsElsewhere.mockResolvedValue(false);
  access.canReadDesign.mockResolvedValue(true);
  access.canEditDesign.mockResolvedValue(true);
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
    expect(
      await handlePhotoBlobRoutes(ctx('GET', '/api/designs/d1/tabs/t1/comment-pictures')),
    ).toBeNull();
  });

  it('answers 503 without image storage', async () => {
    const c = makeTestRouteContext(
      'GET',
      '/api/designs/d1/tabs/t1/photo-blobs/abcdefghijklmnopqrstuv',
      { owner: 'owner-1', env: { DB: env.DB } as Env },
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
    expect(bucket.put).toHaveBeenCalledTimes(2);
    // The same bytes again write nothing new.
    await upload([{ bytes: PNG(1), type: 'image/png' }], 't2');
    expect(bucket.put).toHaveBeenCalledTimes(2);
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
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/nope`)))!
        .status,
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

  it('refuses writes from those who may not edit, from tokens, and onto another design’s tab', async () => {
    access.canEditDesign.mockResolvedValue(false);
    expect((await upload([{ bytes: PNG(6), type: 'image/png' }])).res.status).toBe(403);
    access.canEditDesign.mockResolvedValue(true);
    const token = ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs-held', {
      body: { ids: [] },
      token: { id: 'tok' },
    });
    expect((await handlePhotoBlobRoutes(token))!.status).toBe(403);
    db.tabBelongsElsewhere.mockResolvedValue(true);
    expect((await upload([{ bytes: PNG(6), type: 'image/png' }])).res.status).toBe(403);
    db.getDesign.mockResolvedValue(null);
    expect(
      (await handlePhotoBlobRoutes(
        ctx('POST', '/api/designs/d1/tabs/t1/photo-blobs-held', { body: { ids: [] } }),
      ))!.status,
    ).toBeGreaterThanOrEqual(400);
  });

  it('refuses reads to those who may not read, and of a tab not in the design', async () => {
    const { ids } = await upload([{ bytes: PNG(7), type: 'image/png' }]);
    access.canReadDesign.mockResolvedValue(false);
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(404);
    access.canReadDesign.mockResolvedValue(true);
    db.designLinksTab.mockResolvedValue(false);
    expect(
      (await handlePhotoBlobRoutes(ctx('GET', `/api/designs/d1/tabs/t1/photo-blobs/${ids[0]}`)))!
        .status,
    ).toBe(404);
    db.designLinksTab.mockResolvedValue(true);
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
    access.canReadDesign.mockResolvedValue(false);
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
});
