import { describe, expect, it } from 'vitest';
import { parseLayer, parsePhoto, photosOf, parseGradient, parseTileMap } from './parse';
import { PHOTO_MAX_LAYERS } from './limits';
import { group, lid, pixel } from './test-layers';

const BLOB = 'abcdefghijklmnopqrstuv';

describe('parsePhoto', () => {
  it('reads a valid photo', () => {
    const l = pixel();
    expect(parsePhoto({ width: 10, height: 20, layers: [l], rev: 3, preview: BLOB })).toEqual({
      width: 10,
      height: 20,
      layers: [l],
      rev: 3,
      preview: BLOB,
    });
  });

  it('refuses a size out of bounds, or past the area cap', () => {
    expect(parsePhoto({ width: 0, height: 20, layers: [] })).toBeUndefined();
    expect(parsePhoto({ width: 8193, height: 20, layers: [] })).toBeUndefined();
    expect(parsePhoto({ width: 8192, height: 8192, layers: [] })).toBeUndefined();
    expect(parsePhoto({ width: 1.5, height: 20, layers: [] })).toBeUndefined();
    expect(parsePhoto(null)).toBeUndefined();
    expect(parsePhoto([1])).toBeUndefined();
  });

  it('skips malformed and repeated layers, drops a bad preview', () => {
    const a = pixel();
    const p = parsePhoto({ width: 5, height: 5, layers: [a, { id: 'nope' }, a, 7], preview: 'x' })!;
    expect(p.layers).toEqual([a]);
    expect(p.preview).toBeUndefined();
  });

  it('cuts the stack to the cap, keeping the top', () => {
    const layers = Array.from({ length: PHOTO_MAX_LAYERS + 5 }, () => pixel());
    const p = parsePhoto({ width: 5, height: 5, layers })!;
    expect(p.layers).toHaveLength(PHOTO_MAX_LAYERS);
    expect(p.layers.at(-1)!.id).toBe(layers.at(-1)!.id);
  });

  it('clears a parent that names no group', () => {
    const a = pixel();
    const b = pixel(undefined, { parent: a.id });
    const p = parsePhoto({ width: 5, height: 5, layers: [b, a] })!;
    expect(p.layers.every((l) => !l.parent)).toBe(true);
  });
});

