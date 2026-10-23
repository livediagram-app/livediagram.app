import { describe, expect, it, vi } from 'vitest';
import { PHOTO_SWEEP_GRACE_MS } from '@livedesign/photo-engine';
import { sqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import {
  designBlobIds,
  photoBlobKey,
  recordBlobs,
  releaseBlobs,
  sweepDesignPhotoBlobs,
  tabHoldsBlobs,
} from './photo-blobs';
import { upsertTab } from './tabs';

// The photo blob store's bookkeeping (docs/specs/031-photo/photo-store.md): bytes shared by content in one
// bucket, each design's refs in its own store, and a marker per design beside the bytes, so the bytes go only once
// no design holds them. Two designs here are two SQLite stores sharing one in-memory bucket, as two Durable
// Objects share PHOTO_BLOBS.

function bucket() {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    put: vi.fn(async (key: string, bytes: Uint8Array) => void store.set(key, bytes)),
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

function design(id: string, shared: ReturnType<typeof bucket>) {
  const db = sqliteD1({ PHOTO_BLOBS: shared } as unknown as Partial<Env>);
  db.sql
    .prepare(
      'INSERT INTO test_designs (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, 1, 1)',
    )
    .run(id, 'owner', id);
  return db;
}

const blob = (id: string) => ({ id, type: 'image/png', size: 10 });
const markers = (b: ReturnType<typeof bucket>) =>
  [...b.store.keys()].filter((k) => k.startsWith('photo-refs/')).sort();

describe('photo blob refs and markers', () => {
  it("marks a blob once per design, before the design's first ref", async () => {
    const b = bucket();
    const a = design('A', b);
    await recordBlobs(a.env, 'A', 't1', [blob('x')]);
    await recordBlobs(a.env, 'A', 't2', [blob('x')]);
    expect(markers(b)).toEqual(['photo-refs/x/A']);
    expect([...(await tabHoldsBlobs(a.env, 't2', ['x', 'y']))]).toEqual(['x']);
  });

  it('keeps the bytes while another design still holds the blob', async () => {
    const b = bucket();
    b.store.set(photoBlobKey('x'), new Uint8Array([1]));
    const a = design('A', b);
    const c = design('C', b);
    await recordBlobs(a.env, 'A', 't1', [blob('x')]);
    await recordBlobs(c.env, 'C', 't9', [blob('x')]);
    expect(await releaseBlobs(a.env, 'A', ['x'])).toBe(0);
    expect(b.store.has(photoBlobKey('x'))).toBe(true);
    expect(await releaseBlobs(c.env, 'C', ['x'])).toBe(1);
    expect(b.store.has(photoBlobKey('x'))).toBe(false);
    expect(markers(b)).toEqual([]);
  });

  it('logs a failed release and keeps the bytes', async () => {
    const b = bucket();
    b.store.set(photoBlobKey('x'), new Uint8Array([1]));
    const a = design('A', b);
    b.list.mockRejectedValueOnce(new Error('r2 down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await releaseBlobs(a.env, 'A', ['x'])).toBe(0);
    expect(b.store.has(photoBlobKey('x'))).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("the design's daily sweep", () => {
  const photoTab = (id: string, ...blobs: string[]) =>
    ({
      id,
      name: id,
      elements: [],
      photos: blobs.length
        ? { layers: [{ id: 'l', kind: 'pixel', tiles: blobs.map((b) => ({ blob: b })) }] }
        : undefined,
    }) as never;

  it("drops a ref its tab no longer names once it is past the grace, then the blob's bytes", async () => {
    const b = bucket();
    b.store.set(photoBlobKey('x'), new Uint8Array([1]));
    const a = design('A', b);
    await upsertTab(a.env, 'A', photoTab('t1'), 0);
    const old = Date.now() - PHOTO_SWEEP_GRACE_MS - 1;
    await recordBlobs(a.env, 'A', 't1', [blob('x')], old);
    const swept = await sweepDesignPhotoBlobs(a.env, 'A', Date.now());
    expect(swept).toEqual({ refs: 1, blobs: 1 });
    expect(await designBlobIds(a.env)).toEqual([]);
    expect(b.store.has(photoBlobKey('x'))).toBe(false);
  });

  it('keeps a young ref, even one its tab does not name yet', async () => {
    const b = bucket();
    const a = design('A', b);
    await upsertTab(a.env, 'A', photoTab('t1'), 0);
    await recordBlobs(a.env, 'A', 't1', [blob('x')]);
    expect(await sweepDesignPhotoBlobs(a.env, 'A', Date.now())).toEqual({ refs: 0, blobs: 0 });
    expect(await designBlobIds(a.env)).toEqual(['x']);
  });

  it('drops every old ref of a tab that is gone', async () => {
    const b = bucket();
    const a = design('A', b);
    const old = Date.now() - PHOTO_SWEEP_GRACE_MS - 1;
    await recordBlobs(a.env, 'A', 'gone', [blob('x'), blob('y')], old);
    expect(await sweepDesignPhotoBlobs(a.env, 'A', Date.now())).toEqual({ refs: 2, blobs: 2 });
  });
});
