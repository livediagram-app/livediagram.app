import { describe, expect, it } from 'vitest';
import { writeZip } from './zip-writer-fixture';
import { ByteBudget, listZip, readZipEntry } from './zip-reader';

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('listZip', () => {
  it('lists stored entries with their names', () => {
    const zip = writeZip([
      { name: 'board/changes.json', data: '<html></html>' },
      { name: 'board/manifest.json', data: '{}' },
    ]);
    const listed = listZip(zip);
    expect(listed.ok && listed.entries.map((e) => e.name)).toEqual([
      'board/changes.json',
      'board/manifest.json',
    ]);
  });

  it('refuses bytes without an end record as damaged', () => {
    expect(listZip(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toEqual({
      ok: false,
      refusal: 'zip-damaged',
    });
  });

  it('refuses a central directory that runs past the file', () => {
    const zip = writeZip([{ name: 'a.json', data: 'x' }]);
    expect(listZip(zip.subarray(0, zip.length - 30))).toEqual({
      ok: false,
      refusal: 'zip-damaged',
    });
  });

  it('refuses Zip64 markers as damaged', () => {
    const zip = writeZip([{ name: 'a.json', data: 'x' }]);
    // The end record's entry count, set to Zip64's 0xFFFF marker.
    zip.set([0xff, 0xff], zip.length - 12);
    expect(listZip(zip)).toEqual({ ok: false, refusal: 'zip-damaged' });
  });
});

describe('readZipEntry', () => {
  const budget = () => new ByteBudget(1024 * 1024);

  it('reads a stored entry', async () => {
    const zip = writeZip([{ name: 'a.json', data: 'hello board' }]);
    const listed = listZip(zip);
    if (!listed.ok) throw new Error('listing failed');
    const read = await readZipEntry(zip, listed.entries[0]!, budget());
    expect(read.ok && text(read.bytes)).toBe('hello board');
  });

  it('inflates a deflated entry (a re-zipped export)', async () => {
    const body = 'ink '.repeat(1000);
    const zip = writeZip([{ name: 'a.json', data: body, method: 'deflate' }]);
    const listed = listZip(zip);
    if (!listed.ok) throw new Error('listing failed');
    const read = await readZipEntry(zip, listed.entries[0]!, budget());
    expect(read.ok && text(read.bytes)).toBe(body);
  });

  it('refuses an encrypted entry', async () => {
    const zip = writeZip([{ name: 'a.json', data: 'x', encrypted: true }]);
    const listed = listZip(zip);
    if (!listed.ok) throw new Error('listing failed');
    expect(await readZipEntry(zip, listed.entries[0]!, budget())).toEqual({
      ok: false,
      refusal: 'zip-encrypted',
    });
  });

  it('refuses an entry whose inflated size passes the budget', async () => {
    const zip = writeZip([{ name: 'a.json', data: 'a'.repeat(50_000), method: 'deflate' }]);
    const listed = listZip(zip);
    if (!listed.ok) throw new Error('listing failed');
    expect(await readZipEntry(zip, listed.entries[0]!, new ByteBudget(10_000))).toEqual({
      ok: false,
      refusal: 'too-large',
    });
  });

  it('refuses an unknown compression method as damaged', async () => {
    const zip = writeZip([{ name: 'a.json', data: 'x' }]);
    const listed = listZip(zip);
    if (!listed.ok) throw new Error('listing failed');
    expect(await readZipEntry(zip, { ...listed.entries[0]!, method: 12 }, budget())).toEqual({
      ok: false,
      refusal: 'zip-damaged',
    });
  });

  it('refuses corrupt deflate data as damaged', async () => {
    const zip = writeZip([{ name: 'a.json', data: 'x'.repeat(100), method: 'deflate' }]);
    const listed = listZip(zip);
    if (!listed.ok) throw new Error('listing failed');
    const entry = listed.entries[0]!;
    // Overwrite the deflate stream (after the 30-byte local header and name) with junk.
    zip.fill(0xff, 30 + entry.name.length, 30 + entry.name.length + entry.compressedSize);
    expect(await readZipEntry(zip, entry, budget())).toEqual({
      ok: false,
      refusal: 'zip-damaged',
    });
  });
});
