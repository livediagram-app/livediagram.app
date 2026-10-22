import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Share-link previews (docs/specs/013-workspace/share-link-previews.md): the card and the share card answer exactly
// where the live image answers, and the share card is cached per save.

vi.mock('../db', () => ({
  getShareLink: vi.fn(),
  getDocumentThumbMeta: vi.fn(),
  getDocumentSharePassword: vi.fn(),
  shareCardKey: (id: string) => `og/${id}`,
}));
vi.mock('../document-image', () => ({ documentImageSvg: vi.fn() }));
vi.mock('../share-card-png', () => ({ shareCardPng: vi.fn() }));

import { getDocumentSharePassword, getDocumentThumbMeta, getShareLink } from '../db';
import { documentImageSvg } from '../document-image';
import { shareCardPng } from '../share-card-png';
import { makeTestRouteContext } from './test-route-context';
import {
  BRAND_CARD_REDIRECT_CACHE,
  SHARE_CARD_CACHE,
  handleSharePreview,
  isSharePreviewPath,
} from './share-preview';

const SAVED_AT = 1_000;
const PNG = new Uint8Array([137, 80, 78, 71]);

type Link = NonNullable<Awaited<ReturnType<typeof getShareLink>>>;
const link = (over: Partial<Link> = {}) =>
  ({
    code: 'CODE1234',
    documentId: 'd1',
    role: 'view',
    tabId: null,
    ...over,
  }) as Link;
const doc = {
  id: 'd1',
  ownerId: 'o',
  teamId: null,
  name: 'Payments flow',
  savedAt: SAVED_AT,
  thumbRenderedAt: null,
};

type Stored = { body: ReadableStream; customMetadata?: Record<string, string> };
function bucket(stored: Stored | null = null) {
  return {
    get: vi.fn(async () => stored),
    put: vi.fn(async () => ({})),
  };
}

function call(path: string, opts: { images?: ReturnType<typeof bucket>; method?: string } = {}) {
  const waits: Promise<unknown>[] = [];
  const env = (opts.images ? { IMAGES: opts.images } : {}) as unknown as Env;
  const ctx = makeTestRouteContext(opts.method ?? 'GET', `/api${path}`, {
    env,
    waitUntil: (p) => void waits.push(p),
  });
  return { result: handleSharePreview(ctx), waits };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(getShareLink).mockResolvedValue(link());
  vi.mocked(getDocumentThumbMeta).mockResolvedValue(doc);
  vi.mocked(getDocumentSharePassword).mockResolvedValue(null);
  vi.mocked(documentImageSvg).mockResolvedValue('<svg width="10" height="10"/>');
  vi.mocked(shareCardPng).mockResolvedValue(PNG);
});

describe('isSharePreviewPath: the rate limiter keeps previews apart', () => {
  it('is the card and the share card only', () => {
    expect(isSharePreviewPath(['api', 'share', 'C', 'card'])).toBe(true);
    expect(isSharePreviewPath(['api', 'share', 'C', 'image.png'])).toBe(true);
    expect(isSharePreviewPath(['api', 'share', 'C'])).toBe(false);
    expect(isSharePreviewPath(['api', 'share', 'C', 'image.svg'])).toBe(false);
    expect(isSharePreviewPath(['api', 'forms', 'C', 'card'])).toBe(false);
  });
});

describe('handleSharePreview: the paths it owns', () => {
  it('leaves every other share path to the share router', async () => {
    expect(await call('/share/CODE1234').result).toBeNull();
    expect(await call('/share/CODE1234/image.svg').result).toBeNull();
    expect(await call('/share/CODE1234/card', { method: 'POST' }).result).toBeNull();
    expect(await call('/share/CODE1234/card/x').result).toBeNull();
    expect(getShareLink).not.toHaveBeenCalled();
  });
});

describe('GET /api/share/<code>/card', () => {
  it("answers the document's name for a working link", async () => {
    const res = (await call('/share/CODE1234/card').result)!;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Payments flow' });
    expect(getShareLink).toHaveBeenCalledWith(expect.anything(), 'CODE1234');
    expect(getDocumentThumbMeta).toHaveBeenCalledWith(expect.anything(), 'd1');
  });

  it('is 404 for an unknown, revoked or expired code', async () => {
    vi.mocked(getShareLink).mockResolvedValue(null);
    expect((await call('/share/NOPE/card').result)!.status).toBe(404);
  });

  it('is 404 for a trashed or missing document', async () => {
    vi.mocked(getDocumentThumbMeta).mockResolvedValue(null);
    expect((await call('/share/CODE1234/card').result)!.status).toBe(404);
  });

  it('never names a document with a share password', async () => {
    vi.mocked(getDocumentSharePassword).mockResolvedValue('hash');
    const res = (await call('/share/CODE1234/card').result)!;
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('Payments');
  });
});

