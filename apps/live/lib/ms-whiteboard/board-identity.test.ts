import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH } from '@livediagram/document';
import { BOARD_DATES_FLOOR, boardDates, boardDocumentName } from './board-identity';

const NOW = Date.parse('2026-10-01T12:00:00Z');

// docs/specs/020-import-export/whiteboard-import.md "Documents".
describe('boardDates', () => {
  it('takes the board record dates as ISO', () => {
    expect(boardDates('2020-08-14T09:30:00.1234567Z', '2026-03-09T00:26:48Z', NOW)).toEqual({
      createdAt: '2020-08-14T09:30:00.123Z',
      modifiedAt: '2026-03-09T00:26:48.000Z',
    });
  });

  it('lends one date to the other when only one is valid', () => {
    expect(boardDates(null, '2026-03-09T00:00:00Z', NOW)).toEqual({
      createdAt: '2026-03-09T00:00:00.000Z',
      modifiedAt: '2026-03-09T00:00:00.000Z',
    });
    expect(boardDates('2024-01-02T00:00:00Z', 'yesterday', NOW)).toEqual({
      createdAt: '2024-01-02T00:00:00.000Z',
      modifiedAt: '2024-01-02T00:00:00.000Z',
    });
  });

  it('drops dates that are not dates, in the future, or before Whiteboard existed', () => {
    expect(boardDates(undefined, undefined, NOW)).toEqual({});
    expect(boardDates('', 42 as unknown as string, NOW)).toEqual({});
    expect(boardDates('2030-01-01T00:00:00Z', '1999-12-31T00:00:00Z', NOW)).toEqual({});
    expect(Date.parse(BOARD_DATES_FLOOR)).toBeLessThan(Date.parse('2017-07-01T00:00:00Z'));
  });

  it('never creates a board after its last edit', () => {
    expect(boardDates('2026-03-09T00:00:00Z', '2024-01-01T00:00:00Z', NOW)).toEqual({
      createdAt: '2024-01-01T00:00:00.000Z',
      modifiedAt: '2024-01-01T00:00:00.000Z',
    });
  });
});

describe('boardDocumentName', () => {
  it('names the document after the board, trimmed and single-spaced', () => {
    expect(boardDocumentName('  Sprint\n board  ', {})).toBe('Sprint board');
  });

  it('caps a long title at the name limit', () => {
    const name = boardDocumentName('x'.repeat(200), {});
    expect([...name].length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('gives an untitled board a dated name from when it was made', () => {
    expect(boardDocumentName(null, { createdAt: '2020-08-14T09:30:00.000Z' })).toBe(
      'Whiteboard, 14 Aug 2020',
    );
    expect(boardDocumentName('   ', { modifiedAt: '2026-03-09T00:00:00.000Z' })).toBe(
      'Whiteboard, 9 Mar 2026',
    );
  });

  it('falls back to "Whiteboard" with neither title nor date', () => {
    expect(boardDocumentName(undefined, {})).toBe('Whiteboard');
  });
});