describe('parseLayer', () => {
  it('needs a valid id and kind', () => {
    expect(parseLayer({ id: lid(), layerKind: 'wat' })).toBeUndefined();
    expect(parseLayer({ id: 'x', layerKind: 'pixel' })).toBeUndefined();
  });

  it('keeps valid optional fields and drops the rest', () => {
    const id = lid();
    const l = parseLayer({
      id,
      name: '  Sky  ',
      layerKind: 'pixel',
      visible: false,
      opacity: 0.456,
      blend: 'multiply',
      locks: { transparency: true, nonsense: true },
      clip: true,
      pixels: { tiles: { '0.0': BLOB, '1.0': '', 'x.y': BLOB, '2.0': 'bad' } },
      offset: { x: 3, y: -4 },
    });
    expect(l).toEqual({
      id,
      name: 'Sky',
      layerKind: 'pixel',
      visible: false,
      opacity: 0.46,
      blend: 'multiply',
      locks: { transparency: true },
      clip: true,
      pixels: { tiles: { '0.0': BLOB, '1.0': '' } },
      offset: { x: 3, y: -4 },
    });
  });

  it('drops a default opacity, a zero offset and a group-only blend on a pixel layer', () => {
    const l = parseLayer({
      id: lid(),
      name: 'a',
      layerKind: 'pixel',
      opacity: 1,
      blend: 'pass-through',
      pixels: {},
      offset: { x: 0, y: 0 },
    })!;
    expect(l).not.toHaveProperty('opacity');
    expect(l).not.toHaveProperty('blend');
    expect(l).not.toHaveProperty('offset');
  });

  it('names an unnamed layer Layer', () => {
    expect(parseLayer({ id: lid(), layerKind: 'pixel', pixels: {} })!.name).toBe('Layer');
  });

  it('reads a group, storing Normal but not Pass Through', () => {
    const g = parseLayer({
      id: lid(),
      name: 'g',
      layerKind: 'group',
      blend: 'normal',
      collapsed: true,
    })!;
    expect(g).toMatchObject({ blend: 'normal', collapsed: true });
    expect(
      parseLayer({ id: lid(), name: 'g', layerKind: 'group', blend: 'pass-through' }),
    ).not.toHaveProperty('blend');
  });

  it('reads an adjustment and keeps its settings plain', () => {
    const l = parseLayer({
      id: lid(),
      name: 'Levels 1',
      layerKind: 'adjustment',
      adjustment: { id: 'levels', params: { rgb: { inBlack: 10 } } },
    });
    expect(l).toMatchObject({ adjustment: { id: 'levels', params: { rgb: { inBlack: 10 } } } });
    expect(
      parseLayer({ id: lid(), name: 'x', layerKind: 'adjustment', adjustment: { id: 'wat' } }),
    ).toBeUndefined();
    const huge = parseLayer({
      id: lid(),
      name: 'x',
      layerKind: 'adjustment',
      adjustment: { id: 'curves', params: { junk: 'x'.repeat(9000) } },
    }) as { adjustment: { params: unknown } };
    expect(huge.adjustment.params).toEqual({});
  });

  it('reads fills', () => {
    expect(
      parseLayer({
        id: lid(),
        name: 'f',
        layerKind: 'fill',
        fill: { kind: 'solid', colour: '#ff0000' },
      }),
    ).toMatchObject({ fill: { kind: 'solid', colour: '#ff0000' } });
    expect(
      parseLayer({
        id: lid(),
        name: 'f',
        layerKind: 'fill',
        fill: { kind: 'solid', colour: 'red' },
      }),
    ).toBeUndefined();
    const g = parseLayer({
      id: lid(),
      name: 'g',
      layerKind: 'fill',
      fill: {
        kind: 'gradient',
        gradient: {
          colours: [
            { at: 1, colour: '#000000' },
            { at: 0, colour: '#ffffff' },
          ],
        },
        style: 'bogus',
        reverse: true,
      },
    });
    expect(g).toMatchObject({
      fill: {
        kind: 'gradient',
        style: 'linear',
        angle: 90,
        scale: 1,
        reverse: true,
        gradient: {
          colours: [
            { at: 0, colour: '#ffffff' },
            { at: 1, colour: '#000000' },
          ],
          opacities: [
            { at: 0, opacity: 1 },
            { at: 1, opacity: 1 },
          ],
        },
      },
    });
  });

  it('reads text, clamping its words', () => {
    const t = parseLayer({
      id: lid(),
      name: 't',
      layerKind: 'text',
      text: {
        text: 'x'.repeat(3000),
        font: 'inter',
        size: 40,
        weight: 700,
        colour: '#112233',
        align: 'centre',
        at: { x: 1, y: 2 },
        lineHeight: 9,
      },
    }) as { text: { text: string; lineHeight?: number; weight: number; align: string } };
    expect(t.text.text).toHaveLength(2000);
    expect(t.text.lineHeight).toBeUndefined();
    expect(t.text.weight).toBe(700);
    expect(t.text.align).toBe('centre');
    expect(
      parseLayer({
        id: lid(),
        name: 't',
        layerKind: 'text',
        text: { text: 'a', font: 'x', size: 1 },
      }),
    ).toBeUndefined();
  });

  it('reads a mask, its link and offset', () => {
    const l = parseLayer({
      id: lid(),
      name: 'm',
      layerKind: 'pixel',
      pixels: {},
      mask: {
        pixels: { tiles: { '0.0': BLOB } },
        enabled: false,
        linked: false,
        offset: { x: 1, y: 1 },
      },
    });
    expect(l!.mask).toEqual({
      pixels: { tiles: { '0.0': BLOB } },
      enabled: false,
      linked: false,
      offset: { x: 1, y: 1 },
    });
  });

  it('reads effects, dropping incomplete ones', () => {
    const l = parseLayer({
      id: lid(),
      name: 'e',
      layerKind: 'pixel',
      pixels: {},
      effects: {
        shadow: { colour: '#000000', opacity: 0.5, angle: 120, distance: 5, size: 5, spread: 0 },
        glow: { colour: '#ffffff', opacity: 2, size: 1, spread: 0 },
        stroke: { colour: '#ff0000', size: 3, position: 'inside', enabled: false },
        overlay: { colour: '#00ff00', opacity: 1, blend: 'nope' },
      },
    });
    expect(l!.layerKind === 'pixel' && l!.effects).toEqual({
      shadow: { colour: '#000000', opacity: 0.5, angle: 120, distance: 5, size: 5, spread: 0 },
      stroke: { enabled: false, colour: '#ff0000', size: 3, position: 'inside' },
      overlay: { colour: '#00ff00', opacity: 1, blend: 'normal' },
    });
  });

  it('reads a pixel source', () => {
    const l = parseLayer({
      id: lid(),
      name: 's',
      layerKind: 'pixel',
      pixels: { tiles: {}, source: { blob: BLOB, width: 640, height: 480 } },
    });
    expect(l!.layerKind === 'pixel' && l!.pixels.source).toEqual({
      blob: BLOB,
      width: 640,
      height: 480,
    });
  });
});

describe('parseTileMap and parseGradient', () => {
  it('rejects keys out of reach', () => {
    expect(parseTileMap({ '999.0': BLOB, '-1.-1': BLOB })).toEqual({ '-1.-1': BLOB });
    expect(parseTileMap(null)).toEqual({});
  });
  it('needs a colour stop', () => {
    expect(parseGradient({ colours: [] })).toBeUndefined();
    expect(parseGradient(null)).toBeUndefined();
  });
});

describe('photosOf', () => {
  it('reads each photo by page id and caches by the stored object', () => {
    const photos = {
      'page-1': { width: 10, height: 10, layers: [] },
      'bad id!': { width: 10, height: 10, layers: [] },
      'page-2': { width: 0, height: 10, layers: [] },
    };
    const a = photosOf({ photos });
    expect(Object.keys(a)).toEqual(['page-1']);
    expect(photosOf({ photos })).toBe(a);
    expect(photosOf({})).toEqual({});
    expect(photosOf(undefined)).toEqual({});
  });

  it('keeps a group and its children', () => {
    const g = group();
    const c = pixel(undefined, { parent: g.id });
    const p = photosOf({ photos: { p: { width: 3, height: 3, layers: [c, g] } } }).p!;
    expect(p.layers.map((l) => l.id)).toEqual([c.id, g.id]);
    expect(p.layers[0]!.parent).toBe(g.id);
  });
});
