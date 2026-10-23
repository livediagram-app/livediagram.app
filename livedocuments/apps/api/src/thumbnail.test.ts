import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PEN_INK, penColourHex } from '@livedocuments/document';
import type { DocumentDTO, Env } from './types';

// The render-cache reads/writes the snapshot freshness + first-tab body
// through the db layer; mock it so the test pins the cache decision tree
// (fresh → stream R2, stale → render+put+stamp, empty → null) without a
// live D1. renderElementsToSvg stays real — it's pure.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  getThumbRenderedAt: vi.fn(),
  markThumbRendered: vi.fn(),
  thumbnailKey: (id: string) => `thumb/${id}`,
  // Placement grants (docs/specs/009-elements/images.md): by default every placed image is servable.
  servableImageIds: vi.fn(async (_env: unknown, _doc: string, ids: string[]) => new Set(ids)),
}));
vi.mock('./db', () => db);
// The images' bytes come from the media service (src/media.ts); here, from the same bucket stub as the
// snapshots, so each test arranges both in one place.
vi.mock('./media', () => ({
  mediaClient: (env: Env) => {
    const images = env.IMAGES;
    if (!images) return null;
    return {
      bytes: async (id: string) => {
        const object = await images.get(id);
        if (!object) return null;
        return {
          owner: '',
          contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
          body: new Response(await object.arrayBuffer()).body,
        };
      },
    };
  },
}));

import { getDocumentTabImageSvg, getDocumentThumbnailSvg } from './thumbnail';

function r2() {
  return { get: vi.fn(), put: vi.fn().mockResolvedValue(undefined), delete: vi.fn() };
}

function liveDoc(over: Partial<DocumentDTO> = {}): DocumentDTO {
  return {
    id: 'd1',
    ownerId: 'o1',
    name: 'Document',
    tabs: [],
    shareable: false,
    shareCode: null,
    folderId: null,
    presentation: null,
    teamId: null,
    source: null,
    savedAt: 1000,
    createdAt: 0,
    ownerName: null,
    ownerColor: null,
    ...over,
  };
}

// A one-shape first tab, in the on-disk `tabs.data` shape (body minus
// id + name — see db/tabs.ts upsertTab).
const TAB_DATA = JSON.stringify({
  elements: [{ id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }],
});

// A first tab as getTabBody returns it.
const stored = (data: string) => ({ id: 't1', data });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDocumentThumbnailSvg', () => {
  it('returns null without an R2 binding (self-host without storage)', async () => {
    const out = await getDocumentThumbnailSvg({} as Env, liveDoc());
    expect(out).toBeNull();
    expect(db.getThumbRenderedAt).not.toHaveBeenCalled();
  });

  it('streams the cached object when fresh, without re-rendering', async () => {
    const images = r2();
    images.get.mockResolvedValue({ text: async () => '<svg>cached</svg>' });
    db.getThumbRenderedAt.mockResolvedValue(2000); // >= savedAt 1000 → fresh
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toBe('<svg>cached</svg>');
    expect(db.getTabBody).not.toHaveBeenCalled();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  it('renders, caches, and stamps fresh when stale', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null); // never rendered → stale
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(images.put).toHaveBeenCalledOnce();
    expect(images.put.mock.calls[0]![0]).toBe('thumb/d1');
    expect(db.markThumbRendered).toHaveBeenCalledWith(env, 'd1', expect.any(Number));
  });

  it('trusts a freshness stamp the caller already read, saving the query', async () => {
    const images = r2();
    images.get.mockResolvedValue({ text: async () => '<svg>cached</svg>' });
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, { ...liveDoc(), thumbRenderedAt: 2000 });

    expect(out).toBe('<svg>cached</svg>');
    expect(db.getThumbRenderedAt).not.toHaveBeenCalled();
  });

  it('hands the cache write to `defer` instead of awaiting it', async () => {
    const images = r2();
    let finishPut!: () => void;
    images.put.mockReturnValue(new Promise<void>((resolve) => (finishPut = resolve)));
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { IMAGES: images } as unknown as Env;
    const deferred: Promise<unknown>[] = [];

    // Resolves while the put is still pending: the response is not held
    // behind the R2 write + D1 stamp.
    const out = await getDocumentThumbnailSvg(
      env,
      { ...liveDoc(), thumbRenderedAt: null },
      { defer: (p) => deferred.push(p) },
    );
    expect(out).toContain('<svg');
    expect(deferred).toHaveLength(1);
    expect(db.markThumbRendered).not.toHaveBeenCalled();

    finishPut();
    await deferred[0];
    expect(db.markThumbRendered).toHaveBeenCalledWith(env, 'd1', expect.any(Number));
  });

  it('re-renders when the freshness stamp is set but the object is gone', async () => {
    const images = r2();
    images.get.mockResolvedValue(null); // evicted despite a fresh stamp
    db.getThumbRenderedAt.mockResolvedValue(5000);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(images.put).toHaveBeenCalledOnce();
  });

  it('returns null for an empty document and never caches it', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] })));
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  it('returns null when the document has no tabs', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(null);
    const env = { IMAGES: images } as unknown as Env;

    expect(await getDocumentThumbnailSvg(env, liveDoc())).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
  });

  it('embeds a referenced image as a base64 data URL in the rendered snapshot', async () => {
    const images = r2();
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'img-1' }],
    });
    db.getThumbRenderedAt.mockResolvedValue(null); // stale → render
    db.getTabBody.mockResolvedValue(stored(tabData));
    images.get.mockImplementation(async (key: string) =>
      key === 'img-1'
        ? {
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
            httpMetadata: { contentType: 'image/png' },
          }
        : null,
    );
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toContain('<image');
    // btoa of bytes [1,2,3,4] is "AQIDBA==".
    expect(out).toContain('data:image/png;base64,AQIDBA==');
    expect(out).not.toContain('stroke-dasharray="4 4"'); // not the placeholder
  });

  it('keeps the placeholder when the referenced image is missing from R2', async () => {
    const images = r2();
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'gone' }],
    });
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(tabData));
    images.get.mockResolvedValue(null); // image bytes absent
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toContain('stroke-dasharray="4 4"'); // dashed placeholder
    expect(out).not.toContain('<image');
  });

  // An id the document may not serve (docs/specs/009-elements/images.md, "Placement grants")
  // is never read from R2 and keeps the placeholder.
  it('keeps the placeholder for an image the document may not serve, without reading it', async () => {
    const images = r2();
    const tabData = JSON.stringify({
      elements: [
        { id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'foreign' },
      ],
    });
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(tabData));
    db.servableImageIds.mockResolvedValueOnce(new Set());
    images.get.mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      httpMetadata: { contentType: 'image/png' },
    });
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(db.servableImageIds).toHaveBeenCalledWith(env, 'd1', ['foreign']);
    expect(images.get).not.toHaveBeenCalledWith('foreign');
    expect(out).toContain('stroke-dasharray="4 4"');
    expect(out).not.toContain('<image');
  });

  it('still returns the SVG when the R2 write fails (no stamp)', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    images.put.mockRejectedValue(new Error('r2 down'));
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });
});

