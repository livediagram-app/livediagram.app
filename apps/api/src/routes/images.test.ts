import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Characterisation tests for handleImages' authorisation surface
// (docs/specs/009-elements/images.md). Covers: the 503 fallback when R2 is absent (self-host), the
// owner gate on the gallery list / usage / delete, and the byte-read
// access policy (image owner OR a share-readable document that references
// the image). Pins behaviour ahead of the requireOwner extraction.

const { db, canReadDocument, resolveDocumentGrant } = vi.hoisted(() => ({
  db: {
    deleteImage: vi.fn(),
    documentServesImage: vi.fn(),
    findImageBySha: vi.fn(),
    getDocument: vi.fn(),
    getImage: vi.fn(),
    imageTotalsByOwner: vi.fn(),
    imageUsageByOwner: vi.fn(),
    insertImage: vi.fn(),
    listImagesByOwner: vi.fn(),
    networkUploadKey: vi.fn(),
    networkUploadUsage: vi.fn(),
    recordNetworkUpload: vi.fn(),
    secondsToNextUtcDay: vi.fn(),
    utcDay: vi.fn(),
  },
  canReadDocument: vi.fn(),
  resolveDocumentGrant: vi.fn(),
}));
vi.mock('../db', () => db);
// The timeline write runs off the response path; these tests have no D1.
vi.mock('../timeline', () => ({ recordImageUploaded: vi.fn(async () => {}) }));
vi.mock('../auth/document-access', () => ({
  canReadDocument,
  canEditDocument: vi.fn(),
  resolveDocumentGrant,
}));

import type { RouteContext } from './context';
import { handleImages } from './images';

function imagesBinding() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

// Guest-shaped context ('owner-1') with the IMAGES binding stubbed in.
const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; images?: unknown } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
    env: { IMAGES: opts.images === undefined ? imagesBinding() : opts.images } as unknown as Env,
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  canReadDocument.mockReset();
  resolveDocumentGrant.mockReset();
  // The byte-read gate asks for the grant; drive it from canReadDocument so
  // the allow / deny cases below keep reading as they did.
  resolveDocumentGrant.mockImplementation(async (...args: unknown[]) =>
    (await canReadDocument(...args)) ? { role: 'view', tabScope: null } : null,
  );
});

