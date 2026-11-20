import { describe, expect, it } from 'vitest';
import { OfficeImportError } from './errors';
import { inflateCapped, openZip, openZipFile, zipKey } from './zip';
import { makeZip } from './test-fixtures';

const text = (b: Uint8Array | null) => new TextDecoder().decode(b ?? new Uint8Array());

async function failureOf(run: () => unknown): Promise<string | undefined> {
  try {
    await run();
  } catch (error) {
    return error instanceof OfficeImportError ? error.failure : 'other';
  }
  return undefined;
}

describe('openZip', () => {
  it('reads stored and deflated entries, names compared case-insensitively', async () => {
    for (const store of [true, false]) {
      const zip = openZip(
        await makeZip({ 'Word/Document.xml': '<a/>', 'x.txt': 'hello' }, { store }),
      );
      expect(zip.names().sort()).toEqual(['word/document.xml', 'x.txt']);
      expect(zip.has('/word/document.xml')).toBe(true);
      expect(text(await zip.read('word\\DOCUMENT.xml', 100))).toBe('<a/>');
      expect(await zip.read('missing', 100)).toBeNull();
    }
  });

  it('keeps the first of two entries with the same name', async () => {
    const a = await makeZip({ 'a.txt': 'first' }, { store: true });
    const b = await makeZip({ 'A.TXT': 'second' }, { store: true });
    // Two archives' entries spliced into one central directory is fiddly; check the rule through names instead.
    expect(zipKey('A.TXT')).toBe(zipKey('a.txt'));
    expect(text(await openZip(a).read('a.txt', 100))).toBe('first');
    expect(text(await openZip(b).read('a.txt', 100))).toBe('second');
  });

  it('refuses what is not a zip, or a truncated one', async () => {
    expect(await failureOf(() => openZip(new Uint8Array(10)))).toBe('not-a-package');
    expect(await failureOf(() => openZip(new TextEncoder().encode('x'.repeat(100))))).toBe(
      'not-a-package',
    );
    const good = await makeZip({ 'a.txt': 'hello' });
    // The central directory pointing past the end record.
    const bad = good.slice();
    new DataView(bad.buffer).setUint32(bad.length - 6, bad.length, true);
    expect(await failureOf(() => openZip(bad))).toBe('not-a-package');
    // ZIP64 markers.
    const z64 = good.slice();
    new DataView(z64.buffer).setUint16(z64.length - 12, 0xffff, true);
    expect(await failureOf(() => openZip(z64))).toBe('not-a-package');
  });

  it('refuses a local header out of place, an encrypted entry and an unknown method', async () => {
    const good = await makeZip({ 'a.txt': 'hello' }, { store: true });
    const moved = good.slice();
    new DataView(moved.buffer).setUint32(0, 0, true);
    expect(await failureOf(() => openZip(moved).read('a.txt', 100))).toBe('not-a-package');
    const centralAt = good.length - 22 - (46 + 5);
    const encrypted = good.slice();
    new DataView(encrypted.buffer).setUint16(centralAt + 8, 0x801, true);
    expect(await failureOf(() => openZip(encrypted).read('a.txt', 100))).toBe('not-a-package');
    const lzma = good.slice();
    new DataView(lzma.buffer).setUint16(centralAt + 10, 14, true);
    expect(await failureOf(() => openZip(lzma).read('a.txt', 100))).toBe('not-a-package');
  });

  it('refuses more entries than an import takes', async () => {
    const files = Object.fromEntries(Array.from({ length: 4001 }, (_, i) => [`f${i}`, '']));
    expect(await failureOf(async () => openZip(await makeZip(files, { store: true })))).toBe(
      'unpacks-too-large',
    );
  });

  it('stops a stored or deflated entry at its cap, whatever it claims', async () => {
    const stored = openZip(await makeZip({ 'a.txt': 'x'.repeat(1000) }, { store: true }));
    expect(await failureOf(() => stored.read('a.txt', 999))).toBe('unpacks-too-large');
    // A small bomb: a megabyte of one byte deflates to about a kilobyte.
    const bomb = openZip(await makeZip({ 'bomb.xml': 'a'.repeat(1024 * 1024) }));
    expect(await failureOf(() => bomb.read('bomb.xml', 64 * 1024))).toBe('unpacks-too-large');
    expect((await bomb.read('bomb.xml', 2 * 1024 * 1024))!.byteLength).toBe(1024 * 1024);
  });

  it('refuses broken deflate data', async () => {
    expect(
      await failureOf(() => inflateCapped(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 100)),
    ).toBe('not-a-package');
  });
});

