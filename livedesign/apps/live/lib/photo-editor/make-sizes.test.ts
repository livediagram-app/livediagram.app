import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRaster, TiledRaster, type PixelLayer } from '@livedesign/photo-engine';
import {
  CUSTOM_SIZE_DEFAULT,
  makeSizes,
  PHOTO_SIZE_FORMATS,
  sizesRoom,
  sizeTargets,
  sizeTicks,
  type MakeSizesDeps,
} from './make-sizes';
import { harness, photoOf, pixelLayer, solid } from './photo-test-utils';

// docs/specs/031-photo/photo-pages.md "Making sizes".
describe('the formats', () => {
  it('are the eight social sizes, each its platform’s upload size', () => {
    expect(PHOTO_SIZE_FORMATS.map((f) => `${f.name} ${f.width}x${f.height}`)).toEqual([
      'Instagram Post 1080x1350',
      'Instagram Story 1080x1920',
      'LinkedIn Post 1200x627',
      'LinkedIn Banner 1584x396',
      'X Post 1600x900',
      'X Header 1500x500',
      'Facebook Cover 851x315',
      'YouTube Thumbnail 1280x720',
    ]);
  });

  it('are the ticked ones in the dialog’s order, Custom last at its own size', () => {
    const t = sizeTargets(new Set(['custom', 'x-post', 'instagram-post']), {
      width: 300,
      height: 200,
    });
    expect(t.map((f) => [f.name, f.width, f.height])).toEqual([
      ['Instagram Post', 1080, 1350],
      ['X Post', 1600, 900],
      ['Custom', 300, 200],
    ]);
  });

  it('fit in the room ten photo pages leave', () => {
    expect(sizesRoom(1)).toBe(9);
    expect(sizesRoom(10)).toBe(0);
    expect(sizesRoom(12)).toBe(0);
  });
});

describe('the ticks this browser remembers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('are none the first time, and come back as they were kept', () => {
    const kept = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => kept.set(k, v),
    });
    expect(sizeTicks.get()).toEqual({ ticked: [], custom: CUSTOM_SIZE_DEFAULT });
    sizeTicks.set({ ticked: ['x-post', 'custom'], custom: { width: 640, height: 480 } });
    expect(sizeTicks.get()).toEqual({
      ticked: ['x-post', 'custom'],
      custom: { width: 640, height: 480 },
    });
    // Unknown ids and bad sides are dropped.
    kept.set(
      'livedesign:photo-make-sizes',
      JSON.stringify({ ticked: ['x-post', 'myspace'], custom: { width: -1, height: 2.5 } }),
    );
    expect(sizeTicks.get()).toEqual({ ticked: ['x-post'], custom: CUSTOM_SIZE_DEFAULT });
    kept.set('livedesign:photo-make-sizes', JSON.stringify({ ticked: 'x-post' }));
    expect(sizeTicks.get().ticked).toEqual([]);
  });

  it('survive a store that is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(sizeTicks.get()).toEqual({ ticked: [], custom: CUSTOM_SIZE_DEFAULT });
    expect(() => sizeTicks.set({ ticked: [], custom: CUSTOM_SIZE_DEFAULT })).not.toThrow();
  });
});

