import { describe, expect, it } from 'vitest';
import {
  writeZip,
  ZIP_MAX_BYTES,
  ZIP_MAX_ENTRIES,
  ZipBlobWriter,
  ZipTooLargeError,
} from './zip-writer';

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

// docs/specs/007-editor/pages-mode.md "Export": every page as images in one .zip.
describe('writeZip', () => {
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

// liveknowledge/docs/specs/020-import-export/knowledgebase-export.md "How it is built": a zip an entry at a time.
describe('ZipBlobWriter', () => {
  const when = new Date(2026, 10, 26, 10, 30);
  const files = [
    { name: 'deploys.md', data: new TextEncoder().encode('# Deploys\n') },
    { name: 'deploys/rollbacks.md', data: new TextEncoder().encode('# Rollbacks\n') },
    { name: 'pictures/a.png', data: new Uint8Array([9, 8, 7]) },
  ];

  it('writes the same file writeZip writes, an entry at a time', async () => {
    const writer = new ZipBlobWriter(when);
    for (const f of files) writer.add(f.name, f.data);
    expect(writer.entries).toBe(3);
    expect(writer.bytes).toBe(files.reduce((n, f) => n + 30 + f.name.length + f.data.length, 0));
    const blob = writer.finish();
    expect(blob.type).toBe('application/zip');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([...writeZip(files, when)]);
  });

  it('writes an empty zip as its end record alone', async () => {
    const blob = new ZipBlobWriter(when).finish();
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([...writeZip([], when)]);
  });

  it('refuses an entry past the plain format’s limits, and keeps what it holds', () => {
    const writer = new ZipBlobWriter(when);
    writer.add('a', new Uint8Array(1));
    const huge = { length: ZIP_MAX_BYTES } as unknown as Uint8Array;
    expect(() => writer.add('b', huge)).toThrow(ZipTooLargeError);
    expect(writer.entries).toBe(1);
    const many = new ZipBlobWriter(when);
    (many as unknown as { count: number }).count = ZIP_MAX_ENTRIES;
    expect(() => many.add('c', new Uint8Array(1))).toThrow('4 GB or 65,535 files');
  });
});