describe('openZip, names as written', () => {
  it('keeps each name as the archive spells it, and tells apart names that differ only in case', async () => {
    const zip = openZip(await makeZip({ 'Docs/Read Me.md': 'one', 'docs/read me.md': 'two' }), {
      names: 'as-written',
    });
    expect(zip.names()).toEqual(['Docs/Read Me.md', 'docs/read me.md']);
    expect(text(await zip.read('Docs/Read Me.md', 100))).toBe('one');
    expect(text(await zip.read('docs/read me.md', 100))).toBe('two');
    expect(zip.has('DOCS/READ ME.MD')).toBe(false);
    expect(zip.size('Docs/Read Me.md')).toBe(3);
    expect(zip.size('missing')).toBeNull();
  });

  it('holds the archive to the caps it is opened with', async () => {
    const bytes = await makeZip({ 'a.txt': 'aaaa', 'b.txt': 'bbbb' }, { store: true });
    expect(await failureOf(() => openZip(bytes, { maxEntries: 1 }))).toBe('unpacks-too-large');
    const zip = openZip(bytes, { maxUnpackedBytes: 6 });
    expect(text(await zip.read('a.txt', 100))).toBe('aaaa');
    // Four of the six are spent: the second entry no longer fits.
    expect(await failureOf(() => zip.read('b.txt', 100))).toBe('unpacks-too-large');
  });

  it('leaves an Office package as it was: names folded, its own caps', async () => {
    const zip = openZip(await makeZip({ 'Word/Document.xml': '<a/>' }));
    expect(zip.names()).toEqual(['word/document.xml']);
    expect(zip.size('WORD/document.xml')).toBe(4);
  });
});

describe('openZipFile', () => {
  it('reads the same entries from the file as from its bytes, stored and deflated', async () => {
    for (const store of [true, false]) {
      const bytes = await makeZip({ 'A/One.md': 'first page', 'A/two.md': 'second' }, { store });
      const zip = await openZipFile(new Blob([bytes as BlobPart]), { names: 'as-written' });
      expect(zip.names()).toEqual(['A/One.md', 'A/two.md']);
      expect(text(await zip.read('A/One.md', 100))).toBe('first page');
      expect(text(await zip.read('A/two.md', 100))).toBe('second');
      expect(await zip.read('a/one.md', 100)).toBeNull();
    }
  });

  it('reads a directory longer than the tail of the file that is read first', async () => {
    // 2,000 entries make a directory of about 150 KB: it starts before the last 64 KB, so it is read on its own.
    const files: Record<string, string> = {};
    for (let i = 0; i < 2000; i++) files[`knowledgebase/section/page-${i}.md`] = `Page ${i}`;
    const bytes = await makeZip(files, { store: true });
    const blob = new Blob([bytes as BlobPart]);
    const reads: number[] = [];
    const slice = blob.slice.bind(blob);
    blob.slice = (start?: number, end?: number) => {
      reads.push((end ?? blob.size) - (start ?? 0));
      return slice(start, end);
    };
    const zip = await openZipFile(blob, { names: 'as-written' });
    expect(zip.names()).toHaveLength(2000);
    // The tail, then the directory: never the whole file.
    expect(reads).toHaveLength(2);
    expect(reads[0]! + reads[1]!).toBeLessThan(bytes.byteLength);
    expect(text(await zip.read('knowledgebase/section/page-0.md', 100))).toBe('Page 0');
    expect(text(await zip.read('knowledgebase/section/page-1999.md', 100))).toBe('Page 1999');
  });

  it('refuses what is no zip, and an entry whose bytes are cut off', async () => {
    expect(await failureOf(() => openZipFile(new Blob([new Uint8Array(10)])))).toBe(
      'not-a-package',
    );
    expect(await failureOf(() => openZipFile(new Blob([new Uint8Array(4000)])))).toBe(
      'not-a-package',
    );
    const bytes = await makeZip({ 'a.txt': 'hello' }, { store: true });
    const moved = bytes.slice();
    // The local header's signature broken: the directory still lists the entry.
    moved[0] = 0;
    const zip = await openZipFile(new Blob([moved]));
    expect(await failureOf(() => zip.read('a.txt', 100))).toBe('not-a-package');
  });
});