describe('making the sizes', () => {
  /** A 4 x 2 photo, red on the left half and green on the right, with an old preview. */
  function source() {
    const r = solid(4, 2, [255, 0, 0, 255]);
    for (const i of [2, 3, 6, 7]) r.data.set([0, 255, 0, 255], i * 4);
    const h = harness({ ...photoOf(4, 2, [pixelLayer('a')]), preview: 'old' });
    // Committed, as a photo in focus is: its tiles stored by blob id, where each size reads them.
    h.s.replacePixels('a', 'layer', TiledRaster.fromRaster(r));
    h.s.commitPixels('Open Picture', [{ layerId: 'a', target: 'layer' }]);
    return h;
  }

  function deps(over: Partial<MakeSizesDeps> = {}) {
    const h = source();
    let n = 0;
    const enqueue = vi.fn<MakeSizesDeps['enqueue']>();
    const put = vi.spyOn(h.store, 'put');
    const d: MakeSizesDeps = {
      tabId: 't',
      store: h.store,
      enqueue,
      newId: () => `new-${++n}`,
      cancelled: () => false,
      previewRaster: async (p) => createRaster(p.width, p.height),
      encodePreview: async () => ({ id: 'prev', type: 'image/webp', bytes: new Uint8Array([1]) }),
      progress: vi.fn(),
      ...over,
    };
    return { h, d, enqueue, put };
  }

  it('copies the photo into each format, filled and cropped about the centre, its preview made', async () => {
    const { h, d, enqueue, put } = deps();
    const made = await makeSizes(
      h.s,
      [
        { id: 'custom', name: 'Square', width: 2, height: 2 },
        { id: 'custom', name: 'Wide', width: 8, height: 2 },
      ],
      d,
    );
    expect(made?.map((m) => [m.id, m.name, m.photo.width, m.photo.height])).toEqual([
      ['new-1', 'Square', 2, 2],
      ['new-2', 'Wide', 8, 2],
    ]);
    // 4 x 2 into 2 x 2: scale 1, a column cut off each side, kept past the edges.
    expect((made![0]!.photo.layers[0] as PixelLayer).offset).toEqual({ x: -1, y: 0 });
    // 4 x 2 into 8 x 2: scale 2, a row cut off above and below.
    expect((made![1]!.photo.layers[0] as PixelLayer).offset).toEqual({ x: 0, y: -1 });
    expect(made!.every((m) => m.photo.preview === 'prev')).toBe(true);
    expect(Object.keys((made![0]!.photo.layers[0] as PixelLayer).pixels.tiles)).toEqual(['0.0']);
    // Tiles and previews go to the upload queue; the preview's pixels to the store.
    expect(enqueue.mock.calls.some(([, e]) => e[0]?.id === 'prev')).toBe(true);
    expect(enqueue.mock.calls.some(([, e]) => e[0]?.type === 'image/png')).toBe(true);
    expect(put).toHaveBeenCalledWith('prev', expect.any(Uint8ClampedArray), expect.any(Blob));
    expect(d.progress).toHaveBeenLastCalledWith(2);
    // The source photo is left as it was.
    expect([h.s.photo.width, h.s.photo.height, h.s.photo.preview]).toEqual([4, 2, 'old']);
  });

  it('never carries the source’s preview when its own could not be made', async () => {
    const { h, d } = deps({ previewRaster: async () => null });
    const made = await makeSizes(h.s, [{ id: 'x-post', name: 'X', width: 2, height: 2 }], d);
    expect(made![0]!.photo).not.toHaveProperty('preview');
    const { h: h2, d: d2 } = deps({ encodePreview: async () => null });
    const again = await makeSizes(h2.s, [{ id: 'x-post', name: 'X', width: 2, height: 2 }], d2);
    expect(again![0]!.photo).not.toHaveProperty('preview');
  });

  it('stops, making nothing, when the dialog closes or a size is refused', async () => {
    let closed = false;
    const { h, d } = deps({
      progress: () => {
        closed = true;
      },
      cancelled: () => closed,
    });
    const sizes = [
      { id: 'custom' as const, name: 'A', width: 2, height: 2 },
      { id: 'custom' as const, name: 'B', width: 3, height: 3 },
    ];
    expect(await makeSizes(h.s, sizes, d)).toBeNull();
    // Closed after the last size, before the pages are added.
    const { h: h2, d: d2 } = deps({
      progress: () => {
        closed = true;
      },
      cancelled: () => closed,
    });
    closed = false;
    expect(await makeSizes(h2.s, [sizes[0]!], d2)).toBeNull();
    const { h: h3, d: d3 } = deps();
    expect(
      await makeSizes(h3.s, [{ id: 'custom', name: 'Z', width: 0, height: 2 }], d3),
    ).toBeNull();
  });
});
