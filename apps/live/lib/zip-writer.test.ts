import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ByteBudget, listZip, readZipEntry } from './zip-reader';
import { crc32, writeZip } from './zip-writer';

// docs/specs/007-editor/infographic-pages.md "Export": every page as images in one .zip.
describe('writeZip', () => {
  it('computes the standard CRC-32', () => {
    const data = new TextEncoder().encode('The quick brown fox');
    expect(crc32(data)).toBe(nodeCrc32(data));
  });

  it('writes stored entries the reader reads back, names and bytes intact', async () => {
    const files = [
      { name: '01 Intro.png', data: new Uint8Array([1, 2, 3, 4]) },
      { name: '02 Café · A4.svg', data: new TextEncoder().encode('<svg/>') },
    ];
    const zip = writeZip(files);
    const listed = listZip(zip);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.entries.map((e) => e.name)).toEqual(files.map((f) => f.name));
    const budget = new ByteBudget(1_000_000);
    for (const [i, entry] of listed.entries.entries()) {
      const read = await readZipEntry(zip, entry, budget);
      expect(read.ok && [...read.bytes]).toEqual([...files[i]!.data]);
    }
  });
});