describe('handleImages', () => {
  it('503 when the R2 binding is absent (self-host without R2)', async () => {
    const res = await handleImages(makeCtx('GET', '/api/images', { images: null }));
    expect(res.status).toBe(503);
  });

  it('400 listing the gallery with no owner', async () => {
    const res = await handleImages(makeCtx('GET', '/api/images', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('200 lists the owner-scoped gallery', async () => {
    db.listImagesByOwner.mockResolvedValue([{ id: 'i1' }]);
    const res = await handleImages(makeCtx('GET', '/api/images'));
    expect(res.status).toBe(200);
    expect(db.listImagesByOwner).toHaveBeenCalledWith(expect.anything(), 'owner-1');
  });

  it('400 on usage with no owner', async () => {
    const res = await handleImages(makeCtx('GET', '/api/images/usage', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('DELETE 403 when the image belongs to another owner', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    const res = await handleImages(makeCtx('DELETE', '/api/images/i1'));
    expect(res.status).toBe(403);
    expect(db.deleteImage).not.toHaveBeenCalled();
  });

  it('DELETE is idempotent: 200 ok when the image is already gone', async () => {
    db.getImage.mockResolvedValue(null);
    const res = await handleImages(makeCtx('DELETE', '/api/images/i9'));
    expect(res.status).toBe(200);
  });

  it('DELETE 200 removes the R2 object + row for the owner', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
    const ctx = makeCtx('DELETE', '/api/images/i1');
    const res = await handleImages(ctx);
    expect(res.status).toBe(200);
    expect(db.deleteImage).toHaveBeenCalledWith(expect.anything(), 'i1');
  });

  it('DELETE removes the row before the bytes, so a D1 failure leaves both in place', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
    db.deleteImage.mockRejectedValue(new Error('D1 down'));
    const images = imagesBinding();
    await expect(handleImages(makeCtx('DELETE', '/api/images/i1', { images }))).rejects.toThrow(
      'D1 down',
    );
    expect(images.delete).not.toHaveBeenCalled();
  });

  it('DELETE answers ok and logs when only the R2 delete fails after the row is gone', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
    const images = imagesBinding();
    images.delete.mockRejectedValue(new Error('R2 down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handleImages(makeCtx('DELETE', '/api/images/i1', { images }));
    expect(res.status).toBe(200);
    expect(db.deleteImage).toHaveBeenCalledWith(expect.anything(), 'i1');
    expect(error.mock.calls[0]![0]).toBe('[images] R2 delete failed after the row was removed');
    error.mockRestore();
  });

  it('byte-read 404 for an unknown image', async () => {
    db.getImage.mockResolvedValue(null);
    const res = await handleImages(makeCtx('GET', '/api/images/i9'));
    expect(res.status).toBe(404);
  });

  it('byte-read 200 for the image owner', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
    const ctx = makeCtx('GET', '/api/images/i1');
    (ctx.env.IMAGES as unknown as ReturnType<typeof imagesBinding>).get.mockResolvedValue({
      body: 'bytes',
      httpMetadata: { contentType: 'image/png' },
    });
    const res = await handleImages(ctx);
    expect(res.status).toBe(200);
  });

  it('byte-read 404 for a non-owner with no document hint', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    const res = await handleImages(makeCtx('GET', '/api/images/i1'));
    expect(res.status).toBe(404);
  });

  it('byte-read 200 for a non-owner via a share-readable document that references the image', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    db.getDocument.mockResolvedValue({ id: 'd1', ownerId: 'someone-else' });
    canReadDocument.mockResolvedValue(true);
    db.documentServesImage.mockResolvedValue(true);
    const ctx = makeCtx('GET', '/api/images/i1?d=d1');
    (ctx.env.IMAGES as unknown as ReturnType<typeof imagesBinding>).get.mockResolvedValue({
      body: 'bytes',
      httpMetadata: { contentType: 'image/png' },
    });
    const res = await handleImages(ctx);
    expect(res.status).toBe(200);
  });

  // docs/specs/009-elements/images.md, "Placement grants": a readable document that places the
  // image but may not serve it (an id pasted where its owner has no tie) answers 404.
  it('404s a readable document that places the image but may not serve it', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'victim' });
    db.getDocument.mockResolvedValue({ id: 'd1', ownerId: 'reader' });
    canReadDocument.mockResolvedValue(true);
    db.documentServesImage.mockResolvedValue(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = makeCtx('GET', '/api/images/i1?d=d1');
    const res = await handleImages(ctx);
    expect(res.status).toBe(404);
    expect(
      (ctx.env.IMAGES as unknown as ReturnType<typeof imagesBinding>).get,
    ).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('[images] not servable by document', {
      documentId: 'd1',
      imageId: 'i1',
    });
    warn.mockRestore();
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor reads images their tab uses.
  it('asks whether the scoped tab, not the whole document, uses the image', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    db.getDocument.mockResolvedValue({ id: 'd1', ownerId: 'someone-else' });
    resolveDocumentGrant.mockResolvedValue({ role: 'view', tabScope: 't2' });
    db.documentServesImage.mockResolvedValue(false);
    const res = await handleImages(makeCtx('GET', '/api/images/i1?d=d1'));
    expect(res.status).toBe(404);
    expect(db.documentServesImage).toHaveBeenCalledWith(expect.anything(), 'd1', 'i1', 't2');
  });

  // docs/specs/013-workspace/workbench-embeds.md: a workbench session reads images through its own document
  // only, never by owning them, so it cannot walk its owner's gallery by id.
  describe('under a workbench session', () => {
    const session = (path: string) =>
      makeTestRouteContext('GET', path, {
        owner: 'owner-1',
        env: { IMAGES: imagesBinding() } as unknown as Env,
        workbench: { documentId: 'd1', ownerId: 'owner-1' } as never,
      });

    it('skips the owner shortcut: no document, no bytes', async () => {
      db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
      const res = await handleImages(session('/api/images/i1'));
      expect(res.status).toBe(404);
    });

    it('refuses any document but the session own', async () => {
      db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
      const res = await handleImages(session('/api/images/i1?d=d2'));
      expect(res.status).toBe(404);
      expect(db.getDocument).not.toHaveBeenCalled();
    });

    it('serves an image its own document serves', async () => {
      db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'owner-1' });
      db.getDocument.mockResolvedValue({ id: 'd1', ownerId: 'owner-1' });
      canReadDocument.mockResolvedValue(true);
      db.documentServesImage.mockResolvedValue(true);
      const ctx = session('/api/images/i1?d=d1');
      (ctx.env.IMAGES as unknown as ReturnType<typeof imagesBinding>).get.mockResolvedValue({
        body: 'bytes',
        httpMetadata: { contentType: 'image/png' },
      });
      const res = await handleImages(ctx);
      expect(res.status).toBe(200);
    });
  });
});

