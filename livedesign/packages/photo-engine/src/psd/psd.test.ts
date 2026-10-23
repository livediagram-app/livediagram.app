import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compositeAll, type PixelsLookup } from '../composite/composite';
import { encodePngStream } from '../encode/png-stream';
import type { Photo } from '../model/types';
import { createRaster, pixelAt, setPixel, solidRaster } from '../raster/raster';
import { TiledRaster } from '../raster/tiles';
import { blendFromKey, BLEND_KEYS } from './blend-keys';
import { photoFromPsd, psdFromPhoto, tilesFor } from './convert';
import { PsdError, type PsdDesign } from './model';
import { readPsd } from './read';
import { packBits, unpackBits } from './rle';
import { writePsd } from './write';

describe('PackBits', () => {
  it('round-trips runs, literals and edge lengths', () => {
    const rows = [
      new Uint8Array([]),
      new Uint8Array([7]),
      new Uint8Array([1, 1]),
      new Uint8Array(300).fill(9),
      Uint8Array.from({ length: 500 }, (_, i) => (i * 37) % 256),
      Uint8Array.from({ length: 200 }, (_, i) => (i % 10 < 5 ? 3 : i % 256)),
    ];
    for (const row of rows) {
      const packed = packBits(row);
      expect([...unpackBits(packed, 0, row.length, packed.length).bytes]).toEqual([...row]);
    }
    expect(packBits(new Uint8Array(300).fill(9)).length).toBeLessThan(10);
    // A -128 header is skipped.
    expect([...unpackBits(new Uint8Array([128, 0, 5]), 0, 1, 3).bytes]).toEqual([5]);
  });
});

function doc(): PsdDesign {
  const bg = solidRaster(8, 6, [10, 20, 30, 255]);
  const sticker = createRaster(3, 2);
  setPixel(sticker, 0, 0, [255, 0, 0, 255]);
  setPixel(sticker, 2, 1, [0, 255, 0, 128]);
  const maskData = new Uint8Array(4 * 3).fill(255);
  maskData[0] = 0;
  return {
    width: 8,
    height: 6,
    composite: solidRaster(8, 6, [1, 2, 3, 255]),
    children: [
      {
        kind: 'layer',
        name: 'Background',
        raster: bg,
        x: 0,
        y: 0,
        opacity: 1,
        blend: 'normal',
        visible: true,
        clip: false,
        lockAlpha: false,
      },
      {
        kind: 'group',
        name: 'Stickers ✨',
        opacity: 0.5,
        blend: 'pass-through',
        visible: true,
        collapsed: true,
        children: [
          {
            kind: 'layer',
            name: 'Sticker',
            raster: sticker,
            x: 2,
            y: 1,
            opacity: 0.8,
            blend: 'multiply',
            visible: false,
            clip: true,
            lockAlpha: true,
            mask: { data: maskData, x: 2, y: 1, width: 4, height: 3, outside: 0, enabled: false },
          },
        ],
      },
    ],
  };
}

