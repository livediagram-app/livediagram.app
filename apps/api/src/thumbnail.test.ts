import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramDTO, Env } from './types';

// The render-cache reads/writes the snapshot freshness + first-tab body
// through the db layer; mock it so the test pins the cache decision tree
// (fresh → stream R2, stale → render+put+stamp, empty → null) without a
// live D1. renderElementsToSvg stays real — it's pure.
const db = vi.hoisted(() => ({
  getFirstTabData: vi.fn(),
  getThumbRenderedAt: vi.fn(),
  markThumbRendered: vi.fn(),
  thumbnailKey: (id: string) => `thumb/${id}`,
}));
vi.mock('./db', () => db);

import { getDiagramThumbnailSvg } from './thumbnail';

function r2() {
  return { get: vi.fn(), put: vi.fn().mockResolvedValue(undefined), delete: vi.fn() };
}

function diagram(over: Partial<DiagramDTO> = {}): DiagramDTO {
  return {
    id: 'd1',
    ownerId: 'o1',
    name: 'Diagram',
    tabs: [],
    shareable: false,
    shareCode: null,
    folderId: null,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDiagramThumbnailSvg', () => {
  it('returns null without an R2 binding (self-host without storage)', async () => {
    const out = await getDiagramThumbnailSvg({} as Env, diagram());
    expect(out).toBeNull();
    expect(db.getThumbRenderedAt).not.toHaveBeenCalled();
  });

  it('streams the cached object when fresh, without re-rendering', async () => {
    const images = r2();
    images.get.mockResolvedValue({ text: async () => '<svg>cached</svg>' });
    db.getThumbRenderedAt.mockResolvedValue(2000); // >= savedAt 1000 → fresh
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

    expect(out).toBe('<svg>cached</svg>');
    expect(db.getFirstTabData).not.toHaveBeenCalled();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  it('renders, caches, and stamps fresh when stale', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null); // never rendered → stale
    db.getFirstTabData.mockResolvedValue(TAB_DATA);
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

    expect(out).toContain('<svg');
    expect(images.put).toHaveBeenCalledOnce();
    expect(images.put.mock.calls[0]![0]).toBe('thumb/d1');
    expect(db.markThumbRendered).toHaveBeenCalledWith(env, 'd1', expect.any(Number));
  });

  it('re-renders when the freshness stamp is set but the object is gone', async () => {
    const images = r2();
    images.get.mockResolvedValue(null); // evicted despite a fresh stamp
    db.getThumbRenderedAt.mockResolvedValue(5000);
    db.getFirstTabData.mockResolvedValue(TAB_DATA);
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

    expect(out).toContain('<svg');
    expect(images.put).toHaveBeenCalledOnce();
  });

  it('returns null for an empty diagram and never caches it', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getFirstTabData.mockResolvedValue(JSON.stringify({ elements: [] }));
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

    expect(out).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  it('returns null when the diagram has no tabs', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getFirstTabData.mockResolvedValue(null);
    const env = { IMAGES: images } as unknown as Env;

    expect(await getDiagramThumbnailSvg(env, diagram())).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
  });

  it('embeds a referenced image as a base64 data URL in the rendered snapshot', async () => {
    const images = r2();
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'img-1' }],
    });
    db.getThumbRenderedAt.mockResolvedValue(null); // stale → render
    db.getFirstTabData.mockResolvedValue(tabData);
    images.get.mockImplementation(async (key: string) =>
      key === 'img-1'
        ? {
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
            httpMetadata: { contentType: 'image/png' },
          }
        : null,
    );
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

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
    db.getFirstTabData.mockResolvedValue(tabData);
    images.get.mockResolvedValue(null); // image bytes absent
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

    expect(out).toContain('stroke-dasharray="4 4"'); // dashed placeholder
    expect(out).not.toContain('<image');
  });

  it('still returns the SVG when the R2 write fails (no stamp)', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    images.put.mockRejectedValue(new Error('r2 down'));
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getFirstTabData.mockResolvedValue(TAB_DATA);
    const env = { IMAGES: images } as unknown as Env;

    const out = await getDiagramThumbnailSvg(env, diagram());

    expect(out).toContain('<svg');
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });
});
