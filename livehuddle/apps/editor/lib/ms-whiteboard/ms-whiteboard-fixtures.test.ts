import { describe, expect, it } from 'vitest';
import {
  encodeArgb,
  encodeNumber,
  encodePackedDouble,
  encodePenColour,
  encodeVarint,
  encodeZigzag,
} from './ms-whiteboard-fixtures';
import {
  readArgb,
  readNumber,
  readPackedDouble,
  readPenColour,
  readVarint,
  zigzag,
} from './values';

// The encoder mirrors the decoder: every value round-trips.
describe('ms-whiteboard fixture encoder', () => {
  it.each([0, 1, 127, 128, 510, 2 ** 31, 2 ** 40])('round-trips varint %d', (v) => {
    expect(readVarint(Uint8Array.from(encodeVarint(v)), 0)![0]).toBe(v);
  });

  it.each([0, 1, -1, 999, -465838])('round-trips zig-zag %d', (v) => {
    expect(zigzag(encodeZigzag(v))).toBe(v);
  });

  it.each([0, 1, -2, 1 / 128, 1 / 26.458333333333332, 0.2787315701492437, 395.25, -12.625])(
    'round-trips packed double %d',
    (v) => {
      const bytes = Uint8Array.from(encodePackedDouble(v));
      expect(readPackedDouble(bytes, 0)).toEqual([v, bytes.length]);
    },
  );

  it.each([
    ['#000000', 1],
    ['#ebebeb', 1],
    ['#02a556', 1],
    ['#fcfc00', 0x66 / 255],
  ])('round-trips pen colour %s', (hex, alpha) => {
    expect(readPenColour(encodePenColour(hex, alpha))).toEqual(
      alpha === 1 ? { hex } : { hex, alpha },
    );
  });

  it('round-trips ARGB colours and numbers', () => {
    expect(readArgb(encodeArgb('#99c9ef'))).toEqual({ hex: '#99c9ef' });
    expect(readNumber(encodeNumber(-898, 2))).toBe(-898);
    expect(readNumber(encodeNumber(400, 4))).toBe(400);
    expect(readNumber(encodeNumber(823.5))).toBe(823.5);
  });
});
