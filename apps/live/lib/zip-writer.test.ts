import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, writeZip } from './zip-writer';

// Walks a stored-only Zip's local headers: each entry's name and bytes, in order.
function readStored(zip: Uint8Array): { name: string; data: number[] }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out: { name: string; data: number[] }[] = [];
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const nameStart = at + 30;
    const dataStart = nameStart + nameLength;
    out.push({
      name: new TextDecoder().decode(zip.subarray(nameStart, dataStart)),
      data: [...zip.subarray(dataStart, dataStart + size)],
    });
    at = dataStart + size;
  }
  return out;
}

describe('writeZip', () => {
  it('computes the standard CRC-32', () => {
    const data = new TextEncoder().encode('The quick brown fox');
    expect(crc32(data)).toBe(nodeCrc32(data));
  });

  it('writes stored entries that read back, names and bytes intact', () => {
    const files = [
      { name: '01 Intro.png', data: new Uint8Array([1, 2, 3, 4]) },
      { name: '02 Café · A4.svg', data: new TextEncoder().encode('<svg/>') },
    ];
    const zip = writeZip(files);
    expect(readStored(zip)).toEqual(files.map((f) => ({ name: f.name, data: [...f.data] })));
    // The end-of-central-directory record counts every entry.
    const end = new DataView(zip.buffer, zip.byteLength - 22);
    expect(end.getUint32(0, true)).toBe(0x06054b50);
    expect(end.getUint16(10, true)).toBe(files.length);
  });
});
