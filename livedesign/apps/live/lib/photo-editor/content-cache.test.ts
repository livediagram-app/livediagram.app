import { describe, expect, it, vi } from 'vitest';
import {
  TiledRaster,
  type FillLayer,
  type PhotoLayer,
  type PixelLayer,
  type PixelsLookup,
} from '@livedesign/photo-engine';
import { ContentCache } from './content-cache';
import { photoOf, solid } from './photo-test-utils';
import { photoPointer } from './photo-pointer';

// docs/specs/031-photo/blueprints/photo-engine.md "The GPU compositor": what the CPU draws for the GPU,
// drawn once and kept until the layer changes.
const photo = photoOf(16, 8);
const gradientFill = (angle = 0): FillLayer => ({
  id: 'g',
  name: 'Gradient',
  layerKind: 'fill',
  fill: {
    kind: 'gradient',
    style: 'linear',
    angle,
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
});
const withShadow = (extra: Partial<PixelLayer> = {}): PixelLayer => ({
  id: 'p',
  name: 'P',
  layerKind: 'pixel',
  pixels: { tiles: {} },
  effects: { stroke: { size: 2, colour: '#ff0000', position: 'outside' } },
  ...extra,
});

const lookup = (rasters: Record<string, TiledRaster>): PixelsLookup =>
  ({ layer: (id: string) => rasters[id] ?? null, mask: () => null }) as unknown as PixelsLookup;

describe('the content cache', () => {
  it('draws a gradient fill once, and again when it changes', () => {
    const c = new ContentCache();
    const a = c.get(gradientFill(), photo, lookup({}));
    expect(a?.tileBounds()).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(c.get(gradientFill(), photo, lookup({}))).toBe(a);
    const b = c.get(gradientFill(90), photo, lookup({}));
    // By identity: a deep compare of two 512 px tiles is slow.
    expect(b === a).toBe(false);
    c.forget('g');
    expect(c.get(gradientFill(90), photo, lookup({})) === b).toBe(false);
  });

  it('leaves a plain pixel layer and a solid fill to the GPU', () => {
    const c = new ContentCache();
    const plain: PixelLayer = { id: 'p', name: 'P', layerKind: 'pixel', pixels: { tiles: {} } };
    expect(
      c.get(plain, photo, lookup({ p: TiledRaster.fromRaster(solid(4, 4, [1, 2, 3, 255])) })),
    ).toBeNull();
    const fill: PhotoLayer = {
      id: 's',
      name: 'S',
      layerKind: 'fill',
      fill: { kind: 'solid', colour: '#ff0000' },
    };
    expect(c.get(fill, photo, lookup({}))).toBeNull();
  });

  it('draws a pixel layer with effects around its pixels, and nothing when it has none', () => {
    const c = new ContentCache();
    const raster = TiledRaster.fromRaster(solid(4, 4, [0, 0, 255, 255]), 4, 2);
    const drawn = c.get(withShadow(), photo, lookup({ p: raster }));
    expect(drawn).not.toBeNull();
    // The stroke reaches past the pixels.
    expect(drawn!.contentBounds()!.width).toBeGreaterThan(4);
    expect(c.get(withShadow(), photo, lookup({}))).toBeNull();
    expect(
      c.get(withShadow({ id: 'q' }), photo, lookup({ q: new TiledRaster() }))?.tileBounds(),
    ).toBeNull();
    c.clear();
  });
});

describe('the pointer over the photo', () => {
  it('tells only when it moves to another pixel or off the photo', () => {
    const seen = vi.fn();
    const off = photoPointer.subscribe(seen);
    photoPointer.set({ x: 1.2, y: 1.2 });
    photoPointer.set({ x: 1.8, y: 1.4 });
    expect(seen).toHaveBeenCalledTimes(1);
    photoPointer.set({ x: 2.1, y: 1.4 });
    photoPointer.set(null);
    photoPointer.set(null);
    expect(seen).toHaveBeenCalledTimes(3);
    expect(photoPointer.get()).toBeNull();
    off();
  });
});