// docs/specs/009-elements/images.md "Size cap": the cap is enforced by the insert itself, so
// uploads racing past the early totals check are refused, and their R2 object removed.
describe('POST /api/images under a per-owner cap', () => {
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4,
  ]);

  function upload(images: ReturnType<typeof imagesBinding>, vars: Record<string, string>) {
    const ctx = makeTestRouteContext('POST', '/api/images', {
      owner: 'owner-1',
      env: { IMAGES: images, ...vars } as unknown as Env,
    });
    const request = new Request('https://api.test/api/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(PNG.byteLength),
        'X-Image-Width': '4',
        'X-Image-Height': '4',
      },
      body: PNG,
    });
    return handleImages({ ...ctx, request });
  }

  it('passes the caps to the insert', async () => {
    db.imageTotalsByOwner.mockResolvedValue({ count: 0, bytes: 0 });
    db.findImageBySha.mockResolvedValue(null);
    db.insertImage.mockResolvedValue({ id: 'new' });
    const res = await upload(imagesBinding(), {
      IMAGE_MAX_PER_OWNER: '3',
      IMAGE_MAX_BYTES_PER_OWNER: '1000',
    });
    expect(res.status).toBe(200);
    expect(db.insertImage.mock.calls[0]![2]).toEqual({ maxImages: 3, maxBytes: 1000 });
  });

  it('403 gallery_full and removes the R2 object when the insert is refused by a racing upload', async () => {
    db.imageTotalsByOwner
      .mockResolvedValueOnce({ count: 2, bytes: 0 })
      .mockResolvedValueOnce({ count: 3, bytes: 0 });
    db.findImageBySha.mockResolvedValue(null);
    db.insertImage.mockResolvedValue(null);
    const images = imagesBinding();
    const res = await upload(images, { IMAGE_MAX_PER_OWNER: '3' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'gallery_full',
      reason: 'count',
      limit: 3,
      current: 3,
    });
    const key = images.put.mock.calls[0]![0];
    expect(images.delete).toHaveBeenCalledWith(key);
  });

  it('answers a racing upload of the same bytes with the winner, as a dedupe, deleting its own bytes', async () => {
    db.imageTotalsByOwner.mockResolvedValue({ count: 0, bytes: 0 });
    db.findImageBySha.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' });
    db.insertImage.mockResolvedValue(null);
    const images = imagesBinding();
    const res = await upload(images, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ image: { id: 'winner' }, deduped: true });
    expect(images.delete).toHaveBeenCalledWith(images.put.mock.calls[0]![0]);
  });

  it('deletes the bytes it wrote when the insert fails outright', async () => {
    db.imageTotalsByOwner.mockResolvedValue({ count: 0, bytes: 0 });
    db.findImageBySha.mockResolvedValue(null);
    db.insertImage.mockRejectedValue(new Error('D1 down'));
    const images = imagesBinding();
    await expect(upload(images, {})).rejects.toThrow('D1 down');
    expect(images.delete).toHaveBeenCalledWith(images.put.mock.calls[0]![0]);
  });

  it('names the byte cap when that is the one the race crossed', async () => {
    db.imageTotalsByOwner
      .mockResolvedValueOnce({ count: 0, bytes: 980 })
      .mockResolvedValueOnce({ count: 1, bytes: 995 });
    db.findImageBySha.mockResolvedValue(null);
    db.insertImage.mockResolvedValue(null);
    const res = await upload(imagesBinding(), { IMAGE_MAX_BYTES_PER_OWNER: '1000' });
    expect(await res.json()).toEqual({
      error: 'gallery_full',
      reason: 'bytes',
      limit: 1000,
      current: 995,
    });
  });
});

