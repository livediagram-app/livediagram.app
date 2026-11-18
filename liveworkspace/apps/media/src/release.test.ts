// A document's release of a picture (liveworkspace/docs/specs/006-media/media.md "Releases"): the row and the bytes go
// only while the image is claimed by that document in the calling app and no reference in any app names it, all
// re-checked by the service at that instant; everything else is kept, with why.
import type { MediaUploadResponse } from '@liveworkspace/media';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { testDb, type TestDb } from './test-sqlite-d1';

const BASE = 'https://liveworkspace.app/api/media';
const PLANNER = { app: 'liveplanner.app', key: 'lp-key' };
const DIAGRAM = { app: 'livediagram.app', key: 'ld-key' };

let db: TestDb;
beforeEach(() => {
  db = testDb({ MEDIA_KEY_LIVEPLANNER: 'lp-key' });
});

const as = (who: { app: string; key: string }, path: string, init: RequestInit = {}) =>
  worker.fetch(
    new Request(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${who.key}`, 'X-Media-App': who.app, ...init.headers },
    }),
    db.env,
  );

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (seed: number) =>
  new Uint8Array([...PNG, ...Array.from({ length: 16 }, (_, i) => seed + i)]);

async function upload(seed: number, document?: string, who = PLANNER): Promise<string> {
  const bytes = png(seed);
  const res = await as(who, '/app/images?owner=user_1', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'X-Image-Width': '4',
      'X-Image-Height': '4',
      ...(document ? { 'X-Media-Document': document } : {}),
    },
    body: bytes,
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as MediaUploadResponse).image.id;
}

type Entry = { document: string; images: string[] };
const sync = (documents: Entry[], who = PLANNER, pending?: Entry[]) =>
  as(who, '/app/refs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pending ? { documents, pending } : { documents }),
  });

const release = async (id: string, document: string, who = PLANNER) => {
  const res = await as(
    who,
    `/app/images/${encodeURIComponent(id)}/release?document=${encodeURIComponent(document)}`,
    { method: 'POST' },
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

const stored = (id: string) => ({
  row: db.sql.prepare('SELECT 1 FROM images WHERE id = ?').all(id).length === 1,
  bytes: db.objects.has(id),
});

describe('a release', () => {
  it('deletes the row and the R2 bytes of a picture its document claimed and nothing names', async () => {
    const id = await upload(1, 'plan-1');
    // The plan's own report dropped it.
    await sync([{ document: 'plan-1', images: [] }]);
    expect(await release(id, 'plan-1')).toEqual({ status: 200, body: { released: true } });
    expect(stored(id)).toEqual({ row: false, bytes: false });
  });

  it('keeps it while the document’s own report still names it', async () => {
    const id = await upload(2, 'plan-1');
    expect((await release(id, 'plan-1')).body).toEqual({ released: false, reason: 'referenced' });
    expect(stored(id)).toEqual({ row: true, bytes: true });
  });

  it('keeps it while another document places it, a copied plan among them', async () => {
    const id = await upload(3, 'plan-1');
    await sync([
      { document: 'plan-1', images: [] },
      { document: 'plan-copy', images: [id] },
    ]);
    expect((await release(id, 'plan-1')).body).toEqual({ released: false, reason: 'referenced' });
    expect(stored(id)).toEqual({ row: true, bytes: true });
  });

  // A copy whose own report keeps failing past the source's grace (media.md "Unconfirmed references", Work Tracker
  // 1190): its source vouched for it, so the picture stays until the copy's own report says otherwise.
  it('keeps it while a copy whose own report has not landed is vouched for, until that report lands', async () => {
    const id = await upload(30, 'plan-1');
    await sync([{ document: 'plan-1', images: [] }], PLANNER, [
      { document: 'plan-copy', images: [id] },
    ]);
    expect((await release(id, 'plan-1')).body).toEqual({ released: false, reason: 'unconfirmed' });
    expect(stored(id)).toEqual({ row: true, bytes: true });
    // The copy's report holds it: a confirmed reference now.
    await sync([{ document: 'plan-copy', images: [id] }]);
    expect((await release(id, 'plan-1')).body).toEqual({ released: false, reason: 'referenced' });
    // The copy dropped it too: nothing names it.
    await sync([{ document: 'plan-copy', images: [] }]);
    expect(await release(id, 'plan-1')).toEqual({ status: 200, body: { released: true } });
    expect(stored(id)).toEqual({ row: false, bytes: false });
  });

  it('records no unconfirmed reference over a document that has reported', async () => {
    const id = await upload(31, 'plan-1');
    const other = await upload(32, 'plan-1');
    // The copy reported first, without the picture; its source's word comes after and is not recorded.
    await sync([{ document: 'plan-copy', images: [other] }]);
    await sync([{ document: 'plan-1', images: [other] }], PLANNER, [
      { document: 'plan-copy', images: [id] },
    ]);
    expect(await release(id, 'plan-1')).toEqual({ status: 200, body: { released: true } });
  });

  it('refuses a malformed pending list, and one past the cap with the documents', async () => {
    const status = async (body: unknown) =>
      (
        await as(PLANNER, '/app/refs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      ).status;
    expect(await status({ documents: [], pending: 'plan-copy' })).toBe(400);
    expect(await status({ documents: [], pending: [{ document: 'plan-copy', images: [1] }] })).toBe(
      400,
    );
    const many = Array.from({ length: 300 }, (_, i) => ({ document: `p${i}`, images: [] }));
    expect(await status({ documents: many, pending: many })).toBe(400);
    expect(await status({ documents: many.slice(0, 200), pending: many.slice(0, 200) })).toBe(200);
  });

  it('keeps it while another app places it', async () => {
    const id = await upload(4, 'plan-1');
    await sync([{ document: 'plan-1', images: [] }]);
    await sync([{ document: 'diagram-1', images: [id] }], DIAGRAM);
    expect((await release(id, 'plan-1')).body).toEqual({ released: false, reason: 'referenced' });
    expect(stored(id)).toEqual({ row: true, bytes: true });
  });

  it('keeps a picture claimed by another document, and one claimed by none', async () => {
    const other = await upload(5, 'plan-2');
    await sync([{ document: 'plan-2', images: [] }]);
    expect((await release(other, 'plan-1')).body).toEqual({
      released: false,
      reason: 'not_claimed',
    });
    const unclaimed = await upload(6);
    expect((await release(unclaimed, 'plan-1')).body).toEqual({
      released: false,
      reason: 'not_claimed',
    });
    expect(stored(other)).toEqual({ row: true, bytes: true });
    expect(stored(unclaimed)).toEqual({ row: true, bytes: true });
  });

  it('keeps a picture another app uploaded, even for a document of the same id', async () => {
    const id = await upload(7, 'shared-id', DIAGRAM);
    await sync([{ document: 'shared-id', images: [] }], DIAGRAM);
    expect((await release(id, 'shared-id')).body).toEqual({
      released: false,
      reason: 'not_claimed',
    });
    expect(stored(id)).toEqual({ row: true, bytes: true });
  });

  it('answers a picture already gone as missing', async () => {
    expect((await release('no-such-image', 'plan-1')).body).toEqual({
      released: false,
      reason: 'missing',
    });
  });

  it('needs the app’s key and a document', async () => {
    const id = await upload(8, 'plan-1');
    await sync([{ document: 'plan-1', images: [] }]);
    expect((await release(id, 'plan-1', { ...PLANNER, key: 'wrong' })).status).toBe(401);
    expect((await release(id, '')).status).toBe(400);
    expect((await release(id, 'x'.repeat(201))).body).toEqual({ error: 'invalid_document' });
    expect(stored(id)).toEqual({ row: true, bytes: true });
  });

  it('keeps the row gone when the R2 delete fails, and says so', async () => {
    const id = await upload(9, 'plan-1');
    await sync([{ document: 'plan-1', images: [] }]);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.env.MEDIA = {
      ...db.env.MEDIA,
      delete: async () => {
        throw new Error('r2 down');
      },
    } as unknown as R2Bucket;
    expect((await release(id, 'plan-1')).body).toEqual({ released: true });
    expect(stored(id).row).toBe(false);
    expect(error).toHaveBeenCalledWith(
      '[media] R2 delete failed after a release',
      { id },
      expect.any(Error),
    );
    error.mockRestore();
  });
});
