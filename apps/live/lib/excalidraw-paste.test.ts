import { describe, expect, it } from 'vitest';
import {
  EXCALIDRAW_CLIPBOARD_MIME,
  EXCALIDRAW_FILE_MIME,
  excalidrawTextFromPaste,
  isExcalidrawFileCandidate,
} from './excalidraw-paste';
import { excalidrawBuilder, excalidrawText } from './excalidraw-fixtures';

const data = (entries: Record<string, string>) => ({
  getData: (type: string) => entries[type] ?? '',
});

const copy = () => excalidrawText([excalidrawBuilder().rectangle()]);

describe('excalidrawTextFromPaste', () => {
  it('prefers the Excalidraw clipboard type', () => {
    const text = copy();
    expect(
      excalidrawTextFromPaste(data({ [EXCALIDRAW_CLIPBOARD_MIME]: text, 'text/plain': 'x' })),
    ).toBe(text);
  });

  it('falls back to plain text', () => {
    const text = copy();
    expect(excalidrawTextFromPaste(data({ 'text/plain': text }))).toBe(text);
  });

  it('is null for ordinary text, our own payload or nothing', () => {
    expect(excalidrawTextFromPaste(data({ 'text/plain': 'hello' }))).toBeNull();
    expect(
      excalidrawTextFromPaste(
        data({ 'text/plain': '{"kind":"livediagram.elements","elements":[]}' }),
      ),
    ).toBeNull();
    expect(excalidrawTextFromPaste(data({}))).toBeNull();
    expect(excalidrawTextFromPaste(null)).toBeNull();
  });

  it('survives a getData that throws', () => {
    expect(
      excalidrawTextFromPaste({
        getData: () => {
          throw new Error('denied');
        },
      }),
    ).toBeNull();
  });
});

describe('isExcalidrawFileCandidate', () => {
  it.each([
    ['board.excalidraw', '', true],
    ['BOARD.EXCALIDRAW', '', true],
    ['x', EXCALIDRAW_FILE_MIME, true],
    ['board.excalidraw.png', 'image/png', true],
    ['drawing.svg', 'image/svg+xml', true],
    ['photo.jpg', 'image/jpeg', false],
    ['notes.txt', 'text/plain', false],
  ])('%s (%s) is %s', (name, type, expected) => {
    expect(isExcalidrawFileCandidate({ name, type })).toBe(expected);
  });
});