// docs/specs/009-elements/images.md "Per-network daily budget" (blueprint 7a, 15, I6): keyed on the
// caller's network, so uploading under many identities buys nothing.
describe('POST /api/images under a network budget', () => {
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3, 4,
  ]);
  const BUDGET = { IMAGE_MAX_PER_NETWORK_DAY: '3', IMAGE_MAX_BYTES_PER_NETWORK_DAY: '1000' };

  function upload(owner: string, vars: Record<string, string>, extra: Record<string, string> = {}) {
    const pending: Promise<unknown>[] = [];
    const ctx = makeTestRouteContext('POST', '/api/images', {
      owner,
      env: { IMAGES: imagesBinding(), ...vars } as unknown as Env,
      waitUntil: (p) => void pending.push(p),
    });
    const request = new Request('https://api.test/api/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(PNG.byteLength),
        'X-Image-Width': '4',
        'X-Image-Height': '4',
        'CF-Connecting-IP': '2001:db8:0:1::7',
        ...extra,
      },
      body: PNG,
    });
    return { res: handleImages({ ...ctx, request }), settled: () => Promise.all(pending) };
  }

  beforeEach(() => {
    db.findImageBySha.mockResolvedValue(null);
    db.insertImage.mockResolvedValue({ id: 'new' });
    db.networkUploadKey.mockResolvedValue('net-hash');
    db.utcDay.mockReturnValue(20_000);
    db.secondsToNextUtcDay.mockReturnValue(3600);
    db.recordNetworkUpload.mockResolvedValue(undefined);
  });

  it('keys the budget on the network, not the owner', async () => {
    db.networkUploadUsage.mockResolvedValue({ images: 0, bytes: 0 });
    await upload('owner-a', BUDGET).res;
    await upload('owner-b', BUDGET).res;
    // Both identities on one /64 resolve to the same network.
    expect(db.networkUploadKey.mock.calls.map((c) => c[1])).toEqual([
      '2001:0db8:0000:0001::/64',
      '2001:0db8:0000:0001::/64',
    ]);
  });

  it('429 upload_limit_reached once the day has its images, whoever uploads', async () => {
    db.networkUploadUsage.mockResolvedValue({ images: 3, bytes: 10 });
    const { res } = upload('a-fresh-identity', BUDGET);
    const r = await res;
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('3600');
    expect(await r.json()).toEqual({
      error: 'upload_limit_reached',
      reason: 'count',
      limit: 3,
      current: 3,
      retryAfter: 3600,
    });
    expect(db.insertImage).not.toHaveBeenCalled();
  });

  it('names the byte budget when the upload would cross it', async () => {
    db.networkUploadUsage.mockResolvedValue({ images: 0, bytes: 995 });
    const r = await upload('owner-1', BUDGET).res;
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ reason: 'bytes', limit: 1000, current: 995 });
  });

  it('records a stored upload against the network', async () => {
    db.networkUploadUsage.mockResolvedValue({ images: 0, bytes: 0 });
    const { res, settled } = upload('owner-1', BUDGET);
    expect((await res).status).toBe(200);
    await settled();
    expect(db.recordNetworkUpload).toHaveBeenCalledWith(
      expect.anything(),
      'net-hash',
      20_000,
      PNG.byteLength,
    );
  });

  it('never counts a dedupe', async () => {
    db.networkUploadUsage.mockResolvedValue({ images: 0, bytes: 0 });
    db.findImageBySha.mockResolvedValue({ id: 'existing' });
    const r = await upload('owner-1', BUDGET).res;
    expect(await r.json()).toMatchObject({ deduped: true });
    expect(db.recordNetworkUpload).not.toHaveBeenCalled();
  });

  it('lets the upload through when the budget cannot be read', async () => {
    db.networkUploadUsage.mockRejectedValue(new Error('d1 down'));
    const r = await upload('owner-1', BUDGET).res;
    expect(r.status).toBe(200);
  });

  it('does no budget work when no budget is set (the self-host default)', async () => {
    const r = await upload('owner-1', {}).res;
    expect(r.status).toBe(200);
    expect(db.networkUploadKey).not.toHaveBeenCalled();
    expect(db.networkUploadUsage).not.toHaveBeenCalled();
  });
});

