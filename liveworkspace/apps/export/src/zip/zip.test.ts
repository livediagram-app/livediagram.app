import { crc32 as zlibCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { text, unzip } from '../test-support';
import { concat } from '../upload';
import {
  centralHeader,
  crc32,
  DEFLATED,
  directoryBytes,
  dosDateTime,
  endRecord,
  STORED,
  zipFile,
  type ZipEntry,
} from './zip';

const encoder = new TextEncoder();

async function zipOf(
  files: { name: string; data: Uint8Array; store?: boolean }[],
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;
  for (const f of files) {
    const made = await zipFile(f.name, f.data, {
      at: Date.UTC(2026, 10, 1, 12, 30, 15),
      ...(f.store ? { store: true } : {}),
    });
    entries.push({ ...made.entry, offset });
    parts.push(...made.bytes);
    offset += made.length;
  }
  const directory = entries.map(centralHeader);
  const size = directory.reduce((n, d) => n + d.length, 0);
  return concat([...parts, ...directory, endRecord(entries.length, size, offset)]);
}

describe('crc32', () => {
  it('agrees with zlib', () => {
    for (const sample of ['', 'a', 'The quick brown fox', '✓ unicode ✓'.repeat(100)]) {
      const bytes = encoder.encode(sample);
      expect(crc32(bytes)).toBe(zlibCrc32(bytes));
    }
  });
});

describe('dosDateTime', () => {
  it('packs the date and two-second time', () => {
    expect(dosDateTime(Date.UTC(2026, 10, 1, 12, 30, 15))).toEqual({
      time: (12 << 11) | (30 << 5) | 7,
      date: (46 << 9) | (11 << 5) | 1,
    });
  });

  it('starts at 1980', () => {
    expect(dosDateTime(0)).toEqual({ time: 0, date: (1 << 5) | 1 });
  });
});

describe('a zip', () => {
  it('reads back with an independent reader: names, bytes and methods', async () => {
    const json = encoder.encode(
      JSON.stringify({ tabs: Array.from({ length: 200 }, (_, i) => ({ id: i })) }),
    );
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const zip = await zipOf([
      { name: 'README.txt', data: encoder.encode('hello\n'.repeat(50)) },
      { name: 'livediagram/Plan ✓ (A1)/Plan ✓.livediagram', data: json },
      { name: 'livediagram/Plan ✓ (A1)/01 Main.png', data: png, store: true },
      { name: 'empty.json', data: new Uint8Array() },
      { name: 'tiny.txt', data: encoder.encode('x') },
    ]);
    const files = unzip(zip);
    expect([...files.keys()]).toEqual([
      'README.txt',
      'livediagram/Plan ✓ (A1)/Plan ✓.livediagram',
      'livediagram/Plan ✓ (A1)/01 Main.png',
      'empty.json',
      'tiny.txt',
    ]);
    expect(files.get('README.txt')!.method).toBe(DEFLATED);
    expect(text(files.get('livediagram/Plan ✓ (A1)/Plan ✓.livediagram')!.data)).toBe(text(json));
    expect(files.get('livediagram/Plan ✓ (A1)/01 Main.png')).toMatchObject({
      method: STORED,
      data: png,
    });
    // Nothing to deflate, and deflating one byte would grow it: both stored.
    expect(files.get('empty.json')!.method).toBe(STORED);
    expect(files.get('tiny.txt')!.method).toBe(STORED);
    expect([...files.values()].every((f) => f.utf8)).toBe(true);
  });

  it('sizes the directory as it is written', async () => {
    const names = ['a.txt', 'ü/b.txt'];
    const entries = names.map((name) =>
      centralHeader({
        name,
        method: 0,
        crc: 0,
        compressedSize: 0,
        size: 0,
        offset: 0,
        time: 0,
        date: 0,
      }),
    );
    expect(directoryBytes(names)).toBe(entries.reduce((n, e) => n + e.length, 0) + 22);
  });
});
