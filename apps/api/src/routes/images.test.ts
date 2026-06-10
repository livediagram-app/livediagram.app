import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Characterisation tests for handleImages' authorisation surface
// (spec/19). Covers: the 503 fallback when R2 is absent (self-host), the
// owner gate on the gallery list / usage / delete, and the byte-read
// access policy (image owner OR a share-readable diagram that references
// the image). Pins behaviour ahead of the requireOwner extraction.

const { db, canReadDiagram } = vi.hoisted(() => ({
  db: {
    deleteImage: vi.fn(),
    diagramReferencesImage: vi.fn(),
    findImageBySha: vi.fn(),
    getDiagram: vi.fn(),
    getImage: vi.fn(),
    imageUsageByOwner: vi.fn(),
    insertImage: vi.fn(),
    listImagesByOwner: vi.fn(),
  },
  canReadDiagram: vi.fn(),
}));
vi.mock('../db', () => db);
vi.mock('../auth/diagram-access', () => ({ canReadDiagram, canEditDiagram: vi.fn() }));

import type { RouteContext } from './context';
import { handleImages } from './images';

function imagesBinding() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

function makeCtx(
  method: string,
  path: string,
  opts: { owner?: string | null; images?: unknown } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const owner = opts.owner === undefined ? 'owner-1' : opts.owner;
  const env = {
    IMAGES: opts.images === undefined ? imagesBinding() : opts.images,
  } as unknown as Env;
  const request = new Request(url, { method, headers: { 'Content-Type': 'application/json' } });
  return {
    request,
    env,
    url,
    segments,
    clerkUserId: null,
    clerkEmail: null,
    resolveOwner: () => owner,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  canReadDiagram.mockReset();
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
    db.getDiagram.mockResolvedValue({ id: 'd1', ownerId: 'someone-else' });
    canReadDiagram.mockResolvedValue(true);
    db.diagramReferencesImage.mockResolvedValue(true);
    const ctx = makeCtx('GET', '/api/images/i1?d=d1');
    (ctx.env.IMAGES as unknown as ReturnType<typeof imagesBinding>).get.mockResolvedValue({
      body: 'bytes',
      httpMetadata: { contentType: 'image/png' },
    });
    const res = await handleImages(ctx);
    expect(res.status).toBe(200);
  });
});
