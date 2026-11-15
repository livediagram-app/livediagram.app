import { describe, expect, it } from 'vitest';
import { isBoxed, isValidElement, type Element } from '@livehuddle/document';
import {
  FURNITURE_KINDS,
  REFERENCE_AREA,
  REFERENCE_COUNT,
  REFERENCE_SEED,
  ROOM_COLUMNS,
  ROOM_ROWS,
  buildReferenceBoard,
} from './reference-board';

// docs/specs/008-canvas/canvas-performance.md "The reference board".

const kindOf = (el: Element) => (el.type === 'shape' ? el.shape : el.type);
const count = (els: Element[], kind: string) => els.filter((e) => kindOf(e) === kind).length;
const rooms = ROOM_COLUMNS * ROOM_ROWS;

describe('buildReferenceBoard', () => {
  const board = buildReferenceBoard();

  it('is the same Space for the same seed, and another for another', () => {
    expect(buildReferenceBoard(REFERENCE_SEED)).toEqual(board);
    expect(buildReferenceBoard(REFERENCE_SEED + 1)).not.toEqual(board);
  });

  it('holds a real Space’s rooms and furniture', () => {
    expect(board).toHaveLength(REFERENCE_COUNT);
    expect(count(board, 'room')).toBe(rooms);
    expect(count(board, 'door')).toBe(rooms);
    expect(count(board, 'rug')).toBe(rooms);
    expect(count(board, 'desk')).toBe(rooms * 2);
    expect(count(board, 'chair')).toBe(rooms * 2);
    expect(count(board, 'sofa')).toBe(rooms);
    expect(count(board, 'plant')).toBe(rooms);
    expect(count(board, 'sticky')).toBe(rooms);
    expect(count(board, 'text')).toBe(REFERENCE_COUNT - rooms * 10);
    const furniture = board.filter((el) => (FURNITURE_KINDS as string[]).includes(kindOf(el)));
    expect(furniture).toHaveLength(rooms * 6);
  });

  it('is made of valid elements with stable ids', () => {
    expect(board.every((el) => isValidElement(el))).toBe(true);
    expect(new Set(board.map((el) => el.id)).size).toBe(REFERENCE_COUNT);
    expect(board[0]!.id).toBe('ref-0');
  });

  it('spreads over four screens by three', () => {
    for (const el of board.filter(isBoxed)) {
      expect(el.x).toBeGreaterThanOrEqual(0);
      expect(el.y).toBeGreaterThanOrEqual(0);
      expect(el.x + el.width).toBeLessThanOrEqual(REFERENCE_AREA.width);
      expect(el.y + el.height).toBeLessThanOrEqual(REFERENCE_AREA.height);
    }
  });

  it('takes its first elements for a smaller office', () => {
    expect(buildReferenceBoard(REFERENCE_SEED, 80)).toEqual(board.slice(0, 80));
  });
});
