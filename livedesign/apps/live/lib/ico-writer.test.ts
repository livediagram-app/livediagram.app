import { describe, expect, it } from 'vitest';
import { encodeIco } from './ico-writer';

// docs/specs/007-editor/logo-pages.md "Export": favicon.ico holds the 16, 32 and 48 px PNGs.
describe('encodeIco', () => {
  it('writes the directory, an entry per image and the PNGs in order', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const ico = encodeIco([
      { size: 16, png: a },
      { size: 256, png: b },
    ]);
    const v = new DataView(ico.buffer);
    expect([v.getUint16(0, true), v.getUint16(2, true), v.getUint16(4, true)]).toEqual([0, 1, 2]);
    expect([ico[6], ico[7], v.getUint16(10, true), v.getUint16(12, true)]).toEqual([16, 16, 1, 32]);
    expect(v.getUint32(14, true)).toBe(3);
    expect(v.getUint32(18, true)).toBe(6 + 32);
    // A 256 px side is written as 0.
    expect(ico[22]).toBe(0);
    expect(v.getUint32(34, true)).toBe(6 + 32 + 3);
    expect([...ico.slice(38)]).toEqual([1, 2, 3, 4, 5]);
  });
});