// docs/specs/006-document/document-snapshots.md "Pages tabs": the first page alone, as an export draws it.
describe('a thumbnail of a Pages tab', () => {
  const A4 = { orientation: 'portrait', size: 'a4', kind: 'infographic' };
  const PICTURE = 'b'.repeat(32);
  const ON_FIRST = 'c'.repeat(32);
  const ON_SECOND = 'd'.repeat(32);
  // Two A4 pages side by side (the second starts past the first's 794px width), each with a labelled square and an
  // image; the first page has a picture background.
  const tabData = JSON.stringify({
    pages: [
      {
        id: 'p1',
        ...A4,
        background: { fill: { kind: 'image', imageId: PICTURE, tone: '#336699' } },
      },
      { id: 'p2', ...A4 },
    ],
    elements: [
      {
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: 40,
        y: 40,
        width: 100,
        height: 80,
        label: 'Cover',
      },
      { id: 'ia', type: 'image', x: 40, y: 200, width: 100, height: 80, imageId: ON_FIRST },
      {
        id: 'b',
        type: 'shape',
        shape: 'square',
        x: 2000,
        y: 40,
        width: 100,
        height: 80,
        label: 'Later',
      },
      { id: 'ib', type: 'image', x: 2000, y: 200, width: 100, height: 80, imageId: ON_SECOND },
    ],
  });

  function setup() {
    const images = r2();
    images.get.mockImplementation(async (key: string) =>
      key.startsWith('thumb')
        ? null
        : {
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
            httpMetadata: { contentType: 'image/png' },
          },
    );
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(tabData));
    return { images, env: { IMAGES: images } as unknown as Env };
  }

  it('draws the first page alone, at its own size', async () => {
    const { env } = setup();
    const out = (await getDocumentThumbnailSvg(env, liveDoc()))!;
    expect(out).toContain('Cover');
    expect(out).not.toContain('Later');
    // The page's own frame, not the bounds of everything on the canvas, nor the grid of every page.
    expect(out).toMatch(/^<svg [^>]*width="794" height="1123"/);
  });

  it("reads only the first page's images, its picture background among them", async () => {
    const { env, images } = setup();
    await getDocumentThumbnailSvg(env, liveDoc());
    const read = images.get.mock.calls.map(([key]) => key as string);
    expect(read).toEqual(expect.arrayContaining([ON_FIRST, PICTURE]));
    expect(read).not.toContain(ON_SECOND);
  });

  it('skips a malformed stored page rather than failing the thumbnail', async () => {
    const { env } = setup();
    const parsed = JSON.parse(tabData) as { pages: unknown[] };
    db.getTabBody.mockResolvedValue(
      stored(JSON.stringify({ ...parsed, pages: [null, 5, ...parsed.pages] })),
    );
    const out = (await getDocumentThumbnailSvg(env, liveDoc()))!;
    expect(out).toContain('Cover');
    expect(out).not.toContain('Later');
  });

  it('draws the first page for a tab image too', async () => {
    const { env } = setup();
    const tabImage = (await getDocumentTabImageSvg(env, liveDoc(), 't1'))!;
    expect(tabImage).toContain('Cover');
    expect(tabImage).not.toContain('Later');
  });
});

// Stock colours are first-class (docs/specs/008-canvas/canvas-and-palette.md "Colours"): a thumbnail
// draws a colour stored by name in its version for the page, on any tab.
describe('a thumbnail of named stock colours', () => {
  it('draws Blue and Ink by name in the light page version', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null);
    const shape = { type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 };
    db.getTabBody.mockResolvedValue(
      stored(
        JSON.stringify({
          elements: [
            { ...shape, id: 'e1', penColour: 'blue' },
            { ...shape, id: 'e2', x: 200, penColour: 'ink' },
          ],
        }),
      ),
    );
    const out = await getDocumentThumbnailSvg({ IMAGES: images } as unknown as Env, liveDoc());
    expect(out).toContain(penColourHex('blue', 'light'));
    expect(out).toContain(PEN_INK.light);
  });
});
