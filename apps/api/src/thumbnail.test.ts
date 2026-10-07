import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PEN_INK, penColourHex } from '@livediagram/document';
import type { DocumentDTO, Env } from './types';

// The render-cache reads/writes the snapshot freshness + first-tab body
// through the db layer; mock it so the test pins the cache decision tree
// (fresh → stream R2, stale → render+put+stamp, empty → null) without a
// live D1. renderElementsToSvg stays real — it's pure.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  stampTabElementCount: vi.fn(),
  getThumbRenderedAt: vi.fn(),
  markThumbRendered: vi.fn(),
  thumbnailKey: (id: string) => `thumb/${id}`,
  communityThumbnailKey: (id: string) => `thumb-community/${id}`,
  // Placement grants (docs/specs/009-elements/images.md): by default every placed image is servable.
  servableImageIds: vi.fn(async (_env: unknown, _doc: string, ids: string[]) => new Set(ids)),
}));
vi.mock('./db', () => db);

import {
  getCommunityThumbnailSvg,
  getDocumentTabImageSvg,
  getDocumentThumbnailSvg,
} from './thumbnail';

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
    // No recorded creation intent (docs/specs/013-workspace/default-folders.md).
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    ...over,
  };
}

// A one-shape first tab, in the on-disk `tabs.data` shape (body minus
// id + name — see db/tabs.ts upsertTab).
const TAB_DATA = JSON.stringify({
  elements: [{ id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }],
});

// A first tab as getTabBody returns it; its count is known unless the test says otherwise.
const stored = (data: string, elementCount: number | null = 1) => ({
  id: 't1',
  data,
  elementCount,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.stampTabElementCount.mockResolvedValue(undefined);
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
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDocumentThumbnailSvg(env, liveDoc());

    expect(out).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  // The lazy backfill (migration 0059): a tab stored before the count existed gets it from this parse,
  // so an old empty document is asked for at most once.
  it('records an unknown count from the body it parsed, empty or drawn', async () => {
    const env = { IMAGES: r2() } as unknown as Env;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    expect(await getDocumentThumbnailSvg(env, liveDoc())).toBeNull();
    expect(db.stampTabElementCount).toHaveBeenCalledWith(env, 't1', 0);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA, null));
    expect(await getDocumentThumbnailSvg(env, liveDoc())).toContain('<svg');
    expect(db.stampTabElementCount).toHaveBeenLastCalledWith(env, 't1', 1);
  });

  it('writes nothing for a count already known, or a body it cannot count', async () => {
    const env = { IMAGES: r2() } as unknown as Env;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    await getDocumentThumbnailSvg(env, liveDoc());
    db.getTabBody.mockResolvedValue(stored('not json', null));
    expect(await getDocumentThumbnailSvg(env, liveDoc())).toBeNull();
    expect(db.stampTabElementCount).not.toHaveBeenCalled();
  });

  it('hands the count stamp to `defer`, and a failed stamp never fails the read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = { IMAGES: r2() } as unknown as Env;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    db.stampTabElementCount.mockRejectedValue(new Error('d1 busy'));
    const deferred: Promise<unknown>[] = [];
    expect(
      await getDocumentThumbnailSvg(env, liveDoc(), { defer: (p) => deferred.push(p) }),
    ).toBeNull();
    expect(deferred).toHaveLength(1);
    await deferred[0];
    expect(warn).toHaveBeenCalledWith(
      '[thumbnail] count stamp failed',
      expect.objectContaining({ tabId: 't1' }),
    );
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

// Retired schemes (docs/specs/011-theme/retired-schemes.md): the thumbnail parses `tabs.data` itself,
// so it runs the same stored-tab migration as every other read.
describe('a thumbnail of a Charcoal tab', () => {
  it('renders the migrated tab, not the colours Charcoal baked', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(
      stored(
        JSON.stringify({
          theme: 'charcoal',
          backgroundColor: '#2b2b33',
          patternColor: '#636373',
          elements: [
            {
              id: 'e1',
              type: 'shape',
              shape: 'square',
              x: 0,
              y: 0,
              width: 100,
              height: 80,
              fillColor: '#2c2c33',
            },
          ],
        }),
      ),
    );
    const out = await getDocumentThumbnailSvg({ IMAGES: images } as unknown as Env, liveDoc());
    expect(out).not.toContain('#2c2c33');
    expect(out).toContain('#0d121a');
  });
});

