import { describe, expect, it } from 'vitest';
import { isBoxed, isValidElement, type Element } from '@livehuddle/document';
import {
  REFERENCE_AREA,
  REFERENCE_COUNT,
  REFERENCE_SEED,
  buildReferenceBoard,
} from './reference-board';

// docs/specs/008-canvas/canvas-performance.md "The reference board".

const count = (els: Element[], type: string) => els.filter((e) => e.type === type).length;

describe('buildReferenceBoard', () => {
  const board = buildReferenceBoard();

  it('is the same board for the same seed, and another for another', () => {
    expect(buildReferenceBoard(REFERENCE_SEED)).toEqual(board);
    expect(buildReferenceBoard(REFERENCE_SEED + 1)).not.toEqual(board);
  });

  it('holds the mix real boards have', () => {
    expect(board).toHaveLength(REFERENCE_COUNT);
    expect(count(board, 'shape')).toBe(600);
    expect(count(board, 'text')).toBe(250);
    expect(count(board, 'sticky')).toBe(150);
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
});
