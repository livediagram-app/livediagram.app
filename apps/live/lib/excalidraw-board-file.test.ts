import { describe, expect, it, vi } from 'vitest';

vi.mock('./telemetry', () => ({ track: vi.fn() }));
import {
  EXCALIDRAW_BOARD_NAME,
  EXCALIDRAW_NOT_A_SCENE,
  excalidrawFileIdentity,
  readExcalidrawBoardFiles,
} from './excalidraw-board-file';
import { excalidrawBuilder, excalidrawText } from './excalidraw-fixtures';
import { importBoardsAsDocuments, type NewBoardDocument } from './board-scene-import';

// docs/specs/020-import-export/excalidraw-import-export.md "Import as new documents": each picked
// file is a board named and dated after the file.

const MODIFIED = Date.UTC(2026, 3, 20, 9, 30);
const local = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(y, mo - 1, d, h, mi).toISOString();

describe('excalidrawFileIdentity', () => {
  it.each([
    ['Sprint plan.excalidraw', 'Sprint plan'],
    ['Sprint plan.excalidraw.png', 'Sprint plan'],
    ['Sprint plan.EXCALIDRAW.SVG', 'Sprint plan'],
    ['diagram.png', 'diagram'],
    ['diagram.svg', 'diagram'],
    ['scene.json', 'scene'],
    ['  spaced .excalidraw', 'spaced'],
    ['no-extension', 'no-extension'],
  ])('names %s as %s, created and modified at the file date', (name, title) => {
    const iso = new Date(MODIFIED).toISOString();
    expect(excalidrawFileIdentity(name, MODIFIED)).toEqual({
      title,
      createdAt: iso,
      modifiedAt: iso,
    });
  });

  it("turns Excalidraw's default name into a dated board name, created at that moment", () => {
    expect(excalidrawFileIdentity('Untitled-2026-04-12-1430.excalidraw', MODIFIED)).toEqual({
      title: `${EXCALIDRAW_BOARD_NAME}, 12 Apr 2026`,
      createdAt: local(2026, 4, 12, 14, 30),
      modifiedAt: new Date(MODIFIED).toISOString(),
    });
  });

  it('keeps a default-looking name that is not a real date as it is', () => {
    expect(excalidrawFileIdentity('Untitled-2026-13-40-2599.excalidraw', MODIFIED).title).toBe(
      'Untitled-2026-13-40-2599',
    );
  });

  it('names a nameless file after Excalidraw', () => {
    expect(excalidrawFileIdentity('.excalidraw', MODIFIED).title).toBe(EXCALIDRAW_BOARD_NAME);
  });

  it.each([[0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'takes no date from a file date of %s',
    (lastModified) => {
      expect(excalidrawFileIdentity('board.excalidraw', lastModified)).toEqual({ title: 'board' });
      expect(excalidrawFileIdentity('Untitled-2026-04-12-1430.excalidraw', lastModified)).toEqual({
        title: `${EXCALIDRAW_BOARD_NAME}, 12 Apr 2026`,
        createdAt: local(2026, 4, 12, 14, 30),
      });
    },
  );
});

describe('readExcalidrawBoardFiles', () => {
  const file = (body: BlobPart, name: string, type = '') =>
    new File([body], name, { type, lastModified: MODIFIED });
  const saved = () =>
    excalidrawText([excalidrawBuilder().rectangle(), excalidrawBuilder().ellipse()], {
      type: 'excalidraw',
    });

  it('reads each file into a named, dated scene, in pick order', async () => {
    const r = await readExcalidrawBoardFiles([
      file(saved(), 'First.excalidraw'),
      file(excalidrawText([excalidrawBuilder().diamond()]), 'Untitled-2026-04-12-1430.excalidraw'),
    ]);
    expect(r.failures).toEqual([]);
    expect(r.containers).toEqual(['json', 'json']);
    expect(r.scenes.map((s) => [s.title, s.items.length, s.source])).toEqual([
      ['First', 2, 'excalidraw'],
      [`${EXCALIDRAW_BOARD_NAME}, 12 Apr 2026`, 1, 'excalidraw'],
    ]);
    expect(r.scenes[0]).toMatchObject({
      sourceId: 'excalidraw:First.excalidraw',
      createdAt: new Date(MODIFIED).toISOString(),
      modifiedAt: new Date(MODIFIED).toISOString(),
    });
  });

  it('lists the files it cannot read, with their reasons, and keeps the rest', async () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 73, 69, 78, 68, 0, 0, 0, 0,
    ]);
    const r = await readExcalidrawBoardFiles([
      file(png, 'photo.png', 'image/png'),
      file('nope', 'broken.excalidraw'),
      file('{"type":"other","elements":[]}', 'other.json'),
      file(saved(), 'Good.excalidraw'),
    ]);
    expect(r.scenes.map((s) => s.title)).toEqual(['Good']);
    expect(r.failures).toEqual([
      { title: 'photo', message: EXCALIDRAW_NOT_A_SCENE },
      { title: 'broken', message: "File isn't valid JSON." },
      { title: 'other', message: expect.stringContaining('Excalidraw scene') },
    ]);
  });

  it('turns away a file of another kind without reading it', async () => {
    const text = file('hello', 'notes.txt', 'text/plain');
    text.arrayBuffer = () => Promise.reject(new Error('should not be read'));
    const r = await readExcalidrawBoardFiles([text]);
    expect(r.failures).toEqual([{ title: 'notes.txt', message: EXCALIDRAW_NOT_A_SCENE }]);
  });

  it('never throws on a file that cannot be read at all', async () => {
    const unreadable = file(saved(), 'Gone.excalidraw');
    unreadable.arrayBuffer = () => Promise.reject(new Error('NotReadableError'));
    const r = await readExcalidrawBoardFiles([unreadable]);
    expect(r).toEqual({
      scenes: [],
      containers: [],
      failures: [{ title: 'Gone', message: "This file couldn't be read." }],
    });
  });
});

describe('an Excalidraw file as a new document', () => {
  it('lands as one whiteboard document, named and dated after the file', async () => {
    const b = excalidrawBuilder();
    const text = excalidrawText([b.rectangle(), b.text('Hello')], {
      type: 'excalidraw',
      appState: { viewBackgroundColor: '#ffffff', gridModeEnabled: false },
    });
    const { scenes } = await readExcalidrawBoardFiles([
      new File([text], 'Untitled-2026-04-12-1430.excalidraw', { lastModified: MODIFIED }),
    ]);
    const created: NewBoardDocument[] = [];
    const outcome = await importBoardsAsDocuments(scenes, {
      ownerId: 'me',
      offline: false,
      createDocument: async (doc) => {
        created.push(doc);
      },
      hugText: async (els) => els,
    });
    expect(outcome.status).toBe('done');
    expect(created).toHaveLength(1);
    const [doc] = created;
    expect(doc).toMatchObject({
      name: `${EXCALIDRAW_BOARD_NAME}, 12 Apr 2026`,
      createdAt: new Date(2026, 3, 12, 14, 30).getTime(),
      savedAt: MODIFIED,
    });
    expect(doc!.tabs).toHaveLength(1);
    expect(doc!.tabs[0]).toMatchObject({ kind: 'whiteboard' });
    expect(doc!.tabs[0]!.backgroundColor).toBeUndefined();
    expect(doc!.tabs[0]!.elements.map((e) => e.type)).toEqual(['shape', 'text']);
    // Valid dates: nothing reported about them.
    expect(outcome.status === 'done' && outcome.scene?.degraded).toEqual([]);
  });
});
