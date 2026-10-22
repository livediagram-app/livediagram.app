import { describe, expect, it } from 'vitest';
import {
  compositePhoto,
  TiledRaster,
  type PhotoLayer,
  type PixelsLookup,
} from '@livedesign/photo-engine';
import { solid } from './photo-test-utils';
import { COMPOSITE_AT_ONCE_PX, COMPOSITE_SLICE_MS, compositeSliced } from './sliced-composite';

// A composite worked in bands is the composite worked at once, a drop shadow reaching across bands included,
// and gives the page back while it works.
describe('the banded composite', () => {
  const W = 1200;
  const H = 1000;
  const top = solid(W, H, [0, 0, 0, 0]);
  for (let y = 240; y < 760; y++)
    for (let x = 300; x < 900; x++) top.data.set([30, 90, 200, 255], (y * W + x) * 4);
  const layers: PhotoLayer[] = [
    { id: 'a', name: 'a', layerKind: 'pixel', pixels: { tiles: {} } },
    {
      id: 'b',
      name: 'b',
      layerKind: 'pixel',
      pixels: { tiles: {} },
      blend: 'multiply',
      effects: {
        shadow: { colour: '#000000', opacity: 0.7, angle: 120, distance: 40, size: 30, spread: 0 },
      },
    },
  ];
  const rasters = {
    a: TiledRaster.fromRaster(solid(W, H, [220, 180, 120, 255])),
    b: TiledRaster.fromRaster(top),
  };
  const lookup = {
    layer: (id: string) => rasters[id as 'a' | 'b'],
    mask: () => undefined,
  } as PixelsLookup;
  const photo = { width: W, height: H, layers };
  const rect = { x: 0, y: 0, width: W, height: H };

  it('draws what one composite draws', async () => {
    expect(W * H).toBeGreaterThan(COMPOSITE_AT_ONCE_PX);
    const whole = compositePhoto(photo, lookup, rect);
    const banded = await compositeSliced(photo, lookup, rect);
    let max = 0;
    for (let i = 0; i < whole.data.length; i++)
      max = Math.max(max, Math.abs(whole.data[i]! - banded.data[i]!));
    expect(max).toBe(0);
  });

  it('gives the page back between bands', async () => {
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0);
    await compositeSliced(photo, lookup, rect);
    clearInterval(timer);
    expect(ticks).toBeGreaterThan(0);
    expect(COMPOSITE_SLICE_MS).toBeLessThan(50);
  });
});