describe('GET /api/share/<code>/image.png', () => {
  it('draws the card, serves it as a PNG and stores it stamped with when it was drawn', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const images = bucket();
    const { result, waits } = call('/share/CODE1234/image.png', { images });
    const res = (await result)!;
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe(SHARE_CARD_CACHE);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    expect(documentImageSvg).toHaveBeenCalledWith(
      expect.anything(),
      doc,
      null,
      expect.objectContaining({ defer: expect.any(Function) }),
    );
    await Promise.all(waits);
    expect(images.put).toHaveBeenCalledWith('og/d1', PNG, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: { renderedAt: '5000' },
    });
  });

  it('serves a card drawn since the last save without drawing it again', async () => {
    const body = new Response(PNG).body!;
    const images = bucket({ body, customMetadata: { renderedAt: String(SAVED_AT) } });
    const res = (await call('/share/CODE1234/image.png', { images }).result)!;
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    expect(documentImageSvg).not.toHaveBeenCalled();
    expect(images.put).not.toHaveBeenCalled();
  });

  it('draws again once the document has been saved since the stored card', async () => {
    const images = bucket({ body: new Response(PNG).body!, customMetadata: { renderedAt: '999' } });
    const { result, waits } = call('/share/CODE1234/image.png', { images });
    expect((await result)!.status).toBe(200);
    await Promise.all(waits);
    expect(documentImageSvg).toHaveBeenCalledTimes(1);
    expect(images.put).toHaveBeenCalledTimes(1);
  });

  it('treats a stored card with no stamp as stale', async () => {
    const images = bucket({ body: new Response(PNG).body! });
    expect((await call('/share/CODE1234/image.png', { images }).result)!.status).toBe(200);
    expect(documentImageSvg).toHaveBeenCalledTimes(1);
  });

  it("draws a tab-scoped link's own tab per request and stores nothing", async () => {
    vi.mocked(getShareLink).mockResolvedValue(link({ tabId: 't2' }));
    const images = bucket();
    const { result, waits } = call('/share/CODE1234/image.png', { images });
    expect((await result)!.status).toBe(200);
    await Promise.all(waits);
    expect(documentImageSvg).toHaveBeenCalledWith(expect.anything(), doc, 't2', expect.anything());
    expect(images.get).not.toHaveBeenCalled();
    expect(images.put).not.toHaveBeenCalled();
  });

  it('is 404 wherever the card is: a dead code, a password', async () => {
    vi.mocked(getDocumentSharePassword).mockResolvedValue('hash');
    expect((await call('/share/CODE1234/image.png').result)!.status).toBe(404);
    vi.mocked(getShareLink).mockResolvedValue(null);
    expect((await call('/share/CODE1234/image.png').result)!.status).toBe(404);
    expect(documentImageSvg).not.toHaveBeenCalled();
  });

  it('sends the brand card when there is nothing to draw', async () => {
    vi.mocked(documentImageSvg).mockResolvedValue(null);
    const res = (await call('/share/CODE1234/image.png').result)!;
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://api.test/opengraph-image');
    expect(res.headers.get('Cache-Control')).toBe(BRAND_CARD_REDIRECT_CACHE);
  });

  it('sends the brand card, and says so, when the drawing will not rasterise', async () => {
    vi.mocked(shareCardPng).mockRejectedValue(new Error('resvg: bad svg'));
    expect((await call('/share/CODE1234/image.png').result)!.status).toBe(302);
    expect(console.warn).toHaveBeenCalledWith('[share-card] render failed', {
      documentId: 'd1',
      error: 'Error: resvg: bad svg',
    });
    vi.mocked(shareCardPng).mockResolvedValue(null);
    expect((await call('/share/CODE1234/image.png').result)!.status).toBe(302);
    expect(console.warn).toHaveBeenCalledWith('[share-card] drawing has no sized root', {
      documentId: 'd1',
    });
  });

  it('still serves the card when storing it fails', async () => {
    const images = bucket();
    images.put.mockRejectedValue(new Error('r2 down'));
    const { result, waits } = call('/share/CODE1234/image.png', { images });
    expect((await result)!.status).toBe(200);
    await Promise.all(waits);
    expect(console.warn).toHaveBeenCalledWith('[share-card] cache write failed', {
      documentId: 'd1',
      error: 'Error: r2 down',
    });
  });

  it('draws without storing on a deploy with no image store', async () => {
    const res = (await call('/share/CODE1234/image.png').result)!;
    expect(res.status).toBe(200);
  });
});
