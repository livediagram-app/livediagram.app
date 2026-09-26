import { describe, expect, it } from 'vitest';
import { decodePngBuffer, encodePng } from './png';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('encodePng', () => {
  it('writes a PNG signature and an 8-bit truecolour IHDR', () => {
    const png = encodePng({ width: 3, height: 2, data: new Uint8ClampedArray(3 * 2 * 4) });
    expect([...png.subarray(0, 8)]).toEqual(SIGNATURE);
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(3);
    expect(png.readUInt32BE(20)).toBe(2);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(2); // colour type: truecolour
  });

  it('round-trips RGBA through the decoder (alpha dropped to opaque)', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 99, 200, 150, 100, 0]);
    const out = decodePngBuffer(encodePng({ width: 2, height: 1, data }));
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect([...out.data]).toEqual([10, 20, 30, 255, 200, 150, 100, 255]);
  });

  it('encodes packed RGB to the same bytes as the RGBA it came from', () => {
    const rgba = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
    const rgb = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const fromRgba = encodePng({ width: 2, height: 2, data: rgba });
    const fromRgb = encodePng({ width: 2, height: 2, data: rgb }, { channels: 3 });
    expect(fromRgb.equals(fromRgba)).toBe(true);
  });
});
