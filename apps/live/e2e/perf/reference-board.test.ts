import { describe, expect, it } from 'vitest';
import { isBoxed, isValidElement, type Element } from '@livediagram/document';
import {
  ARROW_NEIGHBOURS,
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
    expect(count(board, 'shape')).toBe(400);
    expect(count(board, 'arrow')).toBe(300);
    expect(count(board, 'freehand')).toBe(100);
    expect(count(board, 'text')).toBe(100);
    expect(count(board, 'path')).toBe(50);
    expect(count(board, 'sticky')).toBe(50);
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

  it('pins every arrow between two shapes on the board, routed behind boxes as drawn', () => {
    const shapes = new Set(board.filter((e) => e.type === 'shape').map((e) => e.id));
    for (const el of board) {
      if (el.type !== 'arrow') continue;
      expect(el.from.kind === 'pinned' && shapes.has(el.from.elementId)).toBe(true);
      expect(el.to.kind === 'pinned' && shapes.has(el.to.elementId)).toBe(true);
      expect(el.routeBehind).toBeUndefined();
    }
  });

  it('joins each arrow to a near neighbour of its shape, as real diagrams do', () => {
    expect(ARROW_NEIGHBOURS).toBe(3);
    const shapes = board.filter((e) => e.type === 'shape') as Extract<Element, { type: 'shape' }>[];
    const centre = (s: (typeof shapes)[number]) => ({
      x: s.x + s.width / 2,
      y: s.y + s.height / 2,
    });
    const byId = new Map(shapes.map((s) => [s.id, s]));
    for (const el of board) {
      if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
      const from = byId.get(el.from.elementId)!;
      const c = centre(from);
      const nearest = shapes
        .filter((s) => s !== from)
        .sort(
          (a, b) =>
            Math.hypot(centre(a).x - c.x, centre(a).y - c.y) -
            Math.hypot(centre(b).x - c.x, centre(b).y - c.y),
        )
        .slice(0, ARROW_NEIGHBOURS)
        .map((s) => s.id);
      expect(nearest).toContain(el.to.elementId);
    }
  });
});
