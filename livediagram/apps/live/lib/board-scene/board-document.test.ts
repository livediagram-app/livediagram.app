import { describe, expect, it } from 'vitest';
import { boardDocumentDates, boardDocumentName } from './board-document';
import { boardScene } from './test-scenes';

// docs/specs/020-import-export/board-import.md "new-document": named and dated as the board.
const NOW = Date.UTC(2026, 9, 1);
const scene = (over: Parameters<typeof boardScene>[1]) => boardScene([], over);

describe('boardDocumentDates', () => {
  it('reads the board’s created and modified dates', () => {
    expect(
      boardDocumentDates(
        scene({ createdAt: '2020-08-14T12:00:00Z', modifiedAt: '2021-02-03T09:30:00.123Z' }),
        NOW,
      ),
    ).toEqual({
      createdAt: Date.UTC(2020, 7, 14, 12),
      savedAt: Date.UTC(2021, 1, 3, 9, 30, 0, 123),
      unreadable: false,
    });
  });

  it('keeps the created date alone when the modified one cannot be used', () => {
    expect(
      boardDocumentDates(
        scene({ createdAt: '2020-08-14T12:00:00Z', modifiedAt: '2019-01-01T00:00:00Z' }),
        NOW,
      ),
    ).toEqual({ createdAt: Date.UTC(2020, 7, 14, 12), unreadable: true });
    expect(boardDocumentDates(scene({ createdAt: '2020-08-14T12:00:00Z' }), NOW)).toEqual({
      createdAt: Date.UTC(2020, 7, 14, 12),
      unreadable: false,
    });
  });

  it('dates the board today when its dates are missing or broken', () => {
    expect(boardDocumentDates(scene({}), NOW)).toEqual({ unreadable: false });
    expect(boardDocumentDates(scene({ createdAt: 'yesterday' }), NOW)).toEqual({
      unreadable: true,
    });
    expect(boardDocumentDates(scene({ createdAt: '1990-01-01T00:00:00Z' }), NOW)).toEqual({
      unreadable: true,
    });
    expect(boardDocumentDates(scene({ modifiedAt: '2021-02-03T09:30:00Z' }), NOW)).toEqual({
      unreadable: true,
    });
  });
});

describe('boardDocumentName', () => {
  it('names the document after the board, an untitled one after its date', () => {
    expect(boardDocumentName(scene({ title: ' Retro ' }), undefined)).toBe('Retro');
    expect(boardDocumentName(scene({}), Date.UTC(2020, 7, 14, 12))).toBe('Whiteboard, 14 Aug 2020');
    expect(boardDocumentName(scene({ title: '  ' }), undefined)).toBe('Whiteboard');
  });
});
