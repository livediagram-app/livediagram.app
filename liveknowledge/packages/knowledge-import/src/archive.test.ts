import { describe, expect, it } from 'vitest';
import { archiveOf } from './__fixtures__/archive';
import { ImportSizeError, listArchive, readText, zipEntries } from './archive';
import { DEFAULT_LIMITS } from './limits';

describe('listArchive', () => {
  it('lists every file once, by its normalised path, without reading any', async () => {
    const archive = archiveOf({ 'docs\\a.md': 'a', 'docs/A.md': 'again', 'docs/b.png': 3 });
    const listing = await listArchive(archive, DEFAULT_LIMITS);
    expect([...listing.files.values()].map((f) => [f.path, f.size])).toEqual([
      ['docs/a.md', 1],
      ['docs/b.png', 3],
    ]);
    expect(listing.tooLarge).toBe(false);
    expect(archive.reads).toEqual([]);
  });

  it('skips a path that leads outside the archive, and says so', async () => {
    const listing = await listArchive(
      archiveOf({ '../../etc/passwd': 'x', 'a.md': 'a' }),
      DEFAULT_LIMITS,
    );
    expect([...listing.files.keys()]).toEqual(['a.md']);
    expect(listing.skipped).toEqual([
      {
        path: '../../etc/passwd',
        reason: 'outside-archive',
        detail: 'Its path leads outside the archive.',
      },
    ]);
  });

  it('passes over folder entries and what macOS adds', async () => {
    const listing = await listArchive(
      [
        { path: 'docs/', read: async () => new Uint8Array() },
        { path: '__MACOSX/docs/._a.md', read: async () => new Uint8Array() },
        { path: 'docs/.DS_Store', read: async () => new Uint8Array() },
        { path: 'docs/a.md', read: async () => new Uint8Array() },
      ],
      DEFAULT_LIMITS,
    );
    expect([...listing.files.values()]).toMatchObject([{ path: 'docs/a.md', size: null }]);
    expect(listing.skipped).toEqual([]);
  });

  it('stops at the archive size limit', async () => {
    const listing = await listArchive(archiveOf({ 'a.md': 6, 'b.md': 6 }), {
      ...DEFAULT_LIMITS,
      archiveBytes: 10,
    });
    expect(listing.tooLarge).toBe(true);
    expect([...listing.files.keys()]).toEqual(['a.md']);
  });

  it('stops at the file count limit', async () => {
    const listing = await listArchive(archiveOf({ 'a.md': 'a', 'b.md': 'b' }), {
      ...DEFAULT_LIMITS,
      entries: 1,
    });
    expect(listing.tooLarge).toBe(true);
  });

  it('reads an archive that arrives entry by entry', async () => {
    async function* stream() {
      yield* archiveOf({ 'a.md': 'a' });
    }
    expect((await listArchive(stream(), DEFAULT_LIMITS)).files.size).toBe(1);
  });
});

describe('readText', () => {
  it('reads UTF-8 and drops a byte order mark', async () => {
    const [file] = archiveOf({ 'a.md': '﻿café' });
    expect(await readText({ ...file!, size: null }, 100)).toBe('café');
  });

  it('refuses a file past the limit, by its declared size without reading it', async () => {
    const archive = archiveOf({ 'a.md': 20 });
    await expect(readText({ ...archive[0]!, size: 20 }, 10)).rejects.toThrow(ImportSizeError);
    expect(archive.reads).toEqual([]);
  });

  it('refuses a file that turns out larger than it declared', async () => {
    const [file] = archiveOf({ 'a.md': 2 * 1024 * 1024 });
    await expect(readText({ ...file!, size: null }, 1024 * 1024)).rejects.toThrow(
      'a.md is larger than 1 MB',
    );
  });
});

describe('zipEntries', () => {
  it("offers a zip reader's entries as an archive, each read capped by the reader", async () => {
    const asked: [string, number][] = [];
    const entries = zipEntries(
      {
        names: () => ['a.md', 'gone.md'],
        read: async (name, max) => {
          asked.push([name, max]);
          return name === 'a.md' ? new Uint8Array([104, 105]) : null;
        },
      },
      50,
    );
    expect(entries.map((e) => e.path)).toEqual(['a.md', 'gone.md']);
    expect(await entries[0]!.read()).toEqual(new Uint8Array([104, 105]));
    expect(await entries[1]!.read()).toEqual(new Uint8Array());
    expect(asked).toEqual([
      ['a.md', 50],
      ['gone.md', 50],
    ]);
  });

  it('carries the sizes a reader declares, and none for an entry it does not know', () => {
    const entries = zipEntries(
      {
        names: () => ['a.md', 'b.md'],
        read: async () => null,
        size: (name) => (name === 'a.md' ? 12 : null),
      },
      50,
    );
    expect(entries.map((e) => e.size)).toEqual([12, undefined]);
  });
});
