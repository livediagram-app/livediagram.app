// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { anchor, boardHtml } from './__fixtures__/board-markup';
import { writeZip } from './__fixtures__/zip-writer';
import { readWhiteboardFile } from './envelope';

const board = boardHtml([
  anchor({ apikey: 'a', type: 'Note', left: 0, top: 0, content: '<p>hi</p>' }),
]);
const bytes = (text: string) => new TextEncoder().encode(text);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('readWhiteboardFile', () => {
  it('finds the board and its comments in a Full export Zip', async () => {
    const zip = writeZip([
      { name: 'Sprint retro.html', data: board },
      { name: 'Sprint retro-comments.json', data: '{"commentThreads":[]}' },
    ]);
    const file = await readWhiteboardFile({ name: 'whatever.zip', bytes: zip });
    expect(file.ok && file.route).toBe('board');
    if (!file.ok || file.route !== 'board') return;
    expect(file.title).toBe('Sprint retro');
    expect(file.comments).toEqual({ commentThreads: [] });
    expect(file.doc.getElementById('canvasContent')).not.toBeNull();
  });

  it('ignores macOS resource forks and HTML that is not a board', async () => {
    const zip = writeZip([
      { name: '__MACOSX/._Board.html', data: board },
      { name: 'readme.html', data: '<html><body>notes</body></html>' },
      { name: 'Board.html', data: board, method: 'deflate' },
    ]);
    const file = await readWhiteboardFile({ name: 'b.zip', bytes: zip });
    expect(file.ok && file.route === 'board' && file.title).toBe('Board');
  });

  it('keeps going without comments when the JSON is missing or broken', async () => {
    const zip = writeZip([
      { name: 'Board.html', data: board },
      { name: 'Board-comments.json', data: '{not json' },
    ]);
    const file = await readWhiteboardFile({ name: 'b.zip', bytes: zip });
    expect(file.ok && file.route === 'board' && file.comments).toBeNull();
  });

  it('refuses a Zip holding two boards', async () => {
    const zip = writeZip([
      { name: 'One.html', data: board },
      { name: 'Two.html', data: board },
    ]);
    expect(await readWhiteboardFile({ name: 'b.zip', bytes: zip })).toMatchObject({
      ok: false,
      refusal: 'several-boards',
    });
  });

  it('refuses a Zip without a board', async () => {
    const zip = writeZip([{ name: 'photo.txt', data: 'x' }]);
    expect(await readWhiteboardFile({ name: 'b.zip', bytes: zip })).toMatchObject({
      ok: false,
      refusal: 'not-whiteboard',
    });
  });

  it('refuses an encrypted board entry', async () => {
    const zip = writeZip([{ name: 'Board.html', data: board, encrypted: true }]);
    expect(await readWhiteboardFile({ name: 'b.zip', bytes: zip })).toMatchObject({
      ok: false,
      refusal: 'zip-encrypted',
    });
  });

  it('reads an extracted board HTML, titled by its file name', async () => {
    const file = await readWhiteboardFile({ name: 'Plans.html', bytes: bytes(board) });
    expect(file.ok && file.route === 'board' && [file.title, file.comments]).toEqual([
      'Plans',
      null,
    ]);
  });

  it('takes the picture route for a PNG, JPEG or WebP, by bytes not name', async () => {
    const png = await readWhiteboardFile({ name: 'board.zip', bytes: PNG });
    expect(png.ok && png.route === 'picture' && [png.title, png.mimeType]).toEqual([
      'board',
      'image/png',
    ]);
    const jpeg = await readWhiteboardFile({
      name: 'b.jpg',
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
    });
    expect(jpeg.ok && jpeg.route === 'picture' && jpeg.mimeType).toBe('image/jpeg');
    const webp = await readWhiteboardFile({
      name: 'b.webp',
      bytes: bytes('RIFF\0\0\0\0WEBPVP8 '),
    });
    expect(webp.ok && webp.route === 'picture' && webp.mimeType).toBe('image/webp');
  });

  it('refuses other files as not a Whiteboard export', async () => {
    expect(await readWhiteboardFile({ name: 'a.txt', bytes: bytes('hello') })).toMatchObject({
      ok: false,
      refusal: 'not-whiteboard',
    });
  });

  it('refuses an empty board', async () => {
    expect(
      await readWhiteboardFile({ name: 'Empty.html', bytes: bytes(boardHtml([])) }),
    ).toMatchObject({ ok: false, refusal: 'empty-board' });
  });

  it('names an untitled board Whiteboard', async () => {
    const file = await readWhiteboardFile({ name: '.html', bytes: bytes(board) });
    expect(file.ok && file.title).toBe('Whiteboard');
  });
});
