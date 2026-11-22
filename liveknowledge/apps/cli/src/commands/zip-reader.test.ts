import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { openZip, ZipFormatError } from './zip-reader';
import { zipOf } from '../testing/zip';

describe('openZip', () => {
  const files = { 'docs/a.md': '# A\n', 'docs/b.md': 'B'.repeat(4000) };

  it('lists the entries and reads each, stored or deflated', async () => {
    for (const deflate of [false, true]) {
      const zip = openZip(zipOf(files, { deflate }), 100);
      expect(zip.names()).toEqual(['docs/a.md', 'docs/b.md']);
      expect(zip.size!('docs/b.md')).toBe(4000);
      expect(zip.size!('nope')).toBeNull();
      expect(new TextDecoder().decode((await zip.read('docs/a.md', 1000))!)).toBe('# A\n');
      expect((await zip.read('docs/b.md', 5000))!.length).toBe(4000);
      expect(await zip.read('nope', 1000)).toBeNull();
    }
  });

  it('stops at the cap, whatever size the file declares', async () => {
    expect(await openZip(zipOf(files, { deflate: true }), 100).read('docs/b.md', 100)).toBeNull();
    expect(await openZip(zipOf(files, { deflate: false }), 100).read('docs/b.md', 100)).toBeNull();
  });

  it('stops every read once the bytes unpacked in all pass the budget', async () => {
    // Many small bombs: each under the per-entry cap, together past the budget.
    const bombs = Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`b${i}.md`, 'x'.repeat(3000)]),
    );
    for (const deflate of [false, true]) {
      const zip = openZip(zipOf(bombs, { deflate }), 100, 7000);
      const read = [];
      for (const name of zip.names()) read.push(await zip.read(name, 5000));
      expect(read.map((r) => r?.length ?? null)).toEqual([3000, 3000, null, null, null]);
    }
  });

  it('reads an encrypted entry, one packed another way and a damaged one as missing', async () => {
    expect(await openZip(zipOf(files, { flags: 1 }), 100).read('docs/a.md', 1000)).toBeNull();
    expect(await openZip(zipOf(files, { method: 12 }), 100).read('docs/a.md', 1000)).toBeNull();
    const garbled = zipOf({ 'a.md': 'x'.repeat(200) }, { deflate: true });
    // The entry's packed bytes sit after its 30 byte header and its name.
    garbled.fill(0xff, 30 + 4, 30 + 4 + deflateRawSync('x'.repeat(200)).length);
    expect(await openZip(garbled, 100).read('a.md', 1000)).toBeNull();
    const badLocal = zipOf({ 'a.md': 'x' });
    badLocal[0] = 0;
    expect(await openZip(badLocal, 100).read('a.md', 1000)).toBeNull();
  });

  it('refuses what is no zip, a damaged directory and too many files', async () => {
    expect(() => openZip(new TextEncoder().encode('not a zip at all, just text'), 100)).toThrow(
      ZipFormatError,
    );
    expect(() => openZip(new Uint8Array(4), 100)).toThrow('not a zip file');
    expect(() => openZip(zipOf(files), 1)).toThrow('more than 1 files');
    const damaged = zipOf(files);
    // The central directory's first signature.
    const at = damaged.length - 22 - (46 + 9) * 2;
    damaged[at] = 0;
    expect(() => openZip(damaged, 100)).toThrow('a damaged zip file');
    const cut = zipOf({ 'a.md': 'x'.repeat(50) });
    // The entry's packed size says more than the file holds.
    new DataView(cut.buffer).setUint32(cut.length - 22 - (46 + 4) + 20, 5000, true);
    expect(await openZip(cut, 100).read('a.md', 10_000)).toBeNull();
  });
});
