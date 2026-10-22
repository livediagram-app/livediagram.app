import { describe, expect, it } from 'vitest';
import { PHOTO_PREVIEW_MAX } from '@livedesign/photo-engine';
import { harness, photoOf, solid } from './photo-test-utils';
import { previewRaster, previewSize } from './preview';

describe('the preview', () => {
  it('keeps a small photo’s size and scales a large one to fit, keeping its shape', () => {
    expect(previewSize({ width: 300, height: 200 })).toEqual({ width: 300, height: 200 });
    expect(previewSize({ width: PHOTO_PREVIEW_MAX * 4, height: PHOTO_PREVIEW_MAX })).toEqual({
      width: PHOTO_PREVIEW_MAX,
      height: PHOTO_PREVIEW_MAX / 4,
    });
  });

  it('averages the composite by alpha, band by band, and stops when cancelled', async () => {
    const r = solid(4, 300, [0, 0, 0, 0]);
    for (let y = 0; y < 300; y++) r.data.set([200, 100, 50, 255], y * 16);
    const h = harness(photoOf(4, 300), { a: r });
    const out = await previewRaster(h.s.photo, h.s.lookup());
    expect([out!.width, out!.height]).toEqual([4, 300]);
    expect([...out!.data.subarray(0, 8)]).toEqual([200, 100, 50, 255, 0, 0, 0, 0]);
    expect(await previewRaster(h.s.photo, h.s.lookup(), () => true)).toBeNull();
  });
});
