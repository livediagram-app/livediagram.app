import { describe, expect, it } from 'vitest';
import { findBoards, readBoardFiles, sniffImageType } from './board-export';
import { PNG_BYTES, boardFiles, fileSet, imageNode } from './ms-whiteboard-fixtures';

const utf8 = (s: string) => new TextEncoder().encode(s);

// docs/specs/020-import-export/whiteboard-import.md "The board export".
describe('findBoards', () => {
  it('finds a single board folder, a folder of boards, and boards at the root', () => {
    expect(findBoards(fileSet(boardFiles({}, 'b1')))).toEqual([{ dir: 'b1' }]);
    expect(
      findBoards(
        fileSet(
          boardFiles({}, 'export/b2'),
          boardFiles({}, 'export/b1'),
          new Map([['export/index.md', utf8('#')]]),
        ),
      ),
    ).toEqual([{ dir: 'export/b1' }, { dir: 'export/b2' }]);
    expect(findBoards(fileSet(boardFiles({}, '')))).toEqual([{ dir: '' }]);
  });

  it('ignores a folder missing one of the three board files', () => {
    const files = boardFiles({}, 'b1');
    files.delete('b1/session.json');
    expect(findBoards(fileSet(files))).toEqual([]);
  });
});

describe('readBoardFiles', () => {
  it('reads the title (board record first), modified date, tree, changes and image files', async () => {
    const image = {
      objectId: 'obj-1',
      dataId: 'data-1',
      file: 'obj-1.png',
      bytes: PNG_BYTES,
      image: imageNode({ x: 0, y: 0, w: 1, h: 1, dataId: 'data-1' }),
    };
    const read = await readBoardFiles(
      fileSet(
        boardFiles(
          { id: 'b', title: 'Plans', modified: '2026-03-12T10:00:00Z', images: [image] },
          'b1',
        ),
      ),
      { dir: 'b1' },
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.board).toMatchObject({
      dir: 'b1',
      id: 'b',
      title: 'Plans',
      modified: '2026-03-12T10:00:00Z',
    });
    expect(read.board.changes.length).toBe(1);
    expect(read.board.objects).toEqual(new Map([['obj-1', 'b1/objects/obj-1.png']]));
  });

  it('reads an untitled board without a title', async () => {
    const read = await readBoardFiles(fileSet(boardFiles({ title: null }, 'b1')), { dir: 'b1' });
    expect(read.ok && read.board.title).toBeUndefined();
  });

  it('survives a damaged board record', async () => {
    const files = boardFiles({ title: 'T' }, 'b1');
    files.set('b1/metadata.json', utf8('{ not json'));
    const read = await readBoardFiles(fileSet(files), { dir: 'b1' });
    expect(read.ok && read.board.title).toBe('T');
  });

  it.each([
    ['changes.json', '{ broken'],
    ['changes.json', '{}'],
    ['session.json', '{ "id": "x" }'],
    ['manifest.json', '[]'],
  ])('refuses a board whose %s is %s', async (file, content) => {
    const files = boardFiles({}, 'b1');
    files.set(`b1/${file}`, utf8(content));
    expect(await readBoardFiles(fileSet(files), { dir: 'b1' })).toEqual({
      ok: false,
      rejection: 'board-unreadable',
    });
  });

  it('never points an image outside its board folder', async () => {
    const files = boardFiles({}, 'b1');
    files.set(
      'b1/manifest.json',
      utf8(JSON.stringify({ objects: [{ id: 'x', file: '../../x.png' }] })),
    );
    const read = await readBoardFiles(fileSet(files), { dir: 'b1' });
    expect(read.ok && read.board.objects.size).toBe(0);
  });
});

describe('sniffImageType', () => {
  it.each([
    [PNG_BYTES, 'image/png'],
    [Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
    [utf8('GIF89a'), 'image/gif'],
    [utf8('RIFF0000WEBP'), 'image/webp'],
    [utf8('<svg'), null],
  ])('reads %o as %s', (bytes, type) => {
    expect(sniffImageType(bytes)).toBe(type);
  });
});
