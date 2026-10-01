import { describe, expect, it, vi } from 'vitest';
import { MESSAGES, UNTITLED_BOARD, boardSceneOf, listBoards } from './import';
import {
  PNG_BYTES,
  boardFiles,
  fileSet,
  imageNode,
  inkGroup,
  shapeNode,
} from './ms-whiteboard-fixtures';

vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const ink = () =>
  inkGroup({
    x: 0,
    y: 0,
    strokes: [
      {
        colour: '#000000',
        stroke: {
          width: 512,
          points: [
            { x: 0, y: 0 },
            { x: 128, y: 0 },
          ],
        },
      },
    ],
  });

// docs/specs/020-import-export/whiteboard-import.md "Importing in the dialog".
describe('listBoards', () => {
  it('lists boards newest first with title (or Untitled board), date and element count', async () => {
    const listed = await listBoards(
      fileSet(
        boardFiles({ title: 'Older', modified: '2026-01-01T00:00:00Z', elements: [ink()] }, 'x/a'),
        boardFiles(
          {
            title: null,
            modified: '2026-03-01T00:00:00Z',
            elements: [ink(), shapeNode({ x: 0, y: 0, w: 10, h: 10 })],
          },
          'x/b',
        ),
      ),
    );
    if (!listed.ok) throw new Error(listed.error);
    expect(listed.boards.map((b) => [b.title, b.modified, b.elementCount])).toEqual([
      [UNTITLED_BOARD, '2026-03-01T00:00:00Z', 2],
      ['Older', '2026-01-01T00:00:00Z', 1],
    ]);
    expect(listed.failures).toEqual([]);
  });

  it('refuses a pick with no boards', async () => {
    expect(await listBoards(fileSet(new Map([['notes.txt', new Uint8Array()]])))).toEqual({
      ok: false,
      error: MESSAGES.noBoards,
    });
  });

  it('lists an unreadable board as a failure and keeps the rest', async () => {
    const broken = boardFiles({}, 'broken');
    broken.set('broken/changes.json', new TextEncoder().encode('{'));
    const listed = await listBoards(fileSet(broken, boardFiles({ title: 'Fine' }, 'fine')));
    if (!listed.ok) throw new Error(listed.error);
    expect(listed.boards.map((b) => b.title)).toEqual(['Fine']);
    expect(listed.failures).toEqual([{ title: 'broken', message: MESSAGES.unreadable }]);
  });
});

describe('boardSceneOf', () => {
  it('builds the scene with its title, id and images read from the pick', async () => {
    const image = {
      objectId: 'obj-1',
      dataId: 'data-1',
      file: 'obj-1.png',
      bytes: PNG_BYTES,
      image: imageNode({ x: 0, y: 0, w: 10, h: 10, dataId: 'data-1' }),
    };
    const files = fileSet(
      boardFiles({ id: 'b1', title: 'Pics', elements: [ink()], images: [image] }, 'b'),
    );
    const listed = await listBoards(files);
    if (!listed.ok) throw new Error(listed.error);
    const scene = await boardSceneOf(files, listed.boards[0]!);
    expect(scene).toMatchObject({
      source: 'microsoft-whiteboard',
      title: 'Pics',
      sourceId: 'microsoft-whiteboard:b1',
    });
    expect(scene.items.map((i) => i.kind)).toEqual(['ink', 'image']);
    expect(scene.assets).toEqual([
      { key: 'obj-1', source: { kind: 'bytes', bytes: PNG_BYTES, mimeType: 'image/png' } },
    ]);
  });

  it('leaves an untitled board untitled, and notes an image whose file is not an image', async () => {
    const image = {
      objectId: 'o',
      dataId: 'd',
      file: 'o.png',
      bytes: new Uint8Array([1, 2]),
      image: imageNode({ x: 0, y: 0, w: 1, h: 1, dataId: 'd' }),
    };
    const files = fileSet(boardFiles({ title: null, images: [image] }, 'b'));
    const listed = await listBoards(files);
    if (!listed.ok) throw new Error(listed.error);
    const scene = await boardSceneOf(files, listed.boards[0]!);
    expect(scene.title).toBeUndefined();
    expect(scene.items).toEqual([]);
    expect(scene.notes.map((n) => n.count)).toEqual([1]);
  });
});