// Stock colours are first-class (docs/specs/007-editor/editor-modes.md "One look"): a thumbnail
// draws a colour stored by name in its version for the page, on any tab, whatever mode drew it.
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
        2,
      ),
    );
    const out = await getDocumentThumbnailSvg({ IMAGES: images } as unknown as Env, liveDoc());
    expect(out).toContain(penColourHex('blue', 'light'));
    expect(out).toContain(PEN_INK.light);
  });
});

// docs/specs/025-community/community.md "Viewing a post's document": the public card image is drawn from the redacted
// tab, so a comment thread and its people never reach it, and it never reuses the owner's snapshot.
describe('the Community snapshot', () => {
  const COMMENTED = JSON.stringify({
    elements: [
      {
        id: 'c1',
        type: 'shape',
        shape: 'comment-pin',
        x: 0,
        y: 0,
        width: 260,
        height: 200,
        commentThread: {
          comments: [
            {
              id: 'm1',
              text: 'Secret launch plan',
              authorId: 'user_jane',
              authorName: 'Jane Doe',
              authorColor: '#0ea5e9',
              createdAt: 1,
            },
          ],
        },
      },
      {
        id: 'e1',
        type: 'shape',
        shape: 'square',
        x: 300,
        y: 0,
        width: 100,
        height: 80,
        label: 'Public box',
      },
    ],
  });

  it("draws without the conversation the owner's snapshot shows", async () => {
    db.getTabBody.mockResolvedValue(stored(COMMENTED, 2));
    db.getThumbRenderedAt.mockResolvedValue(null);
    const owner = await getDocumentThumbnailSvg({ IMAGES: r2() } as unknown as Env, liveDoc());
    expect(owner).toContain('Secret launch plan');

    const images = r2();
    images.get.mockResolvedValue(null);
    const community = await getCommunityThumbnailSvg(
      { IMAGES: images } as unknown as Env,
      liveDoc(),
    );
    // The rest of the board still draws (labels wrap, so one word of it).
    expect(community).toContain('Public');
    expect(community).not.toContain('Secret launch plan');
    expect(community).not.toContain('Jane Doe');
    // Cached under its own key, stamped with when it was drawn.
    expect(images.put).toHaveBeenCalledWith(
      'thumb-community/d1',
      community,
      expect.objectContaining({ customMetadata: { renderedAt: expect.any(String) } }),
    );
    expect(images.get).not.toHaveBeenCalledWith('thumb/d1');
  });

  it('serves its own cached copy while fresh, and redraws once the document is saved again', async () => {
    const images = r2();
    images.get.mockResolvedValue({
      text: async () => '<svg>community cached</svg>',
      customMetadata: { renderedAt: '1500' },
    });
    const env = { IMAGES: images } as unknown as Env;
    expect(await getCommunityThumbnailSvg(env, liveDoc({ savedAt: 1000 }))).toBe(
      '<svg>community cached</svg>',
    );
    expect(db.getTabBody).not.toHaveBeenCalled();

    db.getTabBody.mockResolvedValue(stored(COMMENTED, 2));
    const redrawn = await getCommunityThumbnailSvg(env, liveDoc({ savedAt: 2000 }));
    expect(redrawn).not.toBe('<svg>community cached</svg>');
    expect(redrawn).not.toContain('Secret launch plan');
  });

  it('redacts a single tab the same way, and draws nothing without storage', async () => {
    db.getTabBody.mockResolvedValue(stored(COMMENTED, 2));
    const env = { IMAGES: r2() } as unknown as Env;
    expect(await getDocumentTabImageSvg(env, liveDoc(), 't1', true)).not.toContain(
      'Secret launch plan',
    );
    expect(await getDocumentTabImageSvg(env, liveDoc(), 't1')).toContain('Secret launch plan');
    expect(await getCommunityThumbnailSvg({} as Env, liveDoc())).toBeNull();
  });
});
