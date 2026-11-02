import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  readArgb,
  readNumber,
  readPackedDouble,
  readPenColour,
  readVarint,
  zigzag,
} from './values';

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

// docs/specs/020-import-export/whiteboard-import.md "Values".
describe('readNumber', () => {
  it.each([
    ['ff', -1],
    ['5a', 90],
    ['b400', 180],
    ['7efc', -898],
    ['90010000', 400],
    ['000000000000f03f', 1],
    ['0000000000000000', 0],
  ])('reads %s as %d by its length', (bytes, value) => {
    expect(readNumber(hex(bytes))).toBe(value);
  });

  it('refuses other lengths', () => {
    expect(readNumber(hex('010203'))).toBeNull();
    expect(readNumber(new Uint8Array())).toBeNull();
  });
});

describe('readArgb', () => {
  it('reads A R G B, alpha omitted when opaque', () => {
    expect(readArgb(hex('ff1f1f1f'))).toEqual({ hex: '#1f1f1f' });
    expect(readArgb(hex('8099c9ef'))).toEqual({ hex: '#99c9ef', alpha: 128 / 255 });
  });

  it('reads the one-byte FF as white', () => {
    expect(readArgb(hex('ff'))).toEqual({ hex: '#ffffff' });
  });

  it('refuses anything else', () => {
    expect(readArgb(hex('00'))).toBeNull();
    expect(readArgb(hex('ffffff'))).toBeNull();
  });
});

describe('readPenColour', () => {
  it.each([
    ['01fe03', { hex: '#000000' }],
    ['01fefff8f103', { hex: '#1f1f1f' }],
    ['0181d0a0c102', { hex: '#ebebeb' }],
    ['01fe8ba8ea0a', { hex: '#02a556' }],
    ['01ccf1e70f', { hex: '#fcfc00', alpha: 0x66 / 255 }],
  ])('reads %s as B G R A', (bytes, colour) => {
    expect(readPenColour(hex(bytes))).toEqual(colour);
  });

  it('refuses a payload without the leading 01', () => {
    expect(readPenColour(hex('06fe03'))).toBeNull();
    expect(readPenColour(hex('01'))).toBeNull();
  });
});

describe('readVarint and zigzag', () => {
  it('reads little-endian base-128 with continuation bits', () => {
    expect(readVarint(hex('fe03'), 0)).toEqual([510, 2]);
    expect(readVarint(hex('05'), 0)).toEqual([5, 1]);
  });

  it('returns null when the varint runs off the end', () => {
    expect(readVarint(hex('fe'), 0)).toBeNull();
  });

  it('decodes zig-zag', () => {
    expect([0, 1, 2, 3, 4].map(zigzag)).toEqual([0, -1, 1, -2, 2]);
  });
});

describe('readPackedDouble', () => {
  it.each([
    ['0000', 0],
    ['3f78', 1],
    ['3f40', 1 / 128],
    ['c000', -2],
  ])('reads %s', (bytes, value) => {
    expect(readPackedDouble(hex(bytes), 0)).toEqual([value, bytes.length / 2]);
  });

  it('returns null when it runs off the end', () => {
    expect(readPackedDouble(hex('3f'), 0)).toBeNull();
    expect(readPackedDouble(hex('3fff'), 0)).toBeNull();
  });
});

describe('base64ToBytes', () => {
  it('decodes, and returns null for non-base64', () => {
    expect(base64ToBytes('/x8fHw==')).toEqual(hex('ff1f1f1f'));
    expect(base64ToBytes('not base64!')).toBeNull();
  });
});
