import { describe, expect, it } from 'vitest';
import { writeZip } from '@/lib/zip-writer-fixture';
import { findBoards } from './board-export';
import { fileSetFromFiles, fileSetFromZip } from './file-sets';
import { boardFiles } from './ms-whiteboard-fixtures';

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe('fileSetFromZip', () => {
  it('lists files (directories skipped, Windows separators normalised) and reads them lazily', async () => {
    const board = boardFiles({ title: 'Z' }, 'export/b1');
    const zip = writeZip([
      { name: 'export/', data: '' },
      ...[...board].map(([name, data], i) => ({
        name: name.replace(/\//g, '\\'),
        data,
        method: i % 2 ? ('deflate' as const) : ('stored' as const),
      })),
    ]);
    const set = fileSetFromZip(zip);
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(findBoards(set.files)).toEqual([{ dir: 'export/b1' }]);
    expect(text(await set.files.get('export/b1/metadata.json')!())).toContain('"Z"');
  });

  it('refuses a damaged zip', () => {
    expect(fileSetFromZip(new Uint8Array(30))).toEqual({ ok: false, rejection: 'zip-damaged' });
  });

  it('rejects an encrypted entry when read', async () => {
    const set = fileSetFromZip(writeZip([{ name: 'b/changes.json', data: '[]', encrypted: true }]));
    if (!set.ok) throw new Error('listed');
    await expect(set.files.get('b/changes.json')!()).rejects.toMatchObject({
      refusal: 'zip-encrypted',
    });
  });
});

describe('fileSetFromFiles', () => {
  it('keeps board files and images, not screenshots or sync frames', async () => {
    const blob = (s: string) => new Blob([s]);
    const set = fileSetFromFiles([
      { path: 'b1/changes.json', file: blob('[]') },
      { path: 'b1/sync-frames.jsonl', file: blob('{}') },
      { path: 'b1/screenshot.png', file: blob('png') },
      { path: 'b1/objects/x.png', file: blob('png') },
    ]);
    if (!set.ok) throw new Error('refused');
    expect([...set.files.keys()]).toEqual(['b1/changes.json', 'b1/objects/x.png']);
    expect(text(await set.files.get('b1/changes.json')!())).toBe('[]');
  });
});