// docs/specs/009-elements/images.md "Size cap": the X-Image-Sha256 shortcut answers a bare hash with the gallery row,
// so it is only the owner's own editor's; a workbench session or an API token uploads the body.
describe('POST /api/images hash-only dedupe shortcut', () => {
  const SHA = 'a'.repeat(64);
  const post = (opts: { workbench?: boolean; token?: boolean }) => {
    const images = imagesBinding();
    const ctx = makeTestRouteContext('POST', '/api/images', {
      owner: 'owner-1',
      env: { IMAGES: images } as unknown as Env,
      ...(opts.workbench
        ? { workbench: { documentId: 'd1', ownerId: 'owner-1', sessionId: 's1' } as never }
        : {}),
      ...(opts.token ? { token: { id: 'tok-1' } } : {}),
    });
    // A non-zero length with a body that is not an image: the probe never meant to send the file.
    const request = new Request('https://api.test/api/images', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': '1',
        'X-Image-Sha256': SHA,
        'X-Image-Width': '4',
        'X-Image-Height': '4',
      },
      body: new Uint8Array([0]),
    });
    return handleImages({ ...ctx, request });
  };

  beforeEach(() => {
    db.findImageBySha.mockResolvedValue({ id: 'secret', originalName: 'payslip.png' });
  });

  it('answers the owner own editor from the hash alone', async () => {
    const res = await post({});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      image: { id: 'secret', originalName: 'payslip.png' },
      deduped: true,
    });
  });

  it.each([
    ['a workbench session', { workbench: true }],
    ['an API token', { token: true }],
  ])('never answers %s from the hash alone', async (_label, opts) => {
    const res = await post(opts);
    expect(res.status).toBe(415);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    expect(db.findImageBySha).not.toHaveBeenCalled();
  });
});

// A file's own name rides a header, percent-encoded by the editor: a header is Latin-1 only.
describe('originalNameOf', () => {
  it('decodes an encoded name, keeps an older raw one, and caps the length', async () => {
    const { originalNameOf, ORIGINAL_NAME_MAX } = await import('./images');
    const screenshot = 'Screenshot 2026-10-10 at 9.41.02 AM.png';
    expect(originalNameOf(encodeURIComponent(screenshot))).toBe(screenshot);
    expect(originalNameOf(encodeURIComponent('diagram 図 😀.png'))).toBe('diagram 図 😀.png');
    expect(originalNameOf('100% done.png')).toBe('100% done.png');
    expect(originalNameOf(null)).toBeNull();
    expect(Array.from(originalNameOf(encodeURIComponent('😀'.repeat(500)))!)).toHaveLength(
      ORIGINAL_NAME_MAX,
    );
  });
});
