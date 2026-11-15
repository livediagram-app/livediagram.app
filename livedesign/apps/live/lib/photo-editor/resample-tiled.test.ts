import { describe, expect, it } from 'vitest';
import {
  createRaster,
  PHOTO_TILE,
  resizeRaster,
  resizeRegion,
  TiledRaster,
  type Rect,
} from '@livedesign/photo-engine';
import { resampleTiled, type RegionResample } from './image-ops';

// Make Sizes resamples a large picture a tile at a time (docs/specs/031-photo/blueprints/photo-engine.md "Make
// Sizes", Work Tracker 198): the result matches the whole resample, and no tile reads more than about a
// PHOTO_TILE of source each way, however much the picture shrinks.

/** A picture across several tiles, offset from the layer's origin, with a transparent corner. */
function picture(w: number, h: number) {
  const r = createRaster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      r.data[o] = (x * 7) & 255;
      r.data[o + 1] = (y * 5) & 255;
      r.data[o + 2] = (x * y) & 255;
      r.data[o + 3] = x < 40 && y < 40 ? 0 : 255;
    }
  return r;
}

const inline =
  (seen: Rect[]): RegionResample =>
  async (region, plan, out) => {
    seen.push({ x: 0, y: 0, width: region.width, height: region.height });
    return resizeRegion(region, plan, out);
  };

describe('resampleTiled', () => {
  // Just over a tile each way, odd on both sides: every size below still splits into at least two tiles across and
  // two down, with a part tile at each far edge, while the whole resample the test compares against stays small
  // enough to run in well under a second under coverage on a loaded CI machine.
  const W = PHOTO_TILE + 101;
  const H = PHOTO_TILE + 37;
  const pic = picture(W, H);
  const at = { x: 30, y: 20 };
  const tiles = new TiledRaster();
  tiles.write(pic, at.x, at.y);
  const bounds = { ...at, width: W, height: H };

  for (const [w, h] of [
    [Math.round(W * 0.64), Math.round(H * 0.64)], // Instagram Story's scale
    [Math.round(W * 0.2), Math.round(H * 0.2)], // Facebook Cover's: averaged by blocks first
    [Math.round(W * 1.1), Math.round(H * 1.1)], // an enlargement
  ] as const)
    it(`matches the whole resample at ${w} x ${h}, reading a bounded source per tile`, async () => {
      const seen: Rect[] = [];
      const out = await resampleTiled(tiles, bounds, w, h, inline(seen));
      const whole = resizeRaster(pic, w, h, 'bicubic');
      const got = out.read({ x: 0, y: 0, width: w, height: h });
      let worst = 0;
      for (let i = 0; i < got.data.length; i++)
        worst = Math.max(worst, Math.abs(got.data[i]! - whole.data[i]!));
      expect(worst).toBeLessThanOrEqual(1);
      expect(seen.length).toBeGreaterThanOrEqual(4);
      // About a tile across, plus the filter's reach and an averaging block.
      for (const r of seen) expect(Math.max(r.width, r.height)).toBeLessThan(PHOTO_TILE * 1.5);
    });
});