describe('PSD write and read', () => {
  it('round-trips layers, groups, names, settings and masks', () => {
    const back = readPsd(writePsd(doc()));
    expect(back.width).toBe(8);
    expect(back.height).toBe(6);
    expect(back.children).toHaveLength(2);
    const [bg, group] = back.children;
    expect(bg).toMatchObject({ kind: 'layer', name: 'Background', x: 0, y: 0, visible: true });
    expect(group).toMatchObject({
      kind: 'group',
      name: 'Stickers ✨',
      blend: 'pass-through',
      collapsed: true,
    });
    if (group?.kind !== 'group') throw new Error('group');
    expect(group.opacity).toBeCloseTo(0.5, 1);
    const s = group.children[0]!;
    if (s.kind !== 'layer') throw new Error('layer');
    expect(s).toMatchObject({
      name: 'Sticker',
      x: 2,
      y: 1,
      blend: 'multiply',
      visible: false,
      clip: true,
      lockAlpha: true,
    });
    expect(pixelAt(s.raster, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(s.raster, 2, 1)).toEqual([0, 255, 0, 128]);
    expect(s.mask).toMatchObject({ x: 2, y: 1, width: 4, height: 3, outside: 0, enabled: false });
    expect(s.mask!.data[0]).toBe(0);
    expect(pixelAt(back.composite!, 4, 4)).toEqual([1, 2, 3, 255]);
  });

  it('reads a flattened file as its merged picture', () => {
    const flat = readPsd(
      writePsd({ width: 3, height: 2, children: [], composite: solidRaster(3, 2, [9, 8, 7, 255]) }),
    );
    expect(flat.children).toEqual([]);
    expect(pixelAt(flat.composite!, 1, 1)).toEqual([9, 8, 7, 255]);
    const { photo, pixels } = photoFromPsd(flat);
    expect(photo.layers).toHaveLength(1);
    expect(photo.layers[0]!.name).toBe('Background');
    expect(pixels.layers.get(photo.layers[0]!.id)!.sample(1, 1, 0)).toBe(9);
    const none = readPsd(writePsd({ width: 2, height: 2, children: [] }));
    expect(pixelAt(none.composite!, 0, 0)).toEqual([255, 255, 255, 0]);
  });

  it('refuses what it cannot open, saying why', () => {
    const reason = (b: Uint8Array) => {
      try {
        readPsd(b);
      } catch (e) {
        return (e as PsdError).reason;
      }
      return 'ok';
    };
    expect(reason(new Uint8Array(40))).toBe('not-psd');
    const ok = writePsd(doc());
    const psb = ok.slice();
    psb[5] = 2;
    expect(reason(psb)).toBe('psb');
    const v3 = ok.slice();
    v3[5] = 3;
    expect(reason(v3)).toBe('corrupt');
    const deep = ok.slice();
    deep[23] = 16;
    expect(reason(deep)).toBe('depth');
    const cmyk = ok.slice();
    cmyk[25] = 4;
    expect(reason(cmyk)).toBe('mode');
    const lab = ok.slice();
    lab[25] = 9;
    expect(reason(lab)).toBe('mode');
    expect(reason(ok.slice(0, 60))).toBe('corrupt');
    expect(() => readPsd(ok, { maxSide: 4 })).toThrow(PsdError);
  });

  it('maps every blend mode both ways', () => {
    for (const [mode, key] of Object.entries(BLEND_KEYS)) expect(blendFromKey(key)).toBe(mode);
    expect(blendFromKey('????')).toBe('normal');
  });
});

describe('PSD and photos', () => {
  it('opens a PSD as a photo with its settings and pixels', () => {
    const { photo, pixels } = photoFromPsd(readPsd(writePsd(doc())));
    expect(photo.layers.map((l) => l.layerKind)).toEqual(['pixel', 'pixel', 'group']);
    const [bg, sticker, group] = photo.layers;
    expect(sticker).toMatchObject({
      parent: group!.id,
      blend: 'multiply',
      visible: false,
      clip: true,
      offset: { x: 2, y: 1 },
      locks: { transparency: true },
    });
    expect(sticker!.mask).toEqual({ pixels: { tiles: {} }, enabled: false });
    expect(group).toMatchObject({ collapsed: true, opacity: 0.5 });
    expect(pixels.layers.get(bg!.id)!.sample(0, 0, 2)).toBe(30);
    const mask = pixels.masks.get(sticker!.id)!;
    // Inside its rect: the written values; outside it, hidden.
    expect(mask.sample(0, 0)).toBe(0);
    expect(mask.sample(1, 0)).toBe(255);
    expect(mask.sample(-2, 0)).toBe(0);
  });

  it('saves a photo as a PSD that looks the same', () => {
    const base = TiledRaster.fromRaster(solidRaster(4, 4, [100, 100, 100, 255]));
    const store = new Map([['ly-00000001', base]]);
    const lookup: PixelsLookup = { layer: (id) => store.get(id), mask: () => undefined };
    const photo: Photo = {
      width: 4,
      height: 4,
      layers: [
        { id: 'ly-00000001', name: 'Base', layerKind: 'pixel', pixels: { tiles: {} } },
        {
          id: 'ly-00000002',
          name: 'Invert',
          layerKind: 'adjustment',
          opacity: 0.5,
          adjustment: { id: 'invert', params: {} },
        },
        {
          id: 'ly-00000003',
          name: 'Tint',
          layerKind: 'fill',
          opacity: 0.25,
          blend: 'multiply',
          fill: { kind: 'solid', colour: '#ff0000' },
        },
      ],
    };
    const psd = psdFromPhoto(photo, lookup);
    expect(psd.children.map((c) => c.name)).toEqual(['Base', 'Invert', 'Tint']);
    const again = photoFromPsd(readPsd(writePsd(psd)));
    const want = compositeAll(photo, lookup);
    const got = compositeAll(again.photo, {
      layer: (id) => again.pixels.layers.get(id),
      mask: (id) => again.pixels.masks.get(id),
    });
    for (let i = 0; i < want.data.length; i++)
      expect(Math.abs(want.data[i]! - got.data[i]!)).toBeLessThanOrEqual(2);
    expect(pixelAt(psd.composite!, 0, 0)).toEqual(pixelAt(want, 0, 0));
    expect(tilesFor(1000, 600)).toBe(4);
  });

  it('saves groups and masks', () => {
    const t = TiledRaster.fromRaster(solidRaster(2, 2, [5, 5, 5, 255]));
    const m = new TiledRaster(1, 255);
    m.writeChannel({ x: 0, y: 0, width: 1, height: 1 }, new Uint8Array([0]));
    const photo: Photo = {
      width: 4,
      height: 4,
      layers: [
        {
          id: 'ly-00000011',
          name: 'In',
          layerKind: 'pixel',
          parent: 'ly-00000012',
          pixels: { tiles: {} },
          offset: { x: 1, y: 1 },
          mask: { pixels: { tiles: {} } },
        },
        { id: 'ly-00000012', name: 'G', layerKind: 'group', collapsed: true, visible: false },
        { id: 'ly-00000013', name: 'Empty', layerKind: 'pixel', pixels: { tiles: {} } },
      ],
    };
    const psd = psdFromPhoto(photo, {
      layer: (id) => (id === 'ly-00000011' ? t : undefined),
      mask: (id) => (id === 'ly-00000011' ? m : undefined),
    });
    const g = psd.children[0]!;
    if (g.kind !== 'group') throw new Error('group');
    expect(g).toMatchObject({ collapsed: true, visible: false });
    const inner = g.children[0]!;
    if (inner.kind !== 'layer') throw new Error('layer');
    expect(inner).toMatchObject({ x: 1, y: 1 });
    expect(inner.mask!.data[1 * 4 + 1]).toBe(0);
    const empty = psd.children[1]!;
    if (empty.kind !== 'layer') throw new Error('layer');
    expect(empty.raster.width).toBe(0);
    expect(readPsd(writePsd(psd)).children).toHaveLength(2);
  });
});

describe('PNG stream', () => {
  it('encodes a picture band by band that decodes back exactly', async () => {
    const src = createRaster(37, 21);
    for (let y = 0; y < 21; y++)
      for (let x = 0; x < 37; x++)
        setPixel(src, x, y, [x * 6, y * 12, (x * y) % 256, 128 + (x % 2) * 127]);
    const blob = await encodePngStream(
      37,
      21,
      (y, rows) => ({
        width: 37,
        height: rows,
        data: src.data.slice(y * 37 * 4, (y + rows) * 37 * 4),
      }),
      8,
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
    // Find IDAT and inflate it.
    let at = 8;
    const idat: Uint8Array[] = [];
    while (at < bytes.length) {
      const len = new DataView(bytes.buffer).getUint32(at);
      const type = String.fromCharCode(...bytes.slice(at + 4, at + 8));
      if (type === 'IDAT') idat.push(bytes.slice(at + 8, at + 8 + len));
      at += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = 37 * 4 + 1;
    for (let y = 0; y < 21; y++) {
      expect(raw[y * stride]).toBe(1);
      for (let i = 0; i < 37 * 4; i++) {
        const prev = i >= 4 ? (src.data[y * 37 * 4 + i - 4] ?? 0) : 0;
        expect((raw[y * stride + 1 + i]! + prev) & 255).toBe(src.data[y * 37 * 4 + i]);
      }
    }
  });
});
