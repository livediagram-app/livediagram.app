import { describe, expect, it } from 'vitest';
import type { PhotoLayer, TextLayer } from '../model/types';
import { createRaster, pixelAt, solidRaster } from '../raster/raster';
import { TiledRaster } from '../raster/tiles';
import {
  compositeAll,
  compositePhoto,
  dissolveNoise,
  dissolveSeed,
  layerTree,
  type PixelsLookup,
} from './composite';
import { effectsMargin, hasEffects, withEffects } from './effects';

let n = 0;
const id = () => `ly-${(++n).toString(16).padStart(8, '0')}`;

type Store = { layers: Map<string, TiledRaster>; masks: Map<string, TiledRaster> };
const store = (): Store => ({ layers: new Map(), masks: new Map() });
const lookup = (s: Store): PixelsLookup => ({
  layer: (i) => s.layers.get(i),
  mask: (i) => s.masks.get(i),
});

function solidLayer(
  s: Store,
  rgba: number[],
  extra: Partial<PhotoLayer> = {},
  w = 4,
  h = 4,
): PhotoLayer {
  const lid = id();
  s.layers.set(lid, TiledRaster.fromRaster(solidRaster(w, h, rgba)));
  return { id: lid, name: lid, layerKind: 'pixel', pixels: { tiles: {} }, ...extra } as PhotoLayer;
}

const photoOf = (layers: PhotoLayer[]) => ({ width: 4, height: 4, layers });

