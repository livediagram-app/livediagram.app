import { describe, expect, it } from 'vitest';
import { harness, photoOf, pixelLayer, solid } from './photo-test-utils';
import { layerThumbnail, thumbSize } from './thumbnails';

describe('layer thumbnails', () => {
  it('fits the photo’s shape in the square', () => {
    expect(thumbSize({ width: 400, height: 200 })).toEqual({ width: 32, height: 16 });
  });

  it('samples a layer where it sits, and a mask as grey', () => {
    const h = harness(photoOf(64, 64, [pixelLayer('a', { offset: { x: 32, y: 0 } })]), {
      a: solid(32, 64, [10, 20, 30, 255]),
    });
    const t = layerThumbnail(h.s, 'a', 'layer')!;
    expect([...t.data.subarray(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...t.data.subarray(31 * 4, 32 * 4)]).toEqual([10, 20, 30, 255]);
    expect(layerThumbnail(h.s, 'a', 'mask')).toBeNull();
    expect(layerThumbnail(h.s, 'nope', 'layer')).toBeNull();
  });
});
