import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Characterisation tests for handleImages' authorisation surface
// (docs/specs/009-elements/images.md). Covers: the 503 fallback when R2 is absent (self-host), the
// owner gate on the gallery list / usage / delete, and the byte-read
// access policy (image owner OR a share-readable diagram that references
// the image). Pins behaviour ahead of the requireOwner extraction.

const { db, canReadDocument, resolveDocumentGrant } = vi.hoisted(() => ({
  db: {
    deleteImage: vi.fn(),
    documentReferencesImage: vi.fn(),
    findImageBySha: vi.fn(),
    getDocument: vi.fn(),
    getImage: vi.fn(),
    imageTotalsByOwner: vi.fn(),
    imageUsageByOwner: vi.fn(),
    insertImage: vi.fn(),
    listImagesByOwner: vi.fn(),
  },
  canReadDocument: vi.fn(),
  resolveDocumentGrant: vi.fn(),
}));
vi.mock('../db', () => db);
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

  it('byte-read 404 for a non-owner with no diagram hint', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    const res = await handleImages(makeCtx('GET', '/api/images/i1'));
    expect(res.status).toBe(404);
  });

  it('byte-read 200 for a non-owner via a share-readable diagram that references the image', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    db.getDocument.mockResolvedValue({ id: 'd1', ownerId: 'someone-else' });
    canReadDocument.mockResolvedValue(true);
    db.documentReferencesImage.mockResolvedValue(true);
    const ctx = makeCtx('GET', '/api/images/i1?d=d1');
    (ctx.env.IMAGES as unknown as ReturnType<typeof imagesBinding>).get.mockResolvedValue({
      body: 'bytes',
      httpMetadata: { contentType: 'image/png' },
    });
    const res = await handleImages(ctx);
    expect(res.status).toBe(200);
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor reads images their tab uses.
  it('asks whether the scoped tab, not the whole diagram, uses the image', async () => {
    db.getImage.mockResolvedValue({ id: 'i1', ownerId: 'someone-else' });
    db.getDocument.mockResolvedValue({ id: 'd1', ownerId: 'someone-else' });
    resolveDocumentGrant.mockResolvedValue({ role: 'view', tabScope: 't2' });
    db.documentReferencesImage.mockResolvedValue(false);
    const res = await handleImages(makeCtx('GET', '/api/images/i1?d=d1'));
    expect(res.status).toBe(404);
    expect(db.documentReferencesImage).toHaveBeenCalledWith(expect.anything(), 'd1', 'i1', 't2');
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