describe('compositePhoto', () => {
  it('draws layers bottom to top with opacity and blend', () => {
    const s = store();
    const blue = solidLayer(s, [0, 0, 255, 255]);
    const red = solidLayer(s, [255, 0, 0, 255], { opacity: 0.5 });
    const out = compositeAll(photoOf([blue, red]), lookup(s));
    expect(pixelAt(out, 0, 0)).toEqual([128, 0, 128, 255]);
    const mul = solidLayer(s, [128, 128, 128, 255], { blend: 'multiply' });
    const out2 = compositeAll(photoOf([blue, mul]), lookup(s));
    expect(pixelAt(out2, 1, 1)).toEqual([0, 0, 128, 255]);
  });

  it('skips hidden layers and draws an empty stack transparent', () => {
    const s = store();
    const red = solidLayer(s, [255, 0, 0, 255], { visible: false });
    expect(pixelAt(compositeAll(photoOf([red]), lookup(s)), 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(compositeAll(photoOf([]), lookup(s)), 0, 0)).toEqual([0, 0, 0, 0]);
  });

  it('applies an offset and a mask', () => {
    const s = store();
    const l = solidLayer(s, [255, 255, 255, 255], { offset: { x: 2, y: 0 } }, 2, 4);
    const out = compositeAll(photoOf([l]), lookup(s));
    expect(pixelAt(out, 1, 0)[3]).toBe(0);
    expect(pixelAt(out, 2, 0)[3]).toBe(255);
    const m = solidLayer(s, [255, 255, 255, 255], {
      mask: { pixels: { tiles: {} } },
    });
    const mask = new TiledRaster(1, 255);
    mask.writeChannel({ x: 0, y: 0, width: 1, height: 1 }, new Uint8Array([0]));
    s.masks.set(m.id, mask);
    const masked = compositeAll(photoOf([m]), lookup(s));
    expect(pixelAt(masked, 0, 0)[3]).toBe(0);
    expect(pixelAt(masked, 1, 0)[3]).toBe(255);
    const off = { ...m, mask: { ...m.mask!, enabled: false as const } };
    expect(pixelAt(compositeAll(photoOf([off]), lookup(s)), 0, 0)[3]).toBe(255);
    const unloaded = { ...m, id: id() };
    expect(pixelAt(compositeAll(photoOf([unloaded]), lookup(s)), 0, 0)[3]).toBe(0);
  });

  it('draws fills', () => {
    const s = store();
    const solid: PhotoLayer = {
      id: id(),
      name: 'f',
      layerKind: 'fill',
      fill: { kind: 'solid', colour: '#00ff00' },
    };
    expect(pixelAt(compositeAll(photoOf([solid]), lookup(s)), 3, 3)).toEqual([0, 255, 0, 255]);
    const grad: PhotoLayer = {
      id: id(),
      name: 'g',
      layerKind: 'fill',
      fill: {
        kind: 'gradient',
        style: 'linear',
        angle: 0,
        scale: 1,
        gradient: {
          colours: [
            { at: 0, colour: '#000000' },
            { at: 1, colour: '#ffffff' },
          ],
          opacities: [
            { at: 0, opacity: 1 },
            { at: 1, opacity: 1 },
          ],
        },
      },
    };
    const out = compositeAll({ width: 100, height: 4, layers: [grad] }, lookup(s));
    expect(pixelAt(out, 0, 0)[0]).toBeLessThan(10);
    expect(pixelAt(out, 99, 0)[0]).toBeGreaterThan(245);
  });

  it('applies an adjustment layer to what is under it, through its mask', () => {
    const s = store();
    const base = solidLayer(s, [100, 100, 100, 255]);
    const inv: PhotoLayer = {
      id: id(),
      name: 'i',
      layerKind: 'adjustment',
      adjustment: { id: 'invert', params: {} },
    };
    const out = compositeAll(photoOf([base, inv]), lookup(s));
    expect(pixelAt(out, 0, 0)).toEqual([155, 155, 155, 255]);
    const half = { ...inv, opacity: 0.5 };
    expect(pixelAt(compositeAll(photoOf([base, half]), lookup(s)), 0, 0)[0]).toBe(128);
    const identity: PhotoLayer = {
      id: id(),
      name: 'l',
      layerKind: 'adjustment',
      adjustment: { id: 'levels', params: {} },
    };
    expect(pixelAt(compositeAll(photoOf([base, identity]), lookup(s)), 0, 0)).toEqual([
      100, 100, 100, 255,
    ]);
    const screen = { ...inv, id: id(), blend: 'screen' as const };
    expect(pixelAt(compositeAll(photoOf([base, screen]), lookup(s)), 0, 0)[0]).toBeGreaterThan(155);
    const hue = { ...inv, id: id(), blend: 'luminosity' as const };
    expect(pixelAt(compositeAll(photoOf([base, hue]), lookup(s)), 0, 0)[0]).toBeGreaterThan(100);
    // An adjustment over transparency changes nothing.
    expect(pixelAt(compositeAll(photoOf([inv]), lookup(s)), 0, 0)).toEqual([0, 0, 0, 0]);
    // A cached form is reused.
    const forms = new Map();
    compositeAll(photoOf([base, inv]), lookup(s), { forms });
    expect(forms.has(inv.id)).toBe(true);
    expect(pixelAt(compositeAll(photoOf([base, inv]), lookup(s), { forms }), 0, 0)).toEqual([
      155, 155, 155, 255,
    ]);
  });

  it('composites a group alone, or straight through', () => {
    const s = store();
    const base = solidLayer(s, [0, 0, 255, 255]);
    const g = id();
    const child = solidLayer(s, [128, 128, 128, 255], { parent: g, blend: 'multiply' });
    const isolated: PhotoLayer = { id: g, name: 'g', layerKind: 'group', blend: 'normal' };
    // Isolated: the child multiplies onto transparency (shows grey), then the group covers blue.
    expect(pixelAt(compositeAll(photoOf([base, child, isolated]), lookup(s)), 0, 0)).toEqual([
      128, 128, 128, 255,
    ]);
    const through: PhotoLayer = { id: g, name: 'g', layerKind: 'group' };
    expect(pixelAt(compositeAll(photoOf([base, child, through]), lookup(s)), 0, 0)).toEqual([
      0, 0, 128, 255,
    ]);
    const halfThrough: PhotoLayer = { ...through, opacity: 0.5 };
    expect(pixelAt(compositeAll(photoOf([base, child, halfThrough]), lookup(s)), 0, 0)[2]).toBe(
      192,
    );
    expect(layerTree([child, through])[0]!.children).toHaveLength(1);
  });

  it('clips a layer to its base, keeping the base alpha', () => {
    const s = store();
    const base = solidLayer(s, [255, 255, 255, 255], {}, 2, 4);
    const clipped = solidLayer(s, [255, 0, 0, 255], { clip: true });
    const out = compositeAll(photoOf([base, clipped]), lookup(s));
    expect(pixelAt(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(out, 3, 0)).toEqual([0, 0, 0, 0]);
    const adj: PhotoLayer = {
      id: id(),
      name: 'a',
      layerKind: 'adjustment',
      clip: true,
      adjustment: { id: 'invert', params: {} },
    };
    const out2 = compositeAll(photoOf([base, adj]), lookup(s));
    expect(pixelAt(out2, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(out2, 3, 0)[3]).toBe(0);
    const hiddenClip = { ...clipped, visible: false as const };
    expect(pixelAt(compositeAll(photoOf([base, hiddenClip]), lookup(s)), 0, 0)).toEqual([
      255, 255, 255, 255,
    ]);
    const hiddenBase = { ...base, visible: false as const };
    expect(pixelAt(compositeAll(photoOf([hiddenBase, clipped]), lookup(s)), 0, 0)[3]).toBe(0);
    // A clipped pass-through group.
    const g = id();
    const inner = solidLayer(s, [0, 255, 0, 255], { parent: g });
    const grp: PhotoLayer = { id: g, name: 'g', layerKind: 'group', clip: true };
    expect(pixelAt(compositeAll(photoOf([base, inner, grp]), lookup(s)), 3, 0)[3]).toBe(0);
    expect(pixelAt(compositeAll(photoOf([base, inner, grp]), lookup(s)), 0, 0)).toEqual([
      0, 255, 0, 255,
    ]);
  });

  it('dissolves by a fixed pattern', () => {
    const s = store();
    const l = solidLayer(s, [255, 0, 0, 255], { blend: 'dissolve', opacity: 0.5 }, 16, 16);
    const a = compositeAll({ width: 16, height: 16, layers: [l] }, lookup(s));
    const b = compositeAll({ width: 16, height: 16, layers: [l] }, lookup(s));
    expect(a.data).toEqual(b.data);
    let shown = 0;
    for (let i = 3; i < a.data.length; i += 4) {
      expect([0, 255]).toContain(a.data[i]);
      if (a.data[i] === 255) shown++;
    }
    expect(shown).toBeGreaterThan(80);
    expect(shown).toBeLessThan(176);
    expect(dissolveNoise(dissolveSeed('x'), 1, 2)).toBe(dissolveNoise(dissolveSeed('x'), 1, 2));
  });

  it('draws text through the host and composites a rect past the edges', () => {
    const s = store();
    const t: TextLayer = {
      id: id(),
      name: 't',
      layerKind: 'text',
      text: {
        text: 'Hi',
        font: 'inter',
        size: 10,
        weight: 400,
        colour: '#ff0000',
        align: 'left',
        at: { x: 0, y: 0 },
      },
    };
    const out = compositeAll(photoOf([t]), lookup(s), {
      text: (_l, rect) => solidRaster(rect.width, rect.height, [255, 0, 0, 255]),
    });
    expect(pixelAt(out, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(compositeAll(photoOf([t]), lookup(s)), 1, 1)[3]).toBe(0);
    const wide = compositePhoto(photoOf([solidLayer(s, [1, 2, 3, 255])]), lookup(s), {
      x: -2,
      y: 0,
      width: 4,
      height: 1,
    });
    expect(pixelAt(wide, 0, 0)[3]).toBe(0);
    expect(pixelAt(wide, 2, 0)).toEqual([1, 2, 3, 255]);
  });

  it('previews overrides and solos a layer', () => {
    const s = store();
    const a = solidLayer(s, [255, 0, 0, 255]);
    const b = solidLayer(s, [0, 255, 0, 255]);
    const over = new Map([[b.id, { ...b, visible: false as const }]]);
    expect(pixelAt(compositeAll(photoOf([a, b]), lookup(s), { overrides: over }), 0, 0)).toEqual([
      255, 0, 0, 255,
    ]);
    expect(pixelAt(compositeAll(photoOf([a, b]), lookup(s), { solo: a.id }), 0, 0)).toEqual([
      255, 0, 0, 255,
    ]);
    const g = id();
    const inner = solidLayer(s, [0, 0, 255, 255], { parent: g });
    const grp: PhotoLayer = { id: g, name: 'g', layerKind: 'group' };
    expect(
      pixelAt(compositeAll(photoOf([a, inner, grp, b]), lookup(s), { solo: g }), 0, 0),
    ).toEqual([0, 0, 255, 255]);
    expect(
      pixelAt(compositeAll(photoOf([a, inner, grp, b]), lookup(s), { solo: inner.id }), 0, 0),
    ).toEqual([0, 0, 255, 255]);
  });

  it('draws effects around a layer', () => {
    const s = store();
    const shape = createRaster(20, 20);
    for (let y = 8; y < 12; y++)
      for (let x = 8; x < 12; x++) shape.data.set([255, 255, 255, 255], (y * 20 + x) * 4);
    const lid = id();
    s.layers.set(lid, TiledRaster.fromRaster(shape));
    const layer: PhotoLayer = {
      id: lid,
      name: 'fx',
      layerKind: 'pixel',
      pixels: { tiles: {} },
      effects: { stroke: { colour: '#ff0000', size: 2, position: 'outside' } },
    };
    const out = compositeAll({ width: 20, height: 20, layers: [layer] }, lookup(s));
    expect(pixelAt(out, 7, 10)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(out, 10, 10)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(out, 3, 10)[3]).toBe(0);
  });
});

describe('effects', () => {
  const square = () => {
    const r = createRaster(30, 30);
    for (let y = 10; y < 20; y++)
      for (let x = 10; x < 20; x++) r.data.set([255, 255, 255, 255], (y * 30 + x) * 4);
    return r;
  };

  it('knows its margin and whether any are on', () => {
    expect(effectsMargin(undefined)).toBe(0);
    expect(
      hasEffects({ stroke: { colour: '#000000', size: 2, position: 'inside', enabled: false } }),
    ).toBe(false);
    expect(effectsMargin({ glow: { colour: '#000000', opacity: 1, size: 10, spread: 0 } })).toBe(
      17,
    );
    expect(withEffects(square(), undefined)).toBeDefined();
  });

  it('casts a shadow away from the light', () => {
    const out = withEffects(square(), {
      shadow: { colour: '#000000', opacity: 1, angle: 90, distance: 5, size: 0, spread: 0 },
    });
    // Light from above (90): the shadow falls below.
    expect(pixelAt(out, 15, 22)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(out, 15, 7)[3]).toBe(0);
    expect(pixelAt(out, 15, 15)).toEqual([255, 255, 255, 255]);
  });

  it('glows, strokes inside and centre, overlays colour', () => {
    const glow = withEffects(square(), {
      glow: { colour: '#ffff00', opacity: 1, size: 6, spread: 0.5 },
    });
    expect(pixelAt(glow, 8, 15)[3]).toBeGreaterThan(0);
    const inside = withEffects(square(), {
      stroke: { colour: '#0000ff', size: 2, position: 'inside' },
    });
    expect(pixelAt(inside, 10, 15)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(inside, 15, 15)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(inside, 8, 15)[3]).toBe(0);
    const centre = withEffects(square(), {
      stroke: { colour: '#0000ff', size: 4, position: 'centre' },
    });
    expect(pixelAt(centre, 9, 15)[2]).toBe(255);
    expect(pixelAt(centre, 10, 15)[2]).toBe(255);
    const tinted = withEffects(square(), {
      overlay: { colour: '#ff0000', opacity: 1, blend: 'normal' },
    });
    expect(pixelAt(tinted, 15, 15)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(tinted, 2, 2)[3]).toBe(0);
    const mul = withEffects(square(), {
      overlay: { colour: '#808080', opacity: 1, blend: 'multiply' },
    });
    expect(pixelAt(mul, 15, 15)[0]).toBe(128);
  });
});
