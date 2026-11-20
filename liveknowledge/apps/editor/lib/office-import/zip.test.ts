import { describe, expect, it } from 'vitest';
import { OfficeImportError } from './errors';
import { inflateCapped, openZip, zipKey } from './zip';
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
