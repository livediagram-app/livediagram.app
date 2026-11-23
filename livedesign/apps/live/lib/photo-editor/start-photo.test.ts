import { describe, expect, it } from 'vitest';
import {
  encodePngStream,
  psdFromPhoto,
  writePsd,
  type PixelLayer,
} from '@livedesign/photo-engine';
import { harness, photoOf, pixel, solid } from './photo-test-utils';
import {
  fitToCap,
  photoStarted,
  readPicture,
  startBlank,
  startFromPicture,
  startFromPsd,
} from './start-photo';

async function pngOf(w: number, h: number, rgba: [number, number, number, number]): Promise<Blob> {
  const blob = await encodePngStream(w, h, (_y, rows) => solid(w, rows, rgba));
  return new Blob([await blob.arrayBuffer()], { type: 'image/png' });
}

describe('starting a photo', () => {
  it('fits a picture within the cap and the area, keeping its shape', () => {
    expect(fitToCap(800, 600, 8192)).toEqual({ width: 800, height: 600, scaled: false });
    expect(fitToCap(16000, 8000, 8192)).toEqual({ width: 8192, height: 4096, scaled: true });
    const big = fitToCap(8000, 8000, 8192);
    expect(big.scaled).toBe(true);
    expect(big.width * big.height).toBeLessThanOrEqual(40_000_000);
  });

  it('reads a PNG, keeping the file whole as its source', async () => {
    const read = await readPicture(await pngOf(3, 2, [1, 2, 3, 255]));
    expect(read.kind).toBe('picture');
    if (read.kind !== 'picture') return;
    expect([read.picture.raster.width, read.picture.raster.height]).toEqual([3, 2]);
    expect(read.picture.source?.type).toBe('image/png');
  });

  it('refuses what is not a picture, and reads a PSD’s layers', async () => {
    expect(
      (await readPicture(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))).kind,
    ).toBe('refused');
    const h = harness(photoOf(4, 4), { a: solid(4, 4, [9, 8, 7, 255]) });
    const psd = writePsd(psdFromPhoto(h.s.photo, h.s.lookup()));
    const read = await readPicture(new Blob([psd as Uint8Array<ArrayBuffer>]));
    expect(read.kind).toBe('psd');
    if (read.kind !== 'psd') return;
    const t = harness(photoOf(1, 1, []));
    startFromPsd(t.s, read);
    await t.s.settled();
    expect([t.s.photo.width, t.s.photo.height]).toEqual([4, 4]);
    expect(pixel(t, 2, 2)).toEqual([9, 8, 7, 255]);
  });

  it('starts from a picture as its Background, one edit', async () => {
    const h = harness(photoOf(10, 10, []));
    expect(photoStarted(h.s.photo)).toBe(false);
    const read = await readPicture(await pngOf(5, 3, [200, 0, 0, 255]));
    if (read.kind !== 'picture') throw new Error('not read');
    await startFromPicture(h.s, read.picture);
    await h.s.settled();
    const bg = h.s.photo.layers[0] as PixelLayer;
    expect(bg.name).toBe('Background');
    expect(bg.pixels.source?.width).toBe(5);
    expect([h.s.photo.width, h.s.photo.height]).toEqual([5, 3]);
    expect(h.commits.map((c) => c.label)).toEqual(['Open Picture']);
    // A picture without a source (scaled, or an unstored type) is made into tiles.
    const t = harness(photoOf(10, 10, []));
    await startFromPicture(t.s, { raster: solid(2, 2, [0, 9, 0, 255]), scaled: true });
    await t.s.settled();
    expect(pixel(t, 1, 1)).toEqual([0, 9, 0, 255]);
  });

  it('starts blank, filled or transparent', async () => {
    const h = harness(photoOf(10, 10, []));
    startBlank(h.s, 6, 4, 'white');
    await h.s.settled();
    expect(pixel(h, 5, 3)).toEqual([255, 255, 255, 255]);
    const t = harness(photoOf(10, 10, []));
    startBlank(t.s, 6, 4, 'transparent');
    expect(t.s.photo.layers).toHaveLength(1);
    expect(pixel(t, 0, 0)[3]).toBe(0);
  });
});
